"""One server: Nessie watcher, Twilio webhooks + media-stream websocket, dashboard API.

Run: `uv run server.py`, then `ngrok http 7860` and set LOCAL_SERVER_URL. Point the
Twilio number's inbound Voice webhook at {LOCAL_SERVER_URL}/twiml (POST).
"""

import asyncio
import datetime
import hmac
import json
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv(override=True)

import uvicorn  # noqa: E402
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from loguru import logger  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402
from twilio.request_validator import RequestValidator  # noqa: E402
from twilio.twiml.voice_response import Connect, Dial, Stream, VoiceResponse  # noqa: E402

import agent  # noqa: E402
import anthropic  # noqa: E402
import crs  # noqa: E402
import estate  # noqa: E402
import gate  # noqa: E402
import intel  # noqa: E402
import nessie  # noqa: E402
import review  # noqa: E402
import shield  # noqa: E402
import store  # noqa: E402
import verify  # noqa: E402
from members import MEMBERS, by_phone, member_phone, seed  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    await intel.load_alerts()
    if os.getenv("SHIELD_NUMBER"):
        await shield.prerender()
    accounts = {ids["account"]: mid for mid, ids in seed()["members"].items()}
    await agent.resume()  # held/escalated cases from Convex, so a restart doesn't strand them
    tasks = [asyncio.create_task(agent.expire_holds())]
    if os.getenv("FACTORY_API_KEY"):
        tasks.append(asyncio.create_task(morning_reviews()))
    if accounts:
        tasks.append(asyncio.create_task(nessie.watch(accounts, agent.on_new_purchase)))
    else:
        logger.warning("no seed_ids.json: run `uv run seed.py` first; watcher not started")
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(lifespan=lifespan)
# DASHBOARD_ORIGIN (e.g. http://localhost:3000) limits which site may call the analyst routes from a browser
app.add_middleware(CORSMiddleware, allow_origins=[o for o in (os.getenv("DASHBOARD_ORIGIN") or "*").split(",") if o],
                   allow_methods=["*"], allow_headers=["*"])


def analyst(x_analyst_token: str = Header("")):
    """Analyst routes need ANALYST_TOKEN (the dashboard asks for it once). Unset = open, for local dev only."""
    want = os.getenv("ANALYST_TOKEN", "")
    if want and not hmac.compare_digest(x_analyst_token.encode(), want.encode()):
        raise HTTPException(401, "analyst passcode required")


@app.get("/health")
async def health():
    """For preflight.py and ngrok checks: no secrets, just what's loaded."""
    return {"ok": True, "cases": len(agent.CASES), "analyst_auth": bool(os.getenv("ANALYST_TOKEN"))}


async def twilio_form(request: Request) -> dict:
    """Twilio webhook form, rejected unless signed by our Twilio account (stops spoofed call-status/twiml)."""
    form = dict(await request.form())
    url = f"{os.environ['LOCAL_SERVER_URL']}{request.url.path}" + (f"?{request.url.query}" if request.url.query else "")
    if not RequestValidator(os.environ["TWILIO_AUTH_TOKEN"]).validate(url, form, request.headers.get("X-Twilio-Signature", "")):
        raise HTTPException(403, "bad Twilio signature")
    return form


@app.post("/twiml")
async def twiml(request: Request):
    form, q = await twilio_form(request), request.query_params
    if shield.shield_member(form.get("To")):  # a call to her protected line
        return Response(await shield.caller_twiml(form), media_type="application/xml")
    inbound = form.get("Direction") == "inbound"
    mode = q.get("mode", "member")
    case_id = q.get("case_id", "")
    if inbound and not case_id:  # callback to the card number: find her held case by caller id
        case = agent.open_case_for(by_phone(form.get("From")))
        case_id = case.id if case else ""
    if case_id and agent.machine_answered(form, case_id, mode):  # voicemail/fax: hang up, never start verification
        return Response(str(VoiceResponse().hangup()), media_type="application/xml")
    stream = Stream(url=os.environ["LOCAL_SERVER_URL"].replace("https://", "wss://") + "/ws")
    for name, value in {
        "case_id": case_id,
        "mode": mode,
        "note": q.get("note", ""),
        "direction": "inbound" if inbound else "outbound",
        "from_number": form.get("From", ""),
        "to_number": form.get("To", ""),
    }.items():
        stream.parameter(name=name, value=value)
    connect = Connect()
    connect.append(stream)
    response = VoiceResponse()
    response.append(connect)
    if case_id and mode in ("member", "bridge", "estate"):
        # Only reached if the bot ends its stream WITHOUT hanging up, i.e. when bridging to family (bot.py)
        dial = Dial()
        # member waits with hold music until family joins and starts the conference
        dial.conference(f"case-{case_id}", start_conference_on_enter=mode == "bridge", end_conference_on_exit=True, beep=False)
        response.append(dial)
    return Response(str(response), media_type="application/xml")


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    from pipecat.runner.types import WebSocketRunnerArguments

    from bot import bot

    await websocket.accept()
    try:
        await bot(WebSocketRunnerArguments(websocket=websocket))
    except Exception as e:
        logger.exception(f"bot crashed: {e}")
        await websocket.close()


@app.websocket("/shield-ws")
async def shield_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        await shield.listen(websocket)
    except Exception as e:
        logger.exception(f"shield listener crashed: {e}")  # the call itself carries on; only detection stops


@app.get("/shield/audio/{clip}.wav")
async def shield_audio(clip: str):
    if clip not in shield.AUDIO:
        raise HTTPException(404)
    return Response(shield.AUDIO[clip], media_type="audio/wav")


@app.post("/shield/twiml/{key}")
async def shield_twiml(key: str):
    if key not in shield.TWIML:
        raise HTTPException(404)
    return Response(shield.TWIML[key], media_type="application/xml")


@app.post("/call-status")
async def call_status(request: Request):
    form, q = await twilio_form(request), request.query_params
    asyncio.create_task(agent.on_call_status(q.get("case_id", ""), q.get("mode", ""), form.get("CallStatus", "")))
    return {"ok": True}


class Scenario(BaseModel):
    member_id: str
    merchant: str = Field(min_length=1, max_length=60)
    category: str = Field(min_length=1, max_length=30)
    amount: int = Field(gt=0, le=100_000)
    note: str = Field("", max_length=200)


@app.post("/scenario", dependencies=[Depends(analyst)])
async def scenario(s: Scenario):
    """Judge Scenario form: posts a real purchase to Nessie; the watcher takes it from there."""
    ids = seed()["members"].get(s.member_id)
    if s.member_id not in MEMBERS or not ids:
        raise HTTPException(404, f"unknown or unseeded member {s.member_id!r}")
    mid = await nessie.merchant_id(s.merchant, s.category)
    await nessie.create_txn(ids["account"], mid, s.merchant, s.amount, s.note or f"{s.merchant} purchase")
    return {"ok": True}


@app.post("/cases/{case_id}/{action}", dependencies=[Depends(analyst)])
async def analyst_decision(case_id: str, action: str):
    if action not in ("release", "confirm_fraud"):
        raise HTTPException(404)
    case = await agent.find_case(case_id)
    if not case:
        raise HTTPException(404, "no open case with that id (already decided, or reset)")
    if why := await agent.do(case, action, "human", f"Analyst decision from the dashboard: {action.replace('_', ' ')}"):
        raise HTTPException(409, why)
    return {"ok": True}


async def morning_reviews(hour: int = 7):
    """Schedule trigger for the Droid review: every day at 7am local, after the night shift."""
    while True:
        now = datetime.datetime.now()
        nxt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        nxt += datetime.timedelta(days=1) if nxt <= now else datetime.timedelta()
        await asyncio.sleep((nxt - now).total_seconds())
        try:
            await review.run_review(review.case_files(agent.CASES.values()), "schedule")
        except Exception as e:
            logger.error(f"morning review: {e}")


@app.post("/review", dependencies=[Depends(analyst)])
async def run_review():
    """Dashboard trigger. Runs in the background; steps stream into Convex."""
    if review._lock.locked():
        raise HTTPException(409, "a review is already running")
    asyncio.create_task(review.run_review(review.case_files(agent.CASES.values()), "analyst"))
    return {"ok": True}


@app.post("/review/{decision}", dependencies=[Depends(analyst)])
async def decide_review(decision: str):
    if decision not in ("approve", "reject"):
        raise HTTPException(404)
    if why := await review.decide(decision == "approve"):
        raise HTTPException(409, why)
    return {"ok": True}


def estate_data(key: str | None = None):
    """compute() for one estate (404 if unknown) or all of them, each with the planted-error score."""
    correct, total = estate.score()
    out = [estate.compute(e) | {"score": {"correct": correct, "total": total}} for e in estate.load() if key in (None, e["key"])]
    if key and not out:
        raise HTTPException(404, f"no estate {key!r}")
    return out


def estate_case(d: dict, cid: str) -> gate.Case:
    return gate.Case(cid, "dolores", cid, f"{d['name']} estate", "estate", d["return_now"], estate=d)


@app.post("/estates/run", dependencies=[Depends(analyst)])
async def estates_run():
    ds = estate_data()
    await asyncio.gather(*(store.estate_upsert(d["key"], d) for d in ds))
    return [{k: d[k] for k in ("key", "decision", "cu_liability")} for d in ds]


class Signer(BaseModel):
    by: str = Field("Controller", min_length=1, max_length=60)


@app.post("/estates/{key}/sign", dependencies=[Depends(analyst)])
async def estates_sign(key: str, s: Signer | None = None):
    d = estate_data(key)[0]
    case = estate_case(d, f"estate-{key}")
    for action in ("post_journal",) + (("sign_loss",) if d["needs_controller"] else ()):
        if why := gate.check(action, case, "human"):
            raise HTTPException(409, why)
    await store.estate_upsert(key, d)  # sign posts the journal stored in Convex: make it this one (no-op once signed)
    try:
        await store.estate_sign(key, (s or Signer()).by)
    except Exception as e:
        raise HTTPException(502, f"signature not recorded: {e}")
    return {"ok": True}


WHY_MODEL = "claude-opus-5-5"
WHY_SYSTEM = ("You explain a credit union estate-desk decision to its controller. Use ONLY the JSON you are given; add no facts, "
              "no law and no numbers that are not in it. 3 to 5 short plain sentences, no markdown. End every sentence with the "
              "source id or rule it rests on, in brackets, e.g. [rep_note-1] or [31 CFR 210.11], exactly as written in the JSON.")
_why_llm = None


@app.post("/estates/{key}/why", dependencies=[Depends(analyst)])
async def estates_why(key: str):
    global _why_llm
    d = estate_data(key)[0]
    try:
        _why_llm = _why_llm or anthropic.AsyncAnthropic(timeout=30, max_retries=1)
        r = await _why_llm.messages.create(model=WHY_MODEL, max_tokens=700, system=WHY_SYSTEM,
                                           messages=[{"role": "user", "content": json.dumps(d)}])
        text = " ".join(b.text for b in r.content if b.type == "text").strip()
        if text:
            return {"text": text}
    except Exception as e:
        logger.warning(f"estate why: {e}; using the template")
    # ponytail: template fallback straight from compute()'s findings
    lead = f"Decision: {d['decision'].replace('_', ' ')}, credit union liability ${d['cu_liability']:,.2f} [{d['liability_basis']}]."
    return {"text": " ".join([lead] + [f"{f['text']} [{f['rule']}]" for f in d["findings"]])}


@app.post("/estates/{key}/call", dependencies=[Depends(analyst)])
async def estates_call(key: str):
    """The estate desk calls Dolores (real Twilio call, mode "estate", same /twiml + bot pipeline)."""
    d = estate_data(key)[0]
    if d["decision"] == "recipient_alive":
        raise HTTPException(409, "the recipient is alive: there is no estate to call about")
    if not (member_phone("dolores") and os.getenv("LOCAL_SERVER_URL") and os.getenv("TWILIO_NUMBER")):
        raise HTTPException(409, "MEMBER_PHONE, LOCAL_SERVER_URL and TWILIO_NUMBER must be set to place the call")
    m = MEMBERS["dolores"]
    txn_id = f"estate-{key}-{int(time.time())}"
    # status "allowed": a case file for the transcript, never a held purchase the watcher or resume() picks up
    cid = await store.open_case(member_id="dolores", member_name=m["name"], txn_id=txn_id, merchant=f"{d['name']} estate",
                                category="estate", amount=float(d["return_now"]), status="allowed", risk_signals=[],
                                plan="Estate desk: tell her the Treasury repayment is the credit union's, not hers",
                                decision_rationale=f"Estate {key}: {d['decision'].replace('_', ' ')}")
    case = estate_case(d, cid)
    agent.CASES[cid] = case
    data = await crs.pull("dolores", m["crs"])
    verify.build(cid, data.get("report"), crs.answers_needed(data), city=m.get("city"))
    await store.action(cid, "call", "agent", f"Estate desk calling {m['first_name']} about {d['name']}'s account")
    await agent.dial(case, member_phone("dolores"), "estate")
    return {"ok": True, "case_id": cid}


@app.post("/reset", dependencies=[Depends(analyst)])
async def reset():
    agent.CASES.clear()
    await store.reset()
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))

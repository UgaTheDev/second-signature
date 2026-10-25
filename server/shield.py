"""Scam Shield: catch the scam while the scammer is still on the phone with her.

Calls to the member's protected line (SHIELD_NUMBER; in real life she forwards her landline
to it) run like this:
1. The caller hears, in the Cartesia voice, that the line is protected. California needs every
   party's consent to listen in, and the notice itself deters scammers.
2. <Start><Stream track="inbound_track"> forks only the CALLER's audio to /shield-ws. The call
   continues to <Dial><Conference>, and we ring her phone into the same conference.
3. Cartesia Ink transcribes. A keyword check decides when to ask Claude Haiku "is this a scam
   script?", which keeps it cheap. The transcript lives in memory only, and only the evidence
   quote is kept if the call is flagged.
4. On a confident yes, Twilio plays a Cartesia-voiced warning to HER participant only. The
   scammer hears nothing.
5. The flag feeds the money side: any purchase in the next 24h is held by rule
   (gate.must_hold), and only an analyst can release it.
"""

import asyncio
import io
import math
import os
import re
import time
import uuid
import wave

import anthropic
import httpx
from loguru import logger
from pipecat.frames.frames import TranscriptionFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.services.cartesia.stt import CartesiaSTTService
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport
from pipecat.workers.runner import WorkerRunner
from pydantic import BaseModel
from twilio.rest import Client as Twilio
from twilio.twiml.voice_response import Dial, Start, VoiceResponse

import store
from calltools import CU
from members import MEMBERS, member_phone, phone

MODEL = "claude-haiku-5-5"  # it runs during a live call, so latency matters
THRESHOLD = 0.75
WINDOW_HOURS = 24  # a flagged call holds her high-risk purchases for this long
ANNOUNCE = f"This call is protected by {CU}'s scam shield, and an automated assistant is listening for scams."
# Fixed words only: the trusted voice never repeats anything the caller (or a model reading him) wrote.
WHISPER = ("{name}, it's your credit union. You don't need to answer me. This sounds like a scam. "
           "It's okay to hang up. It's okay to hang up.")
WHISPER_TRIES, WHISPER_GAP = 3, 5  # she may not have picked up yet: retry over ~15s

# Cheap gate before any model call: phrases from real scripts (FTC alerts, PLAYBOOK.md section 2).
PREFILTER = re.compile(
    r"gift ?cards?|read (me )?the (numbers|codes)|don'?t tell|keep (this|it) (a )?secret|microsoft|apple support|"
    r"tech(nical)? support|hacked|virus|remote access|irs|social security|warrant|arrest|police|bail|jail|"
    r"wire (the )?money|bitcoin|crypto|western union|zelle|grand(son|daughter|ma)|your bank (may be|is) involved|"
    r"one[- ]time (pass)?code|verification code|fraud department|suspicious activity|medicare|amazon|cash ?app|venmo",
    re.I)

SESSIONS: dict[str, dict] = {}  # conference name -> live call state (in memory only)
EVENTS: dict[str, list[dict]] = {}  # member_id -> flagged calls, feeds triage + gate
AUDIO: dict[str, bytes] = {}  # rendered Cartesia clips served at /shield/audio/{id}.wav
TWIML: dict[str, str] = {}  # whisper TwiML Twilio fetches as the participant announce_url
_llm = None
_TASKS: set = set()  # keep background whisper retries referenced until they finish


class Verdict(BaseModel):
    scam: bool
    confidence: float
    scam_type: str  # tech_support | government_impersonation | family_emergency | romance | other | none
    evidence: str  # the caller's exact words that show it (case file only, never spoken to her)


def _digits(s: str | None) -> str:
    return "".join(c for c in s or "" if c.isdigit())[-10:]


def shield_member(to_number: str | None) -> str | None:
    """Which member owns this protected line."""
    for mid, m in MEMBERS.items():
        num = os.getenv(m.get("shield_env") or "")
        if num and to_number and _digits(num) == _digits(to_number):
            return mid
    return None


def recent(member_id: str, hours: float = WINDOW_HOURS) -> dict | None:
    cutoff = time.time() - hours * 3600
    hits = [e for e in EVENTS.get(member_id, []) if e["t"] >= cutoff]
    return hits[-1] if hits else None


def rebuild(rows: list[dict]) -> int:
    """Startup: re-arm the 24h window from scam_call cases in the case file (EVENTS itself is memory only)."""
    # ponytail: rows come from cases:active (open/escalated), so a scam_call case an analyst already closed
    # isn't re-armed after a restart; add a by-category query if that matters.
    cutoff, n = time.time() - WINDOW_HOURS * 3600, 0
    for r in rows:
        t = r.get("opened_at", 0) / 1000
        if r.get("category") != "scam_call" or t < cutoff:
            continue
        kind = re.search(r"Scam Shield: (.+?) script", r.get("decision_rationale", ""))
        fact = next((x["fact"] for x in r.get("risk_signals", []) if x.get("source") == "shield"), "")
        EVENTS.setdefault(r["member_id"], []).append({"t": t, "scam_type": kind.group(1).replace(" ", "_") if kind else "other",
                                                      "evidence": fact.removeprefix('Caller said: "').removesuffix('"')})
        n += 1
    for evs in EVENTS.values():
        evs.sort(key=lambda e: e["t"])  # recent() takes the last one
    return n


def clip_seconds(key: str) -> float:
    """How long a rendered clip plays; 12s if it's a <Say> fallback or the header is unreadable."""
    try:
        with wave.open(io.BytesIO(AUDIO[key])) as w:
            secs = w.getnframes() / w.getframerate()
        return secs if 0 < secs < 60 else 12.0
    except Exception:
        return 12.0


def mask(number: str) -> str:
    d = "".join(c for c in number or "" if c.isdigit())
    return f"***-{d[-4:]}" if len(d) >= 4 else "unknown number"


async def render(text: str) -> str | None:
    """Cartesia Sonic -> 8 kHz WAV served to Twilio <Play>. Returns the clip id, or None to fall back to <Say>."""
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.post("https://api.cartesia.ai/tts/bytes", headers={
                "X-API-Key": os.environ["CARTESIA_API_KEY"], "Cartesia-Version": "2026-03-01"}, json={
                "model_id": "sonic-3.6", "transcript": text,
                "voice": {"mode": "id", "id": os.getenv("CARTESIA_VOICE_ID", "71a7ad14-091c-4e8e-a314-022ece01c121")},
                "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": 8000},
                "generation_config": {"speed": 0.9, "emotion": "content", "volume": 1.8}})
            r.raise_for_status()
        clip = uuid.uuid4().hex
        AUDIO[clip] = r.content
        return clip
    except Exception as e:
        logger.error(f"shield: Cartesia render failed, using <Say>: {e}")
        return None


def play_twiml(clip: str | None, fallback_text: str) -> str:
    r = VoiceResponse()
    if clip:
        r.play(f"{os.environ['LOCAL_SERVER_URL']}/shield/audio/{clip}.wav")
    else:
        r.say(fallback_text)
    return str(r)


def chime(wav: bytes) -> bytes:
    """Two soft bell tones ahead of the whisper, so she knows the next voice isn't the caller's."""
    try:
        with wave.open(io.BytesIO(wav)) as w:  # Cartesia streams: its header says "unknown length" (0xFFFFFFFF)
            params, speech = w.getparams(), w.readframes(w.getnframes())
    except Exception:
        return wav
    if params.sampwidth != 2 or params.nchannels != 1:
        return wav
    rate = params.framerate
    def tone(hz, secs):
        n = int(rate * secs)
        return b"".join(int(7000 * math.sin(2 * math.pi * hz * i / rate) * math.exp(-5 * i / n)).to_bytes(2, "little", signed=True)
                        for i in range(n))
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setparams(params._replace(nframes=0))  # the writer fills in the real length
        w.writeframes(tone(880, 0.3) + tone(660, 0.45) + bytes(int(rate * 0.35) * 2) + speech)
    return out.getvalue()


def _whisper_text(member_id: str) -> str:
    return WHISPER.format(name=MEMBERS[member_id]["first_name"])


async def prerender():
    """Render every clip the Shield can play (consent notice, each member's whisper) once at server startup,
    so no call waits on Cartesia. A clip that fails to render falls back to <Say>."""
    clips = {"announce": ANNOUNCE, **{f"whisper-{mid}": _whisper_text(mid) for mid, m in MEMBERS.items() if m.get("shield_env")}}
    todo = [k for k in clips if k not in AUDIO]
    for key, clip in zip(todo, await asyncio.gather(*(render(clips[k]) for k in todo))):
        if clip:
            AUDIO[key] = chime(AUDIO.pop(clip)) if key.startswith("whisper-") else AUDIO.pop(clip)


async def caller_twiml(form: dict) -> str:
    """TwiML for an incoming call to a protected line: announce, fork caller audio, conference, ring her."""
    member_id = shield_member(form.get("To"))
    family = (MEMBERS[member_id].get("family") or {}) if member_id else {}
    fam_num, to = phone(family.get("phone_env")), member_phone(member_id) if member_id else None
    frm = _digits(form.get("From"))
    # Her landline forwarding must exclude calls from SHIELD_NUMBER: forward the landline to the Shield, and have
    # the Shield ring her cell or a second line (MEMBER_PHONE) that is not itself forwarded here.
    if frm and frm == _digits(os.getenv("SHIELD_NUMBER")):  # our own ring to her came back: a forwarding loop
        logger.warning("shield: call from SHIELD_NUMBER to the protected line; her phone forwards back to the Shield. Hanging up")
        r = VoiceResponse()
        r.hangup()
        return str(r)
    if to and frm and frm in (_digits(fam_num), _digits(os.getenv("TWILIO_NUMBER"))):
        r = VoiceResponse()  # her trusted contact, or our own overnight call: no notice, no listening, just put it through
        r.dial(to)
        return str(r)
    conf = f"shield-{form.get('CallSid', uuid.uuid4().hex)}"
    base = os.environ["LOCAL_SERVER_URL"]
    SESSIONS[conf] = {"member_id": member_id, "caller": form.get("From", ""), "caller_sid": form.get("CallSid"), "member_sid": None,
                      "flagged": False, "text": [], "checked_at": 0.0}
    await prerender()
    r = VoiceResponse()
    r.play(f"{base}/shield/audio/announce.wav") if "announce" in AUDIO else r.say(ANNOUNCE)
    start = Start()
    stream = start.stream(url=base.replace("https://", "wss://") + "/shield-ws", track="inbound_track")
    stream.parameter(name="conf", value=conf)
    r.append(start)
    dial = Dial()
    dial.conference(conf, start_conference_on_enter=False, end_conference_on_exit=True, beep=False, wait_url="")
    r.append(dial)
    asyncio.create_task(_ring_member(conf, member_id))
    return str(r)


async def _ring_member(conf: str, member_id: str | None):
    to = member_phone(member_id) if member_id else None
    if not to:
        logger.error(f"shield: no phone for member {member_id}")
        return
    twiml = VoiceResponse()
    d = Dial()
    d.conference(conf, start_conference_on_enter=True, end_conference_on_exit=True, beep=False)
    twiml.append(d)
    try:
        call = await asyncio.to_thread(
            Twilio(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]).calls.create,
            to=to, from_=os.environ["SHIELD_NUMBER"], twiml=str(twiml))
        SESSIONS[conf]["member_sid"] = call.sid
    except Exception as e:  # background task: log it, or a failed ring disappears silently
        logger.error(f"shield: could not ring {member_id}: {e}")


async def classify(transcript: str) -> Verdict:
    global _llm
    _llm = _llm or anthropic.AsyncAnthropic()
    r = await _llm.messages.parse(
        model=MODEL, max_tokens=600, output_format=Verdict, output_config={"effort": "low"},
        system=("You listen to the CALLER's side of a phone call to an older adult and decide whether it is a scam script "
                "(tech support, government or bank impersonation, family emergency, romance, prize). Asking for gift cards, "
                "wires, crypto or cash, secrecy from the bank or family, urgency, or remote computer access are strong signs. "
                "A relative chatting about a birthday gift card is not a scam. Quote the caller's exact words as evidence."),
        messages=[{"role": "user", "content": f"Caller so far:\n{transcript}"}],
    )
    return r.parsed_output or Verdict(scam=False, confidence=0, scam_type="none", evidence="")


async def whisper(conf: str, v: Verdict):
    """Record the flag and arm the money-side hold (exactly once), then warn her and only her."""
    s = SESSIONS[conf]
    s["flagged"] = True
    m = MEMBERS[s["member_id"]]
    EVENTS.setdefault(s["member_id"], []).append({"t": time.time(), "scam_type": v.scam_type, "evidence": v.evidence})
    cid = await store.open_case(
        member_id=s["member_id"], member_name=m["name"], txn_id=conf, merchant=f"Phone call from {mask(s['caller'])}",
        category="scam_call", amount=0.0, status="escalated",
        risk_signals=[{"source": "shield", "fact": f'Caller said: "{v.evidence[:200]}"', "weight": round(v.confidence, 2)}],
        plan=f"Whisper a warning only she can hear. Any gift card, wire or crypto purchase in the next {WINDOW_HOURS}h "
             "is held for an analyst.",
        decision_rationale=f"Scam Shield: {v.scam_type.replace('_', ' ')} script detected live (confidence {v.confidence:.0%}).",
    )
    task = asyncio.create_task(_warn(conf, cid))  # retries must not stall the listener
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)


async def _warn(conf: str, cid):
    """Play the pre-rendered whisper to her participant; she may not have joined yet, so retry a few times."""
    s = SESSIONS[conf]
    key = f"whisper-{s['member_id']}"
    TWIML[key] = play_twiml(key if key in AUDIO else None, _whisper_text(s["member_id"]))
    for attempt in range(1, WHISPER_TRIES + 1):
        try:
            if not s["member_sid"]:
                raise RuntimeError("she hasn't been rung into the call yet")
            tw = Twilio(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
            sid = (await asyncio.to_thread(tw.conferences.list, friendly_name=conf, status="in-progress", limit=1))[0].sid
            parts = tw.conferences(sid).participants
            await _mute(parts, s.get("caller_sid"), True)  # he can't talk over the warning; to him it's just silence
            try:
                await asyncio.to_thread(parts(s["member_sid"]).update,
                                        announce_url=f"{os.environ['LOCAL_SERVER_URL']}/shield/twiml/{key}", announce_method="POST")
                await asyncio.sleep(clip_seconds(key) + 1)
            finally:
                await _mute(parts, s.get("caller_sid"), False)
            whispered = "Whispered a warning only she could hear"
            break
        except Exception as e:
            logger.error(f"shield: whisper attempt {attempt}/{WHISPER_TRIES} failed: {e}")
            whispered = f"Whisper failed ({e}); the money-side hold is still armed"
            if attempt == WHISPER_TRIES or conf not in SESSIONS:  # out of tries, or the call already ended
                break
            await asyncio.sleep(WHISPER_GAP)
    await store.action(cid, "shield", "agent", whispered)


async def _mute(parts, call_sid: str | None, muted: bool):
    if not call_sid:
        return
    try:
        await asyncio.to_thread(parts(call_sid).update, muted=muted)
    except Exception as e:  # he may have hung up already; the whisper and the hold don't depend on this
        logger.warning(f"shield: could not {'mute' if muted else 'unmute'} the caller: {e}")


REVIEW_EVERY = 30  # s: without a keyword hit, the model still reads the transcript this often
MAX_REVIEWS = 6  # per call, so a long benign call costs at most a few cents


class Detector(FrameProcessor):
    """Collects the caller's words. Asks Claude after a scam-ish phrase (at most every 6s), and also every
    REVIEW_EVERY seconds of new speech without one: the keyword gate alone misses a mis-transcribed or
    accented "gift card", so it can't be the only way in."""

    def __init__(self, conf: str, classify=classify, whisper=whisper):
        super().__init__()
        self.conf, self._classify, self._whisper, self._busy = conf, classify, whisper, False

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame) and frame.text:
            await self.heard(frame.text)
        await self.push_frame(frame, direction)

    async def heard(self, text: str):
        s = SESSIONS.get(self.conf)
        if not s:
            return
        s["text"] = (s["text"] + [text])[-40:]  # rolling window, memory only
        joined = " ".join(s["text"])
        if s["flagged"] or self._busy:
            return
        now = time.time()
        reviewed = s.setdefault("reviewed_at", now)  # periodic clock starts when the caller first speaks
        hit = bool(PREFILTER.search(joined)) and now - s["checked_at"] >= 6
        periodic = not hit and now - reviewed >= REVIEW_EVERY and s.get("reviews", 0) < MAX_REVIEWS
        if not (hit or periodic):
            return
        if periodic:
            s["reviews"] = s.get("reviews", 0) + 1
        self._busy, s["checked_at"], s["reviewed_at"] = True, now, now
        try:
            v = await self._classify(joined)
            if v.scam and v.confidence >= THRESHOLD:
                await self._whisper(self.conf, v)
        except Exception as e:
            logger.error(f"shield: classify failed: {e}")
        finally:
            self._busy = False


async def listen(websocket):
    """Listen-only pipeline on the forked caller audio. Never speaks, never hangs up."""
    _, call_data = await parse_telephony_websocket(websocket)
    conf = (call_data.body or {}).get("conf", "")
    serializer = TwilioFrameSerializer(stream_sid=call_data["stream_id"], call_sid=call_data["call_id"],
                                       params=TwilioFrameSerializer.InputParams(auto_hang_up=False))
    transport = FastAPIWebsocketTransport(websocket=websocket, params=FastAPIWebsocketParams(
        audio_in_enabled=True, audio_out_enabled=False, add_wav_header=False, serializer=serializer))
    stt = CartesiaSTTService(api_key=os.environ["CARTESIA_API_KEY"], settings=CartesiaSTTService.Settings(
        model="ink-2", keyterm=["gift cards", "Microsoft", "IRS", "Social Security", "warrant", "bail", "Western Union", "bitcoin"]))
    worker = PipelineWorker(Pipeline([transport.input(), stt, Detector(conf)]),
                            params=PipelineParams(audio_in_sample_rate=8000))
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_disconnected")
    async def _(transport, client):
        await runner.cancel()

    try:
        await runner.run()
    finally:
        s = SESSIONS.pop(conf, None)  # the transcript is dropped here; only a flagged call's evidence was kept
        logger.info(f"shield: {conf} ended, flagged={bool(s and s['flagged'])}")

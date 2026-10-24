"""The overnight analyst: new purchase -> triage -> gate -> hold -> call -> case file.

`do()` is the only way anything happens to a case. It asks the gate first, logs a
`deny` by `gate` on refusal, and otherwise logs the action and applies its effect.
"""

import asyncio
import datetime
import os
import time

from loguru import logger
from twilio.rest import Client as Twilio

import crs
import gate
import intel
import nessie
import overrides
import shield
import store
import verify
from gate import Case
from members import MEMBERS, member_phone, phone
from triage import triage

CASES: dict[str, Case] = {}  # live cases; Convex holds the durable copy and `resume()` reloads it on startup
STATUS = {"release": "released", "escalate": "escalated", "confirm_fraud": "confirmed_fraud"}
REDIAL_SECONDS = 20
QUIET_START, QUIET_END = 21, 8  # local server hours: no unanswered-call family wake-ups from 9pm to 8am
MACHINE: set[tuple[str, str]] = set()  # (case_id, mode) calls a voicemail/fax answered; on_call_status counts them as unanswered


def machine_answered(form, case_id: str, mode: str) -> bool:
    """/twiml: Twilio AMD says a machine picked up a member or bridge call. Caller hangs up instead of talking."""
    by = form.get("AnsweredBy", "")
    if mode in ("member", "bridge") and (by.startswith("machine") or by == "fax"):
        MACHINE.add((case_id, mode))
        return True
    return False


async def on_new_purchase(member_id: str, txn: dict, history: list[dict]):
    m = MEMBERS[member_id]
    data, alerts, history_signals = await asyncio.gather(
        crs.pull(member_id, m["crs"]), intel.alerts_for(txn), intel.history_signals(member_id, txn, history)
    )
    local_time = datetime.datetime.now().strftime("%a %-I:%M %p")
    call = shield.recent(member_id)
    shield_signals = [{"source": "shield", "weight": 0.95, "fact": f"Scam Shield flagged a {call['scam_type'].replace('_', ' ')} call "
                       f"{max(1, round((time.time() - call['t']) / 60))} min ago; caller said: \"{call['evidence'][:160]}\""}] if call else []
    t = await triage(m, history, txn, shield_signals + crs.signals(data) + history_signals, alerts=alerts, local_time=local_time)
    rule = gate.must_hold(txn, history, call)
    floor = rule if t.decision == "allow" else None
    held = t.decision == "hold" or bool(floor)
    signals = [s.model_dump() for s in t.risk_signals]
    cid = await store.open_case(
        member_id=member_id, member_name=m["name"], txn_id=txn["txn_id"], merchant=txn["merchant"],
        category=txn["category"], amount=float(txn["amount"]), status="open" if held else "allowed",
        risk_signals=signals, plan=t.plan, decision_rationale=t.rationale,
    )
    case = Case(cid, member_id, txn["txn_id"], txn["merchant"], txn["category"], float(txn["amount"]),
                status="open" if held else "allowed", signals=signals, plan=t.plan, rationale=t.rationale,
                held_by_rule=bool(rule))
    CASES[cid] = case
    await store.save_state(case)
    await store.action(cid, "triage", "agent", f"{t.decision.upper()}: {t.rationale}")
    if floor:
        await store.action(cid, "override", "gate", f"Triage said allow, held anyway: {floor}")
    if not held:
        return
    if await do(case, "hold", "agent", f"Paused ${case.amount:,.0f} at {case.merchant}. {t.plan}"):
        return
    await nessie.set_status(case.txn_id, "held")
    needed = crs.answers_needed(data)
    qs = verify.build(cid, data.get("report"), needed)
    why = {0: "CRS identity check failed: no phone verification, an analyst must handle this",
           3: "CRS shows a fraud alert: stepping up to 3 of 3"}.get(needed, "2 of 3 needed")
    await store.action(cid, "verify", "agent", f"{len(qs)} verification questions from her CRS credit file, answers kept server-side ({why})")
    await do(case, "call_member", "agent", f"Calling {m['first_name']} about the paused purchase")


async def do(case: Case, action: str, by: str, reason: str) -> str | None:
    """Gate-checked action. Returns None on success, the refusal reason otherwise."""
    if why := gate.check(action, case, by):
        await store.action(case.id, "deny", "gate", f"{by} tried to {action}: {why}")
        await store.save_state(case)  # flags the caller set before asking (red_flags) still count
        return why
    await store.action(case.id, action, by, reason)
    await _apply(case, action)
    await store.save_state(case)
    if by == "human" and action == "release":
        await overrides.note(case)
    return None


async def _apply(case: Case, action: str):
    if action in STATUS:
        case.status = STATUS[action]
        await store.status(case.id, case.status)
        if action == "release":
            await nessie.set_status(case.txn_id, "pending")
    elif action == "call_member":
        await dial(case, member_phone(case.member_id), "member")
    elif action in ("call_family", "connect_family"):
        fam = MEMBERS[case.member_id]["family"]
        if action == "call_family":
            case.family_notified = True
        else:
            case.bridged = True
        await store.save_state(case)  # before dialing: a restart mid-call must not call family twice
        await dial(case, phone(fam["phone_env"]) if fam else None, "family" if action == "call_family" else "bridge")


async def dial(case: Case, to: str | None, mode: str):
    base, frm = os.getenv("LOCAL_SERVER_URL"), os.getenv("TWILIO_NUMBER")
    if not (to and base and frm):
        await store.action(case.id, "error", "agent", f"cannot place {mode} call: phone/LOCAL_SERVER_URL/TWILIO_NUMBER not set")
        return
    q = f"case_id={case.id}&mode={mode}"
    try:
        call = await asyncio.to_thread(
            Twilio(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]).calls.create,
            to=to, from_=frm, url=f"{base}/twiml?{q}", method="POST",
            status_callback=f"{base}/call-status?{q}", status_callback_event=["completed"],
            **({"machine_detection": "Enable"} if mode in ("member", "bridge") else {}),  # family mode may leave a voicemail
        )
        logger.info(f"dialed {mode} for {case.id}: {call.sid}")
    except Exception as e:
        await store.action(case.id, "error", "agent", f"{mode} call failed to start: {e}")


async def on_call_status(case_id: str, mode: str, call_status: str):
    """Twilio's final status for a call we placed. Unanswered member calls retry, then go to family."""
    case = CASES.get(case_id)
    if (case_id, mode) in MACHINE:
        MACHINE.discard((case_id, mode))
        call_status = "voicemail"
    if not case or call_status not in ("busy", "no-answer", "failed", "voicemail"):
        return
    if mode == "bridge":  # family didn't pick up: bring her out of the waiting conference, back to the agent
        await store.action(case.id, "family_bridge", "agent", f"Family didn't answer ({call_status}); returning the member to the agent")
        if case.member_call_sid:
            base = os.environ["LOCAL_SERVER_URL"]
            await asyncio.to_thread(
                Twilio(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]).calls(case.member_call_sid).update,
                url=f"{base}/twiml?case_id={case.id}&mode=member&note=family_unavailable", method="POST",
            )
        return
    if mode != "member":
        return
    case.unanswered_calls += 1
    await store.save_state(case)
    await store.action(case.id, "call", "agent", f"Call {case.unanswered_calls} not answered ({call_status})")
    if case.unanswered_calls < gate.MAX_UNANSWERED:
        await asyncio.sleep(REDIAL_SECONDS)
        await do(case, "call_member", "agent", "Trying her again")
    else:
        if QUIET_START > datetime.datetime.now().hour >= QUIET_END:
            await do(case, "call_family", "agent", f"No answer after {case.unanswered_calls} calls")
        else:
            fam = MEMBERS[case.member_id]["family"]
            await store.action(case.id, "call", "agent", f"Unanswered at night; not waking {fam['name'] if fam else 'family'}. "
                               "Hold stays; an analyst decides in the morning")
        await do(case, "escalate", "agent", "Member unreachable; hold stays until an analyst reviews it")


def hold_expires(opened: float) -> float:
    """One business day after the hold: the agent's hold authority ends then (DESIGN.md §2)."""
    d = datetime.datetime.fromtimestamp(opened) + datetime.timedelta(days=1)
    while d.weekday() >= 5:
        d += datetime.timedelta(days=1)
    return d.timestamp()


async def expire_holds(every: float = 60):
    while True:
        for case in list(CASES.values()):
            if case.status == "open" and time.time() >= hold_expires(case.opened_at):
                await do(case, "escalate", "agent", "Hold reached 1 business day; the agent's authority ends, an analyst decides")
        await asyncio.sleep(every)


async def resume() -> int:
    """Startup: reload held and escalated cases from Convex so the dashboard and callbacks keep
    working after a restart. Open cases get their verification questions rebuilt from CRS
    (same seed, same questions); if CRS is down they get none, and the call escalates."""
    rows = await store.load_active()
    shield.rebuild(rows)  # re-arm the Scam Shield's 24h hold window from flagged-call cases
    for r in rows:
        if r["_id"] in CASES or r["member_id"] not in MEMBERS:
            continue
        state = {k: v for k, v in (r.get("state") or {}).items() if k in store.STATE}
        case = Case(r["_id"], r["member_id"], r["txn_id"], r["merchant"], r["category"], float(r["amount"]),
                    status=r["status"], signals=r["risk_signals"], plan=r["plan"], rationale=r["decision_rationale"],
                    opened_at=r["opened_at"] / 1000, **state)
        CASES[case.id] = case
        if case.status == "open" and not case.verified:
            data = await crs.pull(case.member_id, MEMBERS[case.member_id]["crs"])
            verify.build(case.id, data.get("report"), crs.answers_needed(data))
        await store.action(case.id, "resume", "agent", "Server restarted; case reloaded from the case file with its gate state")
    if rows:
        logger.info(f"resumed {len(CASES)} cases from Convex")
    return len(rows)


def open_case_for(member_id: str | None) -> Case | None:
    """Newest held case for a member (inbound callback lookup)."""
    held = [c for c in CASES.values() if c.member_id == member_id and c.status in ("open", "escalated")]
    return held[-1] if held else None

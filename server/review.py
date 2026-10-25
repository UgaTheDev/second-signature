"""Morning review: a Factory Droid reads last night's case files and proposes an edit to
policy.md (the guidance triage reads). Nothing takes effect until an analyst approves the diff.

What Droid can touch, enforced here rather than in its prompt:
- It runs in a scratch directory holding only a copy of policy.md. Cases and policy are
  attached as documents, so it needs no Read tool. Droid reads aren't permission-gated,
  so a Read tool could reach server/.env.
- Tools are restricted to Edit, autonomy is OFF (every action asks), and `_guard` approves
  only edits to that one scratch file and rejects everything else.
- Approval replaces only the selected customer note, if that note is unchanged
  since the review started. Shared guidance and other customer notes are preserved. Hard hold rules live in gate.py; policy can't change them.

Triggers: 7am daily (server.py), the dashboard's "Run review now", or analysts overriding the agent
(overrides.py: OVERRIDE_REVIEW_AT releases of the agent's holds since the last review).
"""

import asyncio
import json
import pathlib
import shutil
import tempfile

from droid_sdk import (
    ApplyPatchAction, AssistantMessage, Autonomy, CreateFile, Document, EditAction,
    InteractionHandlers, PermissionRequest, Session, SessionConfig, ToolConfirmationOutcome,
)
from loguru import logger

import store
from members import MEMBERS
from review_summary import parse_summary
from customer_policy import proposal_notes, apply_note

POLICY = pathlib.Path(__file__).with_name("policy.md")
PROMPT = """You are the morning reviewer for a small credit union's overnight fraud desk.
Attached: cases.json (last night's cases: purchase, triage decision, signals, rationale, final outcome) and policy.md
(the human-approved guidance triage reads). policy.md is also in your working directory; edit that file only.

1. Find false positives (holds the member or an analyst released) and misses (purchases later confirmed as fraud).
2. If the evidence supports it, edit ONLY the existing member note for the customer in cases.json.
   Preserve all shared guidance and other member notes byte-for-byte. Cite the case outcome
   in a short parenthetical. Never weaken guidance on gift cards, wire transfers or crypto. Don't create other files.
   If nothing is warranted, change nothing.
3. End with a JSON object only: {"summary": "Plain-language overview", "customers": [
   {"member_id": "member value from cases.json", "summary": "What changed for this customer and why, or why no change was needed"}]}.
   Include every customer in cases.json. Use plain sentences, no Markdown, code, file names, or literal policy edits."""

_pending: dict = {}  # review ID, customer statuses, and isolated member-note proposals
_lock = asyncio.Lock()


def _guard(work: pathlib.Path, review_id: str):
    target = (work / "policy.md").resolve()

    def paths(a) -> list[pathlib.Path]:
        if isinstance(a, ApplyPatchAction):
            return [work / a.file_path] + [work / f.file_path for f in a.files or []] + \
                   [work / f.move_to for f in a.files or [] if f.move_to]
        return [work / a.file_path]

    async def on_permission(req: PermissionRequest):
        ok = bool(req.actions) and all(
            isinstance(a, (EditAction, CreateFile, ApplyPatchAction)) and all(p.resolve() == target for p in paths(a))
            for a in req.actions
        )
        what = ", ".join(type(a).__name__ for a in req.actions)
        offered = {o.value for o in req.options}
        choice = ToolConfirmationOutcome.PROCEED_ONCE if ok and ToolConfirmationOutcome.PROCEED_ONCE in offered \
            else ToolConfirmationOutcome.CANCEL
        await store.review_step(review_id, f"{'allowed' if choice == ToolConfirmationOutcome.PROCEED_ONCE else 'DENIED'}: {what}")
        return req.respond(choice)

    return on_permission


async def run_review(cases: list[dict], trigger: str) -> str:
    if _lock.locked():
        raise RuntimeError("a review is already running")
    async with _lock:
        import overrides

        overrides.reset_count()
        rid = await store.review_open(trigger)
        customers = [{"member_id": mid, "member_name": MEMBERS.get(mid, {}).get("name", mid),
                      "summary": "", "status": "running"} for mid in sorted({c["member"] for c in cases})]
        _pending.clear()
        _pending.update(review_id=rid, customers=customers, proposals={})
        await store.review_set(rid, "running", customers=customers)
        for customer in customers:
            mid = customer["member_id"]
            base = POLICY.read_text()
            work = pathlib.Path(tempfile.mkdtemp(prefix="ss-review-"))
            (work / "policy.md").write_text(base)
            summary = ""
            try:
                session = Session(
                    cwd=work,
                    config=SessionConfig(restrict_tools=["Edit"], autonomy=Autonomy.OFF),
                    interactions=InteractionHandlers(on_permission=_guard(work, rid)),
                )
                member_cases = [c for c in cases if c["member"] == mid]
                await store.review_step(rid, f"Reviewing {customer['member_name']}: {len(member_cases)} cases")
                async with session:
                    async with session.stream(PROMPT + f"\nCustomer note to edit: {customer['member_name']}. Member ID: {mid}.", files=[
                        Document.from_text(json.dumps(member_cases, indent=1), name="cases.json"),
                        Document.from_text(base, name="policy.md"),
                    ]) as stream:
                        async for ev in stream:
                            if tool := getattr(ev, "tool_name", None):
                                await store.review_step(rid, f"tool: {tool}")
                            elif isinstance(ev, AssistantMessage) and ev.text:
                                summary = ev.text
                new = (work / "policy.md").read_text()
                old_note, new_note = proposal_notes(base, new, customer["member_name"])
                _, parsed = parse_summary(summary, [customer])
                customer["summary"] = parsed[0]["summary"]
                if not customer["summary"]:
                    raise ValueError("Customer summary unavailable; run a new review.")
                customer["status"] = "proposed" if old_note != new_note else "no_change"
                if old_note != new_note:
                    _pending["proposals"][mid] = {"base": old_note, "new": new_note}
            except Exception:
                logger.exception("customer review failed")
                customer.update(status="failed", summary="This customer's review could not be completed. Run a new review.")
            finally:
                shutil.rmtree(work, ignore_errors=True)
            await store.review_set(rid, "running", customers=customers)
        await store.review_set(rid, _review_status(customers), customers=customers)
        return rid


def _review_status(customers: list[dict]) -> str:
    return "proposed" if any(c["status"] == "proposed" for c in customers) else "completed"


async def decide(approve: bool, review_id: str, member_id: str) -> str | None:
    """Apply only the selected member's note; unrelated proposals remain pending."""
    if _lock.locked():
        return "a review or decision is in progress; try again"
    async with _lock:
        if not _pending or _pending["review_id"] != review_id:
            return "this review is no longer available; run a new review"
        customer = next((c for c in _pending["customers"] if c["member_id"] == member_id), None)
        proposal = _pending["proposals"].get(member_id)
        if not customer or customer["status"] != "proposed" or not proposal:
            return "no proposal is waiting for this customer"
        if approve:
            try:
                updated = apply_note(POLICY.read_text(), customer["member_name"], proposal["base"], proposal["new"])
            except ValueError as e:
                return str(e)
            POLICY.write_text(updated)
        customer["status"] = "approved" if approve else "rejected"
        del _pending["proposals"][member_id]
        await store.review_set(review_id, _review_status(_pending["customers"]), customers=_pending["customers"])
        return None


def case_files(cases) -> list[dict]:
    """What Droid sees: outcome-labelled cases, no phone numbers or credit data."""
    return [{"merchant": c.merchant, "category": c.category, "amount": c.amount, "member": c.member_id,
             "triage_signals": c.signals, "triage_rationale": c.rationale, "outcome": c.status,
             "verified_on_call": c.verified, "red_flags_on_call": c.red_flags} for c in cases]


if __name__ == "__main__":
    import asyncio as _a
    from types import SimpleNamespace as NS

    w = pathlib.Path(tempfile.mkdtemp())
    (w / "policy.md").write_text("x")
    guard = _guard(w, "r1")
    opts = [NS(value=ToolConfirmationOutcome.PROCEED_ONCE), NS(value=ToolConfirmationOutcome.CANCEL)]

    def req(*actions):
        return PermissionRequest(actions=actions, options=opts)

    async def store_noop(*a, **k):
        pass

    store.review_step = store_noop
    tu = None
    edit = lambda p: EditAction(tool_use=tu, file_path=p, file_name=pathlib.Path(p).name)
    assert _a.run(guard(req(edit("policy.md")))).selected_option == ToolConfirmationOutcome.PROCEED_ONCE
    assert _a.run(guard(req(edit(str(w / "policy.md"))))).selected_option == ToolConfirmationOutcome.PROCEED_ONCE
    for bad in ("../policy.md", "/Users/x/second-signature/server/.env", "policy.md/../../gate.py", "other.md"):
        assert _a.run(guard(req(edit(bad)))).selected_option == ToolConfirmationOutcome.CANCEL, bad
    assert _a.run(guard(req(edit("policy.md"), edit("gate.py")))).selected_option == ToolConfirmationOutcome.CANCEL
    assert _a.run(guard(req())).selected_option == ToolConfirmationOutcome.CANCEL
    print("review guard ok")

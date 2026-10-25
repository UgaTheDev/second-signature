"""The books: every case outcome as a balanced double-entry journal entry.

A credit union's accounting team needs the night's holds to tie out. A paused payment leaves
the member's share draft balance and sits in a suspense account until the member or an analyst
decides; then it either settles to the card network or goes back to her. `entry()` is pure (the
smoke test checks it balances); `record()` writes it to the Convex journal and, when QuickBooks
keys are set, posts it there too. Without either it's only logged, like the rest of the case file.

Idempotent on `case:event`, so a restart or a double poll never books the same thing twice.
"""

import asyncio
import datetime

from loguru import logger

import quickbooks
import store

# key -> (number, name, type). Numbers follow a small credit union's GL; QuickBooks gets the names.
ACCOUNTS = {
    "shares": ("2100", "Member share drafts", "liability"),
    "suspense": ("2190", "Held card payments (suspense)", "liability"),
    "settlement": ("2200", "Card settlement payable", "liability"),
}

# event -> (debit, credit, what happened). Events are case-file action types, plus "allowed".
EVENTS = {
    "allowed": ("shares", "settlement", "Card purchase posted"),
    "hold": ("shares", "suspense", "Payment held for review"),
    "release": ("suspense", "settlement", "Hold released; payment settles"),
    "confirm_fraud": ("suspense", "shares", "Fraud confirmed; payment stopped and funds returned to member"),
}


def entry(case, event: str, by: str, when: datetime.date | None = None) -> dict | None:
    """The journal entry an event books, or None if it doesn't move money (calls, escalations)."""
    amt = round(float(case.amount), 2)
    if event not in EVENTS or amt <= 0:  # Scam Shield call cases carry no money
        return None
    dr, cr, what = EVENTS[event]
    memo = f"{what}: ${amt:,.2f} at {case.merchant}"
    return {
        "key": f"{case.id}:{event}",
        "caseId": case.id,
        "txn_id": case.txn_id,
        "event": event,
        "by": by,
        "date": (when or datetime.date.today()).isoformat(),
        "memo": memo,
        "lines": [
            {"account": ACCOUNTS[dr][0], "name": ACCOUNTS[dr][1], "debit": amt, "credit": 0.0},
            {"account": ACCOUNTS[cr][0], "name": ACCOUNTS[cr][1], "debit": 0.0, "credit": amt},
        ],
    }


def balanced(e: dict) -> bool:
    return round(sum(ln["debit"] for ln in e["lines"]), 2) == round(sum(ln["credit"] for ln in e["lines"]), 2)


async def record(case, event: str, by: str):
    """Book the event. Never raises: the books must never drop a hold or a call."""
    e = entry(case, event, by)
    if not e:
        return
    try:
        await store.journal(e)
        if quickbooks.enabled():
            asyncio.create_task(push(e))
    except Exception as ex:
        logger.error(f"books {e['key']}: {ex}")


async def push(e: dict):
    """Post one entry to QuickBooks and note its id (or the error) on the journal row."""
    try:
        ext = await quickbooks.post(e)
        await store.journal_posted(e["key"], "quickbooks", ext, "")
    except Exception as ex:
        logger.error(f"quickbooks {e['key']}: {ex}")
        await store.journal_posted(e["key"], "quickbooks", "", str(ex)[:300])


async def sync() -> int:
    """Post every journal entry QuickBooks doesn't have yet (startup, and the dashboard's Sync button)."""
    if not quickbooks.enabled():
        return 0
    pending = await store.journal_unposted()
    for e in pending:
        await push(e)
    return len(pending)

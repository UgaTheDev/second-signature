"""Event trigger for the Droid review: analysts overriding the agent.

Each time an analyst releases a hold the agent placed, that's a false positive the policy
may explain. After OVERRIDE_REVIEW_AT of them since the last review, a review starts right
away instead of waiting for 7am. Same Droid session, same guard, same human approval.
"""

import asyncio
import os

from loguru import logger

import store

THRESHOLD = int(os.getenv("OVERRIDE_REVIEW_AT", "3"))
_since_review: list[str] = []  # case ids released by an analyst since the last review


async def note(case) -> bool:
    """Record an analyst release. Returns True if it started a review."""
    _since_review.append(case.id)
    if len(_since_review) < THRESHOLD or not os.getenv("FACTORY_API_KEY"):
        return False
    import agent
    import review  # late: the Droid SDK is only needed when a review runs

    if review._lock.locked():
        return False
    ids = list(_since_review)
    _since_review.clear()
    await store.action(case.id, "review", "agent",
                       f"{len(ids)} analyst overrides since the last review; starting a Droid policy review now")
    asyncio.create_task(_run(review, review.case_files(agent.CASES.values())))
    return True


async def _run(review, cases):
    try:
        await review.run_review(cases, "overrides")
    except Exception as e:
        logger.error(f"override review: {e}")


def reset_count():
    """Any review (schedule, analyst, overrides) covers the overrides so far."""
    _since_review.clear()

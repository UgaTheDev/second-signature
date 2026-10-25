"""Validate customer summaries without attributing unknown model output to a member."""
import json


def parse_summary(text: str, customers: list[dict]) -> tuple[str, list[dict]]:
    try:
        result = json.loads(text.strip())
        if not isinstance(result, dict) or not isinstance(result.get("summary"), str):
            raise ValueError("invalid summary")
        rows = result.get("customers", [])
        if not isinstance(rows, list):
            raise ValueError("invalid customers")
        summaries = {r["member_id"]: r["summary"].strip() for r in rows
                     if isinstance(r, dict) and isinstance(r.get("member_id"), str)
                     and isinstance(r.get("summary"), str)}
        return result["summary"].strip(), [dict(c, summary=summaries.get(c["member_id"], "")) for c in customers]
    except (ValueError, TypeError):
        return "Customer summaries were unavailable. Run a new review before approving this proposal.", customers

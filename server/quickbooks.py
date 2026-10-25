"""QuickBooks Online: the journal entries from books.py, posted to a real general ledger.

Free Intuit developer sandbox. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REALM_ID and
QBO_REFRESH_TOKEN (from Intuit's OAuth 2.0 Playground, scope com.intuit.quickbooks.accounting).
Intuit rotates the refresh token on every use, so the newest one is kept in qbo_tokens.json
(gitignored) and wins until you paste a different one into .env.

The three GL accounts are created in the company on first use if they don't exist. Each entry
carries a DocNumber derived from its case and event, and is looked up before it's created, so a
retry never books it twice.
"""

import hashlib
import json
import os
import time
from pathlib import Path

import httpx

TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
TOKENS = Path(__file__).with_name("qbo_tokens.json")
MINOR = {"minorversion": "75"}
CODES = {"allowed": "A", "hold": "H", "release": "R", "confirm_fraud": "F"}

_http = httpx.AsyncClient(timeout=15)
_access: tuple[str, float] = ("", 0.0)  # (token, expires at)
_accounts: dict[str, str] = {}  # our account number -> QuickBooks Account.Id


def enabled() -> bool:
    return all(os.getenv(k) for k in ("QBO_CLIENT_ID", "QBO_CLIENT_SECRET", "QBO_REALM_ID", "QBO_REFRESH_TOKEN"))


def base() -> str:
    host = "quickbooks.api.intuit.com" if os.getenv("QBO_ENV") == "production" else "sandbox-quickbooks.api.intuit.com"
    return f"https://{host}/v3/company/{os.environ['QBO_REALM_ID']}"


def _refresh_token() -> str:
    seed = os.environ["QBO_REFRESH_TOKEN"]
    try:
        saved = json.loads(TOKENS.read_text())
        if saved.get("seed") == seed:  # same .env value as last time: use the rotated one
            return saved["refresh"]
    except (OSError, ValueError, KeyError):
        pass
    return seed


async def _token() -> str:
    global _access
    if _access[0] and time.time() < _access[1] - 60:
        return _access[0]
    r = await _http.post(TOKEN_URL, auth=(os.environ["QBO_CLIENT_ID"], os.environ["QBO_CLIENT_SECRET"]),
                         data={"grant_type": "refresh_token", "refresh_token": _refresh_token()},
                         headers={"Accept": "application/json"})
    if r.is_error:  # never echo the token, only Intuit's error code
        raise RuntimeError(f"QuickBooks sign-in failed ({r.status_code} {r.json().get('error', '') if r.content else ''}); "
                           "get a new refresh token from the OAuth Playground")
    t = r.json()
    TOKENS.write_text(json.dumps({"seed": os.environ["QBO_REFRESH_TOKEN"], "refresh": t["refresh_token"]}))
    TOKENS.chmod(0o600)
    _access = (t["access_token"], time.time() + t.get("expires_in", 3600))
    return _access[0]


async def _req(method: str, path: str, **kw) -> dict:
    h = {"Authorization": f"Bearer {await _token()}", "Accept": "application/json"}
    r = await _http.request(method, f"{base()}{path}", headers=h, params={**MINOR, **kw.pop("params", {})}, **kw)
    if r.is_error:
        try:
            err = r.json()["Fault"]["Error"][0]
            why = f"{err.get('Message', '')}: {err.get('Detail', '')}"
        except (ValueError, KeyError, IndexError, TypeError):
            why = r.text[:200]
        raise RuntimeError(f"QuickBooks {method} {path.split('?')[0]} {r.status_code}: {why}")
    return r.json()


async def query(q: str) -> dict:
    return (await _req("GET", "/query", params={"query": q})).get("QueryResponse", {})


async def company() -> str:
    """Company name, for preflight: proves the keys, the realm and the token all work."""
    realm = os.environ["QBO_REALM_ID"]
    return (await _req("GET", f"/companyinfo/{realm}"))["CompanyInfo"]["CompanyName"]


async def account_id(number: str, name: str) -> str:
    """Find our GL account by name, or create it as an Other Current Liability."""
    if number in _accounts:
        return _accounts[number]
    full = f"{number} {name}"
    found = (await query(f"select Id from Account where Name = '{full}'")).get("Account", [])
    if found:
        _accounts[number] = found[0]["Id"]
    else:
        made = await _req("POST", "/account", json={"Name": full, "AccountType": "Other Current Liability"})
        _accounts[number] = made["Account"]["Id"]
    return _accounts[number]


def doc_number(e: dict) -> str:
    """Stable and short (QuickBooks allows 21 characters): SS-<case hash>-<event>."""
    return f"SS-{hashlib.sha1(e['caseId'].encode()).hexdigest()[:8]}-{CODES.get(e['event'], 'X')}"


async def post(e: dict) -> str:
    """Create the JournalEntry (or find the one a previous try made). Returns its QuickBooks Id."""
    doc = doc_number(e)
    found = (await query(f"select Id from JournalEntry where DocNumber = '{doc}'")).get("JournalEntry", [])
    if found:
        return found[0]["Id"]
    lines = []
    for ln in e["lines"]:
        side = "Debit" if ln["debit"] else "Credit"
        lines.append({
            "Amount": ln["debit"] or ln["credit"],
            "Description": e["memo"][:4000],
            "DetailType": "JournalEntryLineDetail",
            "JournalEntryLineDetail": {"PostingType": side, "AccountRef": {"value": await account_id(ln["account"], ln["name"])}},
        })
    body = {"DocNumber": doc, "TxnDate": e["date"], "PrivateNote": f"Second Signature case {e['caseId']} ({e['event']} by {e['by']})",
            "Line": lines}
    return (await _req("POST", "/journalentry", json=body,
                       params={"requestid": hashlib.sha1(e["key"].encode()).hexdigest()}))["JournalEntry"]["Id"]

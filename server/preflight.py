"""Preflight before a live demo: is every key set, and does every service answer?

    uv run python preflight.py          # read-only checks, no calls placed, no money moved
    uv run python preflight.py --crs    # also log in to CRS once (repeated FAILED logins lock the account)

Prints one line per check and exits 1 if anything required fails. Never prints a secret.
"""

import asyncio
import os
import re
import shutil
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(override=True)

REQUIRED = ["ANTHROPIC_API_KEY", "CARTESIA_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_NUMBER",
            "LOCAL_SERVER_URL", "MEMBER_PHONE", "FAMILY_PHONE", "NESSIE_KEY", "CRS_USERNAME", "CRS_PASSWORD",
            "CONVEX_URL", "CONVEX_WRITE_SECRET", "ANALYST_TOKEN"]
OPTIONAL = ["CARTESIA_VOICE_ID", "ROBERT_PHONE", "SHIELD_NUMBER", "APIFY_TOKEN", "APIFY_ACTOR", "ELASTIC_URL",
            "ELASTIC_API_KEY", "FACTORY_API_KEY", "DEEPGRAM_API_KEY"]

results: list[tuple[str, bool | None, str]] = []  # (name, ok / None = skipped, detail)


def note(name: str, ok: bool | None, detail: str = ""):
    # httpx errors quote the whole URL, and Apify/Nessie take their key in the query string
    detail = re.sub(r"((?:token|key|api_key|apikey)=)[^&\s']+", r"\1***", detail, flags=re.I)
    results.append((name, ok, detail))


async def check(name: str, fn, required: bool = True):
    try:
        detail = await fn()
        note(name, True, detail or "")
    except Exception as e:
        note(name if required else f"{name} (optional)", False if required else None, str(e)[:160])


async def anthropic_():
    import anthropic

    page = await anthropic.AsyncAnthropic().models.list(limit=1)
    return f"key works ({len(page.data)} model listed)"


async def cartesia(http):
    h = {"X-API-Key": os.environ["CARTESIA_API_KEY"], "Cartesia-Version": "2025-04-16"}
    vid = os.getenv("CARTESIA_VOICE_ID")
    r = await http.get(f"https://api.cartesia.ai/voices/{vid}" if vid else "https://api.cartesia.ai/voices", headers=h)
    r.raise_for_status()
    return f"voice {r.json().get('name', vid)}" if vid else "key works (default voice)"


async def twilio(http):
    sid, tok = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    r = await http.get(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers.json", auth=(sid, tok))
    r.raise_for_status()
    nums = {n["phone_number"]: n for n in r.json().get("incoming_phone_numbers", [])}
    out = []
    want = f"{os.environ['LOCAL_SERVER_URL'].rstrip('/')}/twiml"
    for env in ("TWILIO_NUMBER", "SHIELD_NUMBER"):
        num = os.getenv(env)
        if not num:
            continue
        if num not in nums:
            raise RuntimeError(f"{env} {num} is not a number on this Twilio account")
        if nums[num].get("voice_url") != want:
            raise RuntimeError(f"{env} voice webhook is {nums[num].get('voice_url')!r}, should be {want!r} (POST)")
        out.append(f"{env} webhook ok")
    return ", ".join(out)


async def nessie(http):
    r = await http.get("https://api.nessieisreal.com/customers", params={"key": os.environ["NESSIE_KEY"]})
    r.raise_for_status()
    from members import seed

    seeded = seed()["members"]
    if not seeded:
        raise RuntimeError("key works but seed_ids.json is missing: run `uv run seed.py`")
    return f"{len(r.json())} customers, seeded: {', '.join(seeded)}"


async def convex(http):
    # Convex's HTTP query API; the Python client can retry a bad URL for minutes
    r = await http.post(f"{os.environ['CONVEX_URL'].rstrip('/')}/api/query", json={"path": "cases:stats", "args": {}})
    r.raise_for_status()
    j = r.json()
    if j.get("status") != "success":
        raise RuntimeError(f"cases:stats {j.get('errorMessage', j)} (run `npx convex dev` to deploy the functions)")
    return f"functions deployed, {j['value']['total']} cases"


async def server(http):
    r = await http.get(f"{os.environ['LOCAL_SERVER_URL'].rstrip('/')}/health", headers={"ngrok-skip-browser-warning": "1"})
    r.raise_for_status()
    j = r.json()
    if not j.get("analyst_auth"):
        raise RuntimeError("server is up but ANALYST_TOKEN isn't set there: analyst routes are open")
    return f"up through the tunnel, {j['cases']} cases loaded"


async def crs():
    import crs as c

    await c._login()
    return "login ok"


async def elastic():
    from elasticsearch import AsyncElasticsearch

    es = AsyncElasticsearch(os.environ["ELASTIC_URL"], api_key=os.environ["ELASTIC_API_KEY"])
    try:
        info = await es.info()
        return f"version {info['version']['number']}"
    finally:
        await es.close()


async def apify(http):
    actor = os.environ["APIFY_ACTOR"].replace("/", "~")
    r = await http.get(f"https://api.apify.com/v2/acts/{actor}/runs/last", params={"token": os.environ["APIFY_TOKEN"]})
    r.raise_for_status()
    return f"last run {r.json()['data']['status']}"


async def factory():
    if not os.getenv("FACTORY_API_KEY"):
        raise RuntimeError("FACTORY_API_KEY not set")
    if not shutil.which("droid"):
        raise RuntimeError("droid CLI not on PATH")
    return "key set, droid CLI found"


async def main(with_crs: bool) -> int:
    missing = [k for k in REQUIRED if not os.getenv(k)]
    note("required env", not missing, f"missing: {', '.join(missing)}" if missing else f"all {len(REQUIRED)} set")
    unset = [k for k in OPTIONAL if not os.getenv(k)]
    note("optional env", None if unset else True, f"not set: {', '.join(unset)}" if unset else "all set")
    async with httpx.AsyncClient(timeout=15) as http:
        have = lambda *ks: all(os.getenv(k) for k in ks)
        checks = [
            ("Anthropic", anthropic_, have("ANTHROPIC_API_KEY"), True),
            ("Cartesia", lambda: cartesia(http), have("CARTESIA_API_KEY"), True),
            ("Twilio", lambda: twilio(http), have("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "LOCAL_SERVER_URL"), True),
            ("Nessie", lambda: nessie(http), have("NESSIE_KEY"), True),
            ("Convex", lambda: convex(http), have("CONVEX_URL"), True),
            ("Server via ngrok", lambda: server(http), have("LOCAL_SERVER_URL"), True),
            ("CRS", crs, with_crs and have("CRS_USERNAME", "CRS_PASSWORD"), True),
            ("Elastic", elastic, have("ELASTIC_URL", "ELASTIC_API_KEY"), False),
            ("Apify", lambda: apify(http), have("APIFY_TOKEN", "APIFY_ACTOR"), False),
            ("Factory", factory, True, False),
        ]
        for name, fn, ready, required in checks:
            if ready:
                await check(name, fn, required)
            else:
                note(name, None, "skipped (" + ("pass --crs" if name == "CRS" else "keys not set") + ")")
    for name, ok, detail in results:
        print(f"{'ok  ' if ok else '--  ' if ok is None else 'FAIL'} {name:<18} {detail}")
    failed = [n for n, ok, _ in results if ok is False]
    print("\nready for a live run" if not failed else f"\n{len(failed)} required check(s) failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main("--crs" in sys.argv)))

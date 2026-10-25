"""Estate desk: close a deceased member's books against a Treasury reclamation (FS-133).

Pure arithmetic over estates.json: which death date to trust, which claimed payments were
not due or already returned (R15), what the credit union returns now from the balance on
hand, and what it is liable for. The model only ever explains this output, never computes it.
"""

import json
import pathlib
from datetime import date, timedelta

DATA = pathlib.Path(__file__).with_name("estates.json")
MATERIALITY = 250.0  # losses over this need the controller's signature
KIND_LABEL = {"certificate": "Death certificate", "rep_note": "Rep's note", "dne": "Treasury death notice (DNE)",
              "crs": "Credit bureau deceased flag", "card_activity": "Card used", "family_call": "Family called the credit union"}

# Cites as verified in docs/RECLAMATION.md. "Institution policy" = sensible choice, no CFR behind it.
R_DOD = "Institution policy: the state death certificate (primary vital record) controls the date of death over DNE/CRS"
R_PRE = "31 CFR 210.10(a); CRS 93-792 (received before death: not a post-death payment; SSA pays in arrears, so it was due)"
R_RETURN = "31 CFR 210.10(a), 210.11(a)(1) (return the lesser of the outstanding total and the balance on hand, within one business day of the notice)"
R_PROTEST = "31 CFR 210.2(n), 210.10(a) (dispute items not received after death or already returned to the Government)"
R_R15 = "31 CFR 210.2(n); Nacha R15 (already returned: excluded from the outstanding total by definition)"
R_KNOW = "31 CFR 210.10(a)-(b) (actual or constructive knowledge, by whatever means: liable for every post-death payment received after it; the 210.11 limit does not apply)"
R_45 = "31 CFR 210.11(a)(2),(c) (no prior knowledge: debited the lesser of the 45-day amount and the unrecovered outstanding total, only if Treasury cannot collect from the withdrawers)"
R_ALIVE = "Institution policy: an in-person, ID-checked transaction after the reported date of death rebuts the DNE; answer 'recipient alive'"
R_WD = "31 CFR 210.11(b)(3)(i) (name, address and phone of the recipient, co-owners, authorised withdrawers and anyone who withdrew after death; certify what is unknown)"
R_60 = "Green Book ch.5 via SSA POMS GN 02408.635 (the response must reach Treasury within 60 days of the notice date, or Treasury debits the full claim)"

SHARES, DUE, LOSS, CASH = "Member shares - joint", "Due to US Treasury (reclamation)", "Reclamation loss expense", "Cash - Federal Reserve settlement"


def load() -> list[dict]:
    return json.loads(DATA.read_text())["estates"]


def _d(s: str) -> date:
    return date.fromisoformat(s)


def _m(x: float) -> float:
    return round(x + 0.0, 2)


def _usd(x: float) -> str:
    return f"${x:,.2f}"


def _liability(valid: list[dict], shortfall: float, dod: date, know: date | None) -> tuple[float, str]:
    """210.10: everything received after knowledge; 210.11: before knowledge, only the 45-day amount. Never more than the shortfall."""
    after = lambda d: know and _d(d["date"]) > know
    post_know = sum(d["amount"] for d in valid if after(d))
    d45 = sum(d["amount"] for d in valid if not after(d) and _d(d["date"]) <= dod + timedelta(days=45))
    amt = _m(min(shortfall, post_know + d45))
    if not amt:
        return 0.0, "none"
    return amt, "knowledge" if post_know else "limited_45_day"


def compute(e: dict, ignore: tuple[str, ...] = ()) -> dict:
    """`ignore`: source kinds to pretend never happened (the "what if no rep note" counterfactual)."""
    srcs = [s for s in e["sources"] if s["kind"] not in ignore]
    deps = {d["id"]: d for d in e["deposits"]}
    fs = e["fs133"]
    claimed_deps = [deps[i] for i in fs["claimed"]]
    findings: list[dict] = []
    out_src: dict[str, dict] = {}

    certs = [s for s in srcs if s["kind"] == "certificate"]
    reports = [s for s in srcs if s["kind"] in ("dne", "crs") and s.get("dod")]
    reported = min((_d(s["dod"]) for s in reports), default=None)
    alive = next((s for s in srcs if s["kind"] == "card_activity" and s.get("in_person") and reported and _d(s["date"]) > reported), None)

    if alive and not certs:
        dod = know = None
        dod_src = know_src = None
        for s in srcs:
            if s["kind"] in ("dne", "crs"):
                out_src[s["id"]] = {"trusted": False, "why": f"contradicted by in-person activity {alive['date']} ({alive['id']})"}
        out_src[alive["id"]] = {"trusted": True, "why": "chip+PIN, in person, ID checked: the member is alive"}
        findings.append({"text": f"{alive['id']}: {e['deceased']['name']} transacted in person on {alive['date']}, after the reported death {reported}. Answer FS-133 {fs['id']} 'recipient alive'; do not freeze; return nothing.", "rule": R_ALIVE})
        not_due = [{"id": d["id"], "amount": d["amount"], "why": "recipient alive"} for d in claimed_deps]
        decision = "recipient_alive"
    else:
        best = certs[0] if certs else next((s for s in srcs if s["kind"] == "dne"), reports[0] if reports else None)
        dod, dod_src = _d(best["dod"]), best["id"]
        for s in srcs:
            if s["kind"] in ("certificate", "dne", "crs") and s.get("dod"):
                if s is best:
                    out_src[s["id"]] = {"trusted": True, "why": "state death certificate controls the date of death" if s["kind"] == "certificate" else "no certificate on file; best available report"}
                elif _d(s["dod"]) == dod:
                    out_src[s["id"]] = {"trusted": True, "why": f"agrees with {dod_src}"}
                else:
                    out_src[s["id"]] = {"trusted": False, "why": f"says {s['dod']}; {dod_src} says {dod}, and the certificate controls"}
                    findings.append({"text": f"{s['id']} ({s['kind'].upper()}) gives date of death {s['dod']}; {dod_src} gives {dod}. Using {dod}.", "rule": R_DOD})
        # ponytail: only deposits received on or before death are "not due". A post-death deposit that pays the month
        # before death is still reclaimable (SSA reissues it to the estate as an underpayment), so no benefit-month test.
        not_due = []
        for d in claimed_deps:
            if _d(d["date"]) <= dod:
                not_due.append({"id": d["id"], "amount": d["amount"], "why": f"received {d['date']}, before death on {dod}: not a post-death payment"})
                findings.append({"text": f"{d['id']} ({_usd(d['amount'])}) was received {d['date']}, before death on {dod}: not a post-death payment, so Treasury cannot reclaim it. Protest it.", "rule": R_PRE})
        decision = None

    nd_ids = {x["id"] for x in not_due}
    already = [{"id": d["id"], "amount": d["amount"], "why": "returned R15 after the DNE"} for d in claimed_deps if d["returned_r15"] and d["id"] not in nd_ids]
    for a in already:
        findings.append({"text": f"{a['id']} ({_usd(a['amount'])}) was already returned R15; Treasury claimed it again on {fs['id']}. Protest it.", "rule": R_R15})
    gone = nd_ids | {a["id"] for a in already}
    valid = [d for d in claimed_deps if d["id"] not in gone]
    claimed = _m(fs["total"])
    valid_claim = _m(claimed - sum(x["amount"] for x in not_due) - sum(a["amount"] for a in already))
    on_hand = _m(e["account"]["balance_at_notice"])

    if decision == "recipient_alive":
        return_now = shortfall = cu_liability = 0.0
        basis, withdrawers, liab_no_note = "none", [], 0.0
    else:
        decision = "return_and_protest" if gone else "return_in_full"
        return_now = _m(min(valid_claim, on_hand))
        shortfall = _m(valid_claim - return_now)
        cands = [(_d(s.get("received") or s["date"]), s) for s in srcs if s["kind"] in ("rep_note", "family_call", "dne")]
        cands.sort(key=lambda c: c[0])
        know, ks = cands[0] if cands else (None, None)
        know_src = ks["id"] if ks else None
        for _, s in cands:
            why = "earliest record of the death: sets the knowledge date" if s is ks else f"received {s.get('received') or s['date']}; {know_src} came earlier"
            prev = out_src.get(s["id"])
            out_src[s["id"]] = {"trusted": prev["trusted"], "why": f"{prev['why']}; {why}"} if prev else {"trusted": True, "why": why}
        cu_liability, basis = _liability(valid, shortfall, dod, know)
        withdrawers = list(dict.fromkeys(w["by"] for w in e["withdrawals"] if _d(w["date"]) > dod))
        co_owners = [n for n in e["account"]["owner_names"] if n != e["deceased"]["name"]]
        findings.append({"text": f"FS-133 {fs['id']} claims {_usd(claimed)}; valid claim {_usd(valid_claim)}. Return {_usd(return_now)} now (balance on hand when the notice arrived {fs['received']}: {_usd(on_hand)}).", "rule": R_RETURN})
        if gone:
            findings.append({"text": f"Protest {_usd(_m(claimed - valid_claim))} of the claim.", "rule": R_PROTEST})
        if shortfall:
            if basis == "knowledge":
                findings.append({"text": f"{know_src} recorded the death on {know}, before the post-death payments posted. The CU had actual knowledge: it is liable for all post-death payments received after {know} that it cannot return, {_usd(cu_liability)} of the {_usd(shortfall)} shortfall, and cannot use the 45-day limit.", "rule": R_KNOW})
            elif basis == "limited_45_day":
                findings.append({"text": f"No record of the death before {know} ({know_src}). Treasury first collects the {_usd(shortfall)} shortfall from the withdrawers; only if it cannot is the CU debited the lesser of the 45-day amount (payments to {dod + timedelta(days=45)}) and the shortfall: {_usd(cu_liability)}.", "rule": R_45})
            rest = _m(shortfall - cu_liability)
            if rest:
                findings.append({"text": f"Remaining {_usd(rest)} is Treasury's to recover from the withdrawers: {', '.join(withdrawers) or 'none on file'}.", "rule": R_WD})
        findings.append({"text": f"Name on the response, with last known address and phone: recipient {e['deceased']['name']}; co-owner(s): {', '.join(co_owners) or 'none'}; withdrew after {dod}: {', '.join(withdrawers) or 'none'}; no other authorised signer on file (certify).", "rule": R_WD})
        findings.append({"text": f"Respond so Treasury receives it by {_d(fs['received']) + timedelta(days=60)}; no response means Treasury debits the full {_usd(claimed)}.", "rule": R_60})
        liab_no_note = cu_liability
        if any(s["kind"] in ("rep_note", "family_call") for s in srcs) and not ignore:
            liab_no_note = compute(e, ignore=("rep_note", "family_call"))["cu_liability"]
            if liab_no_note != cu_liability:
                findings.append({"text": f"Without {know_src} ({know}) the CU's exposure would be the 45-day amount, {_usd(liab_no_note)}. The note costs the CU {_usd(_m(cu_liability - liab_no_note))}.", "rule": R_45})

    journal = []
    if return_now:
        journal += [
            {"account": SHARES, "dr": return_now, "cr": 0.0, "memo": f"Return post-death SSA funds on hand to Treasury, {fs['id']}", "source": fs["id"]},
            {"account": DUE, "dr": 0.0, "cr": return_now, "memo": f"Reclamation payable, balance on hand {fs['received']}", "source": R_RETURN},
        ]
    if cu_liability:
        journal += [
            {"account": LOSS, "dr": cu_liability, "cr": 0.0, "memo": f"CU liability, basis {basis}", "source": R_KNOW if basis == "knowledge" else R_45},
            {"account": DUE, "dr": 0.0, "cr": cu_liability, "memo": "Reclamation payable, CU share of shortfall", "source": know_src or fs["id"]},
        ]
    if return_now or cu_liability:
        total = _m(return_now + cu_liability)
        journal += [
            {"account": DUE, "dr": total, "cr": 0.0, "memo": f"Settle {fs['id']}", "source": fs["id"]},
            {"account": CASH, "dr": 0.0, "cr": total, "memo": "Debit via Federal Reserve settlement", "source": R_RETURN},
        ]

    for s in srcs:
        out_src.setdefault(s["id"], {"trusted": True, "why": "consistent with the record"})
    timeline = [{"date": d["date"], "label": f"SSA deposit {_usd(d['amount'])}" + (" (returned R15)" if d["returned_r15"] else ""), "kind": "deposit"} for d in e["deposits"]]
    timeline += [{"date": w["date"], "label": f"Withdrawal {_usd(w['amount'])} by {w['by']}", "kind": "withdrawal"} for w in e["withdrawals"]]
    timeline += [{"date": s.get("received") or s["date"], "label": f"{KIND_LABEL.get(s['kind'], s['kind'])} ({s['id']})", "kind": s["kind"]} for s in srcs]
    timeline.append({"date": fs["received"], "label": f"FS-133 {fs['id']} received, claims {_usd(claimed)}", "kind": "fs133"})
    if dod:
        timeline.append({"date": str(dod), "label": "Date of death", "kind": "death"})
    if know:
        timeline.append({"date": str(know), "label": f"CU knew ({know_src})", "kind": "knowledge"})
    timeline.sort(key=lambda t: t["date"])

    return {
        "key": e["key"], "name": e["deceased"]["name"], "decision": decision,
        "date_of_death": str(dod) if dod else None, "dod_source": dod_src,
        "knowledge_date": str(know) if know else None, "knowledge_source": know_src,
        "claimed": claimed, "not_due": not_due, "already_returned": already, "valid_claim": valid_claim,
        "on_hand": on_hand, "return_now": return_now, "shortfall": shortfall,
        "cu_liability": cu_liability, "liability_basis": basis, "liability_without_note": liab_no_note,
        "withdrawers": withdrawers,
        "sources": [{"id": s["id"], "kind": s["kind"], "says": s["says"], **out_src[s["id"]]} for s in srcs],
        "findings": findings, "journal": journal, "needs_controller": cu_liability > MATERIALITY, "timeline": timeline,
    }


def score() -> tuple[int, int]:
    key = json.loads(DATA.read_text())["answer_key"]
    ok = 0
    for e in load():
        r, want = compute(e), key[e["key"]]
        got = {**{k: r[k] for k in ("date_of_death", "knowledge_date", "decision", "return_now", "cu_liability")},
               "protest_amount": _m(r["claimed"] - r["valid_claim"])}
        ok += all(got[k] == want[k] for k in want)
    return ok, len(key)


if __name__ == "__main__":
    for e in load():
        r = compute(e)
        assert round(sum(j["dr"] for j in r["journal"]), 2) == round(sum(j["cr"] for j in r["journal"]), 2), r["journal"]
        assert all(j["memo"] and j["source"] for j in r["journal"])
    h = compute(load()[0])
    assert (h["claimed"], h["valid_claim"], h["return_now"], h["shortfall"], h["cu_liability"]) == (4180, 3135, 535, 2600, 2600), h
    assert h["liability_basis"] == "knowledge" and h["needs_controller"] and h["withdrawers"] == ["Dolores Whitcomb"]
    assert h["knowledge_date"] == "2026-03-20" and h["liability_without_note"] == 1045
    assert not h["not_due"] and [a["id"] for a in h["already_returned"]] == ["dep-hw-0703"]
    by = {r["key"]: r for r in map(compute, load())}
    assert by["margaret"]["liability_basis"] == "limited_45_day" and by["eleanor"]["liability_basis"] == "none"
    assert [x["id"] for x in by["george"]["not_due"]] == ["dep-gp-0422"] and by["george"]["liability_basis"] == "knowledge"
    assert score() == (5, 5), score()
    print("estate ok")

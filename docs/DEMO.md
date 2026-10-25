# Demo script (under 2 minutes)

**Two people want Harold's money: a scammer and the US Treasury. Only one of them is owed it.**

Three beats, opening on the whisper. Three people: **Dolores** (a teammate's phone, MEMBER_PHONE), **the scammer**
(another teammate), **Susan**, Harold's daughter and executor (third phone, FAMILY_PHONE). Dashboard on the big screen.

## Before judging (10 minutes)

1. `uv run python preflight.py --crs`: every line ok. `uv run python estate.py`: prints `estate ok` (5/5).
2. Dashboard: click the key icon in the header and enter the passcode, then Reset demo (clears cases and estates).
3. `uv run python arena.py -n 3 --publish` and `uv run python arena.py --shield -n 3 --publish` (a few cents), so the
   Proof view's scoreboard is fresh.
4. Dashboard on the **Scam Shield** view (a cold load opens there). Phones charged, ringers on, loud.
5. Dolores's teammate knows her verification answers from the CRS test identity. They are not written here.

## The run

| Time | Click / on the phone | Say |
|---|---|---|
| 0:00 | Scammer calls Dolores's protected line (SHIELD_NUMBER). Consent notice plays. | "Harold Whitcomb died in March. His widow Dolores is 74. Two people want his money: a scammer and the US Treasury. Only one of them is owed it." |
| 0:10 | Scammer: "I'm with collections. Harold left debts, and you're responsible. Pay today in gift cards, and don't call your bank." | — |
| 0:20 | Dolores hears the chime and the whisper; the scammer doesn't. The **Scam Shield** view fills in with his exact words. | "Only she heard that. He has no idea. For 24 hours, any gift card she buys is held for a human." |
| 0:35 | Sidebar: **Estate desk**. Click **Run estate desk**, then the **Harold** tab. | "Now the creditor who really is owed something: Treasury wants back the Social Security that kept arriving after he died." |
| 0:45 | Point at **Sources** (death certificate, the rep's March 20 note, CRS, card, DNE), then the **Timeline**. | "Five sources disagree about when he died and when we knew. The certificate decides the date. The rep's note decides when we knew." |
| 0:55 | Point at **Reclamation**: claimed $4,180, already returned (R15) $1,045, return now $535, liability $2,600. | "We protest the $1,045 we already sent back. We return the $535 on hand. We owe the other $2,600, because a rep wrote down on March 20 that he had died. Without that note it's capped at $1,045. That note cost $1,555." |
| 1:10 | Click **Why?** | "Claude explains it, and every sentence cites a source or a rule. It never computes a number." |
| 1:20 | Click **Sign as controller**, confirm. Journal shows posted. | "The agent drafted the entries. Only the controller can sign them." |
| 1:30 | Click **Call Dolores**. Her phone rings: Cartesia voice, she verifies, it explains gently. It offers Susan; she says yes. | "The real repayment is between us and Treasury. She owes the scammer nothing. And she isn't alone with this." |
| 1:50 | — | "Five estates with planted errors: 5 of 5. Second Signature drafts; a human signs. It can never move money on its own." |

## If a judge brings their own scenario

That is the original overnight loop, now the **Overnight holds** view. Click **Run a scenario** in its toolbar.
Robert buys gift cards every year, so a $100 one is let through, while the same purchase for Dolores is held by rule
and her phone rings for a verification call. A $1,500 bike for Dolores: verified on the call, but over the limit, so an
analyst decides. **Cinema mode** (same toolbar) shows the live call full-screen. **Morning review** runs a Droid policy
review; **Proof** has the permission matrix and the arena scoreboard.

## If something breaks

- No phone call: the estate desk and the case file still show everything; narrate from the dashboard.
- CRS down: she gets no questions and the call ends without discussing the account. That's the designed failure, so say so.
- "Why?" fails: a template explanation from the same numbers appears instead.
- Triage down (Overnight holds): everything is held by default. Also designed.

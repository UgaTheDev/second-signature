# Demo script (2 minutes)

Opens with the moment, per Hyphenate and Cartesia. Three people: **Dolores** (a teammate's phone, MEMBER_PHONE),
**the scammer** (another teammate), **Susan** (third phone, FAMILY_PHONE). Dashboard on the big screen.

## Before judging (10 minutes)

1. `uv run python preflight.py --crs`: every line ok.
2. Dashboard: Reset, then click the key icon in the header and enter the passcode.
3. `uv run python arena.py -n 3 --publish` and `uv run python arena.py --shield -n 3 --publish` (a few cents), so the
   scoreboard is fresh.
4. Phones charged, ringers on, loud.

## The run

| Time | On screen / on the phone | Say |
|---|---|---|
| 0:00 | Scammer calls Dolores's protected line (SHIELD_NUMBER). Consent notice plays. | "Dolores is 74 and lives alone. A scammer calls her. Watch." |
| 0:10 | Scammer: "This is Microsoft... buy gift cards... don't tell your bank." | — |
| 0:20 | Dolores hears the whisper; the scammer doesn't. Case appears on the dashboard with the quote. | "Only she heard that. He has no idea." |
| 0:30 | Judge Scenario form: Dolores, Target, gift_card, $500. Held by rule. | "She goes to buy the cards anyway. Held, and only a human can release it." |
| 0:40 | Her phone rings: Cartesia voice, verification questions from her CRS credit file. | "Questions come from her credit file. The bot never sees the answers." |
| 1:00 | She mentions secrecy. Agent offers to connect her with Susan. She says yes. Susan joins; agent leaves. | "Scams work by isolating her. We do the opposite." |
| 1:20 | Dashboard: case file, gate refusals, night stats, arena scoreboard. | "Every action is logged with who did it. The gate refused [N] things tonight." |
| 1:35 | Kill the server, restart it. The case reloads with a `resume` line. Click Confirm fraud. | "It recovers. And the analyst makes the final call." |
| 1:45 | Policy review tab, Run a review now: Droid's steps stream, a policy diff waits for Approve. | "In the morning, Droid reads the night and proposes a policy change. A human approves it." |
| 1:55 | — | "Second Signature: the overnight fraud analyst a small credit union can't afford." |

## If a judge brings their own scenario

Use the Judge Scenario form. Robert buys gift cards every year, so a $100 one is let through, while the same purchase
for Dolores is held by rule. A $1,500 bike for Dolores: verified on the call, but over the limit, so an analyst decides.

## If something breaks

- No phone call: the case file still shows the hold and a logged `error` line; narrate from the dashboard.
- CRS down: she gets no questions and the call escalates. That's the designed failure, so say so.
- Triage down: everything is held by default. Also designed.

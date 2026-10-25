# Second Signature: Devpost submission

## Tagline

An AI fraud analyst for small credit unions: it holds a suspicious payment, calls the older member in a calm voice, and can never move money on its own.

**The seat it fills:** the overnight fraud analyst a small credit union can't afford to staff.

Live dashboard: https://second-signature-omega.vercel.app · Code: https://github.com/UgaTheDev/calhacks-winners-ouuu

## Inspiration

Small credit unions serve the members most targeted by elder-fraud scams, and nobody watches from 6pm to 8am. Big banks have fraud desks; small credit unions don't. Scams work by urgency, secrecy and isolation: "don't tell the bank, don't tell your daughter." We wanted an agent trusted for what it can't do.

## What it does

A scammer from "Microsoft" calls Dolores, 74, and tells her to buy gift cards and keep quiet. Mid-call she hears, and he doesn't, a soft chime, then: "Dolores, it's your credit union. You don't need to answer me. This sounds like a scam. It's okay to hang up." She buys the gift cards anyway. The purchase is held by rule, even though triage was coached into "allow." A Cartesia voice calls and verifies her from her CRS credit file. She mentions secrecy; the agent offers to connect her daughter Susan. She says yes, and the agent leaves the line. An analyst reads the case file and makes the final call.

- **Code floor:** a first-ever gift card, wire or crypto purchase is held whatever the model says; only an analyst releases it.
- **Triage:** Claude cites signals from CRS, Elastic and FTC alerts. Any failure means hold.
- **Case file:** every action and refusal logged with who and why; survives a restart.
- **Morning review:** a Factory Droid proposes a policy diff a human approves.

## How we built it

- **Bank:** Capital One Nessie, polled every 2 seconds.
- **Identity:** CRS sandbox identity and credit file.
- **Triage:** Claude Opus 5.5, Elastic history, FTC alerts from our Apify actor.
- **Safety:** `gate.py`, permission matrix and code floor.
- **Voice:** Twilio, Pipecat, Cartesia Ink → Claude Haiku 5.5 → Cartesia Sonic.
- **Record:** Convex case file, Next.js dashboard.
- **Policy:** Factory Droid SDK.

## Challenges we ran into

- **Keeping the agent unable to move money.** Rules live in `gate.py`, not the prompt; the bot never sees verification answers.
- **The arena found two holes.** A coached victim could release her own first-ever gift card; code-floor holds now need an analyst. And a scammer who knew Dolores's city guessed through verification, because the real street was the only local option. Decoys are now local streets and household-name banks.
- **Locking down Droid.** SDK reads aren't permission-gated, so a Read tool could reach `.env`. Droid gets only Edit, on a copy of `policy.md`.

## Accomplishments that we're proud of

Arena 30/30 passed. Scam Shield caught 15/15 scams with 0/15 false alarms. Kill the server mid-case and it resumes with the gate as strict as before.

## What we learned

Defences belong in code, not the prompt. A red-team arena graded from the gate's case state, with no judge model, finds holes a demo misses.

## What's next

A core banking feed instead of Nessie, holds sent to the card processor, per-analyst SSO, and the arena in CI on every prompt or policy change.

## Built with

Python, Claude Opus 5.5, Claude Haiku 5.5, Cartesia Sonic, Cartesia Ink, Pipecat, Twilio, CRS, Capital One Nessie, Elastic, Apify, Factory Droid SDK, Convex, Next.js, Vercel

## Track fit

**Hyphenate: Autonomous Systems for Finance.** Limited access (`gate.py`), a clean record (Convex case file), knowing when to ask ($1,000+, first-ever gift cards/wires/crypto, red flags, failed verification), and the moment: the whisper, then the held purchase.

**CRS Financial Intelligence.** CRS decides how the call goes: identity messages decide whether verification is allowed and how strict; questions come from her credit file and answers never leave `verify.py`. Fraud Finder scores flow into triage.

**Cartesia.** Voice is the product: every call, the bridge intro and the whisper. Sonic at `speed=0.9`, `emotion="content"` for older listeners; Ink with per-call keyterms so a one-try answer isn't misheard.

**Also:** Factory (one editable file, human-approved diff), Convex (case file, restart recovery), Meta (the family bridge), Armadin (arena attacks), Microsoft (path to production), Apify (FTC alerts), Elastic (her history), Nessie (the bank), Anthropic (Opus triage, Haiku calls, the arena).

## Proof it works

- **Red-team arena:** 30/30 passed. 0 of 21 scams or attacks released or verified; 9 of 9 legitimate calls with the right outcome.
- **Scam Shield:** 15/15 caught, 0/15 false alarms at threshold 0.75 (10 labelled scripts, 3 runs each).

| Real | Simulated |
|---|---|
| Phone calls (Twilio), voice and STT (Cartesia), reasoning (Claude) | The credit union, and Dolores (CRS test identity P20) |
| CRS sandbox calls against test identities | Nessie is Capital One's sandbox bank, not a real core |
| FTC scam alerts, scraped live by our Apify actor | The scammer (a teammate) |
| Holds, the code floor and the permission gate, enforced in our code | Holds don't reach a card network |

## Demo video shot list (2:00)

| Time | Shot |
|---|---|
| 0:00 | Scammer on Dolores's protected line: "This is Microsoft... buy gift cards... don't tell your bank." |
| 0:20 | Dolores hears the whisper; he doesn't. Case appears on the dashboard with the quote. |
| 0:30 | Judge Scenario: Dolores, Target, gift card, $500. Held by rule. |
| 0:40 | Her phone rings: Cartesia voice, questions from her CRS credit file. |
| 1:00 | She mentions secrecy; agent offers Susan; Susan joins, agent leaves. |
| 1:20 | Dashboard: case file, gate refusals, arena scoreboard. |
| 1:35 | Restart the server; case resumes. Analyst clicks Confirm fraud. |
| 1:45 | Policy review: Droid's steps stream, a diff waits for Approve. |
| 1:55 | "Second Signature: the overnight fraud analyst a small credit union can't afford." |

# Second Signature: Devpost submission

## Tagline

Two people want Harold's money: a scammer and the US Treasury. Only one is owed it. An AI back office that tells them apart, and never moves money on its own.

**The seat it fills:** the back office a small credit union can't afford to staff: the estate desk and the night fraud analyst.

Live dashboard: https://second-signature-ai.vercel.app · Code: https://github.com/UgaTheDev/calhacks-winners-ouuu

## Inspiration

When my grandfather passed, my family had a real worry: that my grandmother would fall for the scams that follow a death. She had the financial literacy to see through them. But what about the widows who don't?

When a member dies, scammers who read obituaries call the widow, and Treasury sends the credit union a reclamation notice (FS-133) for Social Security paid after the death. At a small credit union, answering it is a part-time job, and mistakes cost money either way. We wanted an agent trusted for what it can't do.

## What it does

Harold Whitcomb died in March. His widow Dolores is 74.

1. **Scam Shield.** A fake debt collector tells Dolores to pay Harold's debts in gift cards. She hears, and he doesn't, a chime, then: "Dolores, it's your credit union. You don't need to answer me. This sounds like a scam. It's okay to hang up."
2. **Estate desk.** The agent closes Harold's books against the FS-133: it protests the $1,045 already returned (R15), returns the $535 on hand, and books a $2,600 credit-union liability, because a rep's March 20 note shows the credit union knew. Without that note the cap would be $1,045. It drafts balanced journal entries; only the controller can post and sign. **Why?** has Claude explain, citing a source or rule in every sentence.
3. **The call.** A calm Cartesia voice verifies Dolores from her CRS credit file and tells her she owes the scammer nothing; the credit union is handling the repayment with Treasury. It offers to connect Susan, the executor, then leaves the line.

## How we built it

- **Estate desk:** `estate.py`, plain arithmetic with cited rules; Claude Opus 5.5 only explains.
- **Safety:** `gate.py`: the agent may hold, call, draft and explain; only a human releases, posts, signs or moves money.
- **Scam Shield:** Twilio streams the caller's side only; Cartesia Ink transcribes; a keyword gate, then Claude Haiku 5.5; the whisper plays to her leg only.
- **Voice:** Twilio, Pipecat, Cartesia Ink → Claude Haiku 5.5 → Cartesia Sonic.
- **Identity:** CRS sandbox; questions from her credit file, answers kept in `verify.py`.
- **Record:** Convex (cases, estate drafts, append-only journal), Next.js on Vercel.
- **Overnight holds:** Nessie, Elastic, our Apify actor, Factory Droid SDK.

## Challenges we ran into

- **A fact-check against 31 CFR 210 changed our liability rule.** Without prior knowledge, liability is the lesser of the 45-day amount and the unrecovered total, and only if Treasury can't collect from the withdrawers.
- **The arena found a verification-guessing hole.** A scammer who knew Dolores's city guessed through, because the real street was the only local option. Decoys are now local streets and household-name banks.
- **Keeping the agent unable to post or move money.** Rules live in `gate.py`, not the prompt. The bot never sees verification answers, and the estate call has no hold tools.

## Accomplishments that we're proud of

Harold's figures match the cited rules to the dollar, and the desk scores 5/5 on planted errors. The arena passes 30/30. Kill the server mid-case and it resumes with the gate as strict as before.

## What we learned

The math belongs in code; the model explains it. Checking rules against primary sources changed real numbers, and our own policy choices are cited as policy.

## What's next

Real FS-133 and death-notice intake, a scheduled Convex function for Treasury's 60-day response clock, a core banking feed instead of Nessie, per-analyst SSO, and the arena in CI.

## Built with

Python, Claude Opus 5.5, Claude Haiku 5.5, Cartesia Sonic, Cartesia Ink, Pipecat, Twilio, CRS, Capital One Nessie, Elastic, Apify, Factory Droid SDK, Convex, Next.js, Vercel

## Track fit

**Hyphenate: Autonomous Systems for Finance.** The seat: the estate desk at a credit union under $500M in assets, answering FS-133 notices, with a controller who signs. `estate.py` picks the death date, finds what wasn't due or was already returned, and sets liability under 31 CFR 210.10 or the 210.11 cap. Limited access: the agent drafts; only a human posts the journal, signs a loss over $250 or closes the estate. Clean record in Convex. Accuracy: 5/5. The moment: one rep's note sets the liability at $2,600 instead of $1,045.

**CRS.** Identity messages decide whether and how strictly to verify; questions come from her credit file.

**Cartesia.** The whisper, the calm call, the bridge intro: Sonic at `speed=0.9`, Ink with per-call keyterms.

**Anthropic.** Haiku listens and speaks; Opus explains with citations. None moves money.

**Convex.** Case file, estate drafts, append-only journal, restart recovery.

**Microsoft.** A $1,045 over-claim caught, a $2,600 liability surfaced; path to production in `docs/TRACKS.md`.

**Meta.** Scams isolate; the agent brings Susan in, then steps away.

**Factory.** Droid edits one policy file on a trigger; a human approves the diff.

**Apify / Elastic.** FTC alerts and her purchase history, cited in triage.

**Nessie.** The bank: seeded members, a 2-second watcher, judge-run purchases.

## Proof it works

- **Estate desk:** 5/5 planted errors against an answer key.
- **Red-team arena:** 30/30 calls passed; 0/21 scams or impostors released or verified.
- **Scam Shield:** 18/18 scam calls caught, 0/18 false alarms at threshold 0.75.

| Real | Simulated |
|---|---|
| Twilio calls, Cartesia voice, Claude reasoning | The credit union; Dolores is CRS test identity P20 |
| Live CRS calls for Dolores's identity verification | The estates' Treasury notices, death certificates and CRS deceased indicators |
| Reclamation rules, cited per `docs/RECLAMATION.md` | The scammer (a teammate) |

## Demo video shot list (2:00)

| Time | Shot |
|---|---|
| 0:00 | Cold open: "Pay today in gift cards." The chime, the whisper. He doesn't hear it. |
| 0:15 | Title card: the two-people line. |
| 0:25 | Estate desk, Harold: sources, the March 20 note. |
| 0:45 | Reclamation: $1,045 protested, $535 returned, $2,600 liability. "Without that note: $1,045." |
| 1:00 | Why?, then Sign as controller. |
| 1:15 | Call Dolores: she verifies, owes the scammer nothing, says yes to Susan. |
| 1:45 | Proof numbers. "It drafts; a human signs." |

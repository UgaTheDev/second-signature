# Second Signature: Devpost submission

## Tagline

A fraud desk for small credit unions that warns members during scam calls and never moves a dollar without a person signing off.

**The seat it fills:** the back office a small credit union can't afford to staff: the estate desk and the night fraud analyst.

Live dashboard: https://second-signature-ai.vercel.app · Code: https://github.com/UgaTheDev/second-signature

## Inspiration

In 2025, Americans over 60 reported $7.7 billion in fraud losses to the FBI, which is 59% more than the year before (FBI IC3, 2025 Internet Crime Report). Most of that money leaves after a phone call that follows a familiar script, like a fake IRS agent, someone from "Microsoft support", a grandchild who needs bail or a debt collector who doesn't exist. The bank sees the money go, but nobody is on the call with the member while it's happening.

Small credit unions also can't staff the back office that comes with fraud and with death. When a member dies, the US Treasury sends a reclamation notice (FS-133) for Social Security paid after the death, and answering it correctly is a part-time job where mistakes cost money either way. We wanted one agent that could help with both, and that a credit union could trust because of the things it has no power to do.

## What it does

Second Signature watches over members in three ways and leaves every money decision to a person.

- **Scam Shield** listens to calls on a member's protected line. When a caller follows a scam script, the member hears a short chime and a warning that the caller can't hear: "It's your credit union. You don't need to answer me. This sounds like a scam. It's okay to hang up." For the next day, gift card, wire and crypto purchases on the account wait for a person to review them.
- **Overnight holds** pause risky purchases and call the member to confirm them, using questions from her own credit file. The agent can let a small, familiar purchase through once she's verified, and anything larger or unusual goes to an analyst in the morning.
- **The estate desk** answers the Treasury when a member dies. It works out what is actually owed under 31 CFR 210, drafts the journal entries and the reply, and waits for the controller to sign. Claude explains each figure, and every sentence of that explanation has to cite a rule or a source.

Our demo follows the hardest case. Harold Whitcomb died in March, and his widow Dolores is 74. A fake debt collector calls her demanding gift cards for Harold's "debts", and Scam Shield warns her before he finishes his sentence. Meanwhile the Treasury claims $4,180 of Harold's Social Security. The agent finds that $1,045 of it was already returned, so it protests that part and returns the $535 still in the account, and the remaining $2,600 falls on the credit union because a rep recorded Harold's death on March 20, before those payments arrived. Then a calm Cartesia voice calls Dolores, checks her identity with a question from her credit file, tells her she owes the scammer nothing and that the credit union is handling the Treasury, and offers to connect her with her daughter Susan, who is the executor.

## How we built it

- **Scam Shield:** Twilio streams only the caller's side of the call to our server. Cartesia Ink transcribes it as it arrives, a keyword filter decides when to ask Claude Haiku 5.5, and the whisper plays only on the member's leg of the call.
- **Calls:** Pipecat connects Twilio, Cartesia Ink, Claude Haiku 5.5 and Cartesia Sonic. Sonic is slowed to 0.9× for older listeners, and Ink gets each call's expected answers as keyterms.
- **Estate desk:** `estate.py` does the arithmetic in plain Python with a cited rule for each step. Claude Opus 5.5 writes the explanation, and our code rejects it if any citation or dollar amount isn't in the record.
- **Safety:** `gate.py` checks every action the agent takes. It can hold, call, draft and explain, while releasing larger holds, posting, signing and moving money all need a person.
- **Identity:** the CRS sandbox supplies the credit-file questions, and the answers stay in `verify.py`, where the model never sees them.
- **Record:** Convex stores cases, transcripts, estate drafts and an append-only journal, and the Next.js dashboard on Vercel reads it all live.
- **Overnight holds:** Capital One's Nessie API stands in for the bank, Elastic and our Apify actor supply purchase history and FTC scam alerts for triage, and Factory's Droid SDK proposes policy changes for a person to approve.

## Challenges we ran into

- **Reading 31 CFR 210 ourselves changed our liability rule.** When the credit union had no prior knowledge of the death, it owes the lesser of the 45-day amount and the unrecovered total, and only if the Treasury can't collect from the people who withdrew the money.
- **Our first estate call told the widow she owed "nothing", which wasn't true.** She had withdrawn deposits that arrived after Harold died, and the credit union has to name her to the Treasury. The call now tells her that part isn't settled yet, and the red-team arena fails any call that promises otherwise.
- **Growing the red-team arena from 30 calls to 500 exposed a hole the small run never hit.** With two of three answers required, impostors could guess their way through, because the real answer kept landing in the same spot among the options. Our tests now require every answer, and the decoys follow the credit bureau's own format so the real one doesn't stand out. The live demo asks a single question to keep the call short.
- **Keeping the agent unable to post or move money took discipline.** The rules are checked in `gate.py` on every action, the bot never sees verification answers, and the estate call has no tools that touch a hold.

## Accomplishments that we're proud of

Harold's figures match the cited rules to the dollar, and the estate desk catches all five planted errors in our test estates. Claude's explanations only reach the controller when every citation and dollar amount exists in the record. In 500 red-team calls, no scammer or impostor got money released or passed verification, and Scam Shield caught all 140 scam calls in its test set without a false alarm. If the server restarts in the middle of a case, it picks up again with the same restrictions in place.

## What we learned

We learned to keep every calculation in code and have the model explain it, because a function can be audited in a way a generated number can't. Reading the regulations ourselves changed real figures in our output, and wherever a number comes from our own policy choice, the explanation labels it as policy.

## What's next

We want to take in real FS-133 and death notices, add a scheduled Convex function that tracks the Treasury's 60-day response deadline, replace Nessie with a core banking feed, add single sign-on for analysts, and run the red-team arena on every change.

## Built with

Python, Claude Opus 5.5, Claude Haiku 5.5, Cartesia Sonic, Cartesia Ink, Pipecat, Twilio, CRS, Capital One Nessie, Elastic, Apify, Factory Droid SDK, Convex, Next.js, Vercel

## Track fit

**Anthropic.** Claude Haiku 5.5 runs every live call and the mid-sentence scam check, and Claude Opus 5.5 writes the cited estate explanations. Neither model can move money, because every action passes through `gate.py`.

**Cartesia.** Cartesia Ink transcribes the caller in real time with per-call keyterms, which is what makes the mid-sentence warning possible. Cartesia Sonic at 0.9× speed is the voice of the whisper, the verification call and the hand-off to the member's family.

**Hyphenate: Autonomous Systems for Finance.** The agent fills the estate desk at a credit union under $500M in assets. It picks the date of death, finds what wasn't due or was already returned, and sets liability under 31 CFR 210.10 or the 210.11 cap, while only a person can post the journal, sign a loss over $250 or close the estate. It scored 5/5 on planted errors, and in Harold's case a single rep's note moves the credit union's liability from $1,045 to $2,600.

**CRS.** Identity signals from CRS decide whether and how strictly to verify a member, and the questions come from her own credit file.

**Convex.** Convex holds the case file, the estate drafts and the append-only journal, and lets the server recover open cases after a restart.

**Microsoft.** On Harold's estate the agent caught a $1,045 over-claim and surfaced a $2,600 liability, and our path to production is in `docs/TRACKS.md`.

**Meta.** Scammers try to cut their targets off from family, so the agent offers to bring the member's family onto the call and then leaves the line.

**Factory.** A Droid proposes an edit to one policy file when a trigger fires, and a person approves the diff before it ships.

**Apify and Elastic.** FTC scam alerts and the member's purchase history are cited in overnight triage.

**Nessie.** Capital One's Nessie API is the bank in our demo, with seeded members, a watcher that checks for new purchases every two seconds, and purchases judges can trigger themselves.

## Proof it works

- **Estate desk:** 5 of 5 planted errors caught against an answer key.
- **Red-team arena:** 500 simulated calls across 25 scenarios. None of the 300 scam and impostor calls got money released or passed verification, and none of the 100 calls to the widow told her something false or mentioned the credit union's loss.
- **Scam Shield:** all 140 scam calls caught, with no false alarms on 140 real calls written to sound suspicious, across 28 scripts run 10 times each at a 0.75 threshold.

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

# Pitches, one per judge

One product, one story, told with a different emphasis for each judge. The story never changes:

> **Two people want Harold's money: a scammer and the US Treasury. Only one of them is owed it.**
> Harold died in March. A fake collector phones his widow Dolores for $8,900 in gift cards; Scam Shield
> whispers. Meanwhile the estate desk closes Harold's books: Treasury reclaims his post-death Social
> Security, the agent proves part of the claim is wrong, and refuses to finalise until the controller
> signs the loss. Then a calm voice tells Dolores she owes the scammer nothing.

Rule for every pitch: open with the moment, say the one line for that judge, show one thing on screen,
then stop. Everything else is an answer to a question. Every number here is checked by
`uv run python estate.py` and the arena; re-run them if the data changes.

---

## Hyphenate (autonomous systems for finance)

**Seat:** the deposit-operations accountant at a small credit union, the one who closes a member's
books after a death and answers Treasury.

**Say:** "Every number on this screen traces back to a deposit, a document or a person. The agent can
draft; only the controller can post."

**Show:** the Estates view.
- **Sources disagree:** the death certificate vs Treasury's death notice vs the credit file vs a
  rep's note. The agent says which one it trusted and why.
- **Time:** a rep wrote "Harold passed" on March 20. That one note, written in March, decides the
  credit union's liability in July ($2,600 instead of $1,045).
- **The moment:** it refuses to finalise. Treasury over-claimed $1,045: one payment had already
  gone back (ACH return code R15).
- **Limits:** the agent drafts the balanced journal entries; posting and signing are human-only, in
  code (`gate.py`).
- **Defends a decision:** press **Why?** and every sentence cites a source id or regulation section.

**Proof:** 5 estates, each with a planted error, scored against an answer key: 5/5. The rules are
cited to 31 CFR 210 and the Treasury Green Book in `docs/RECLAMATION.md`.

**If asked "isn't this fraud again?":** "The scam is 20 seconds of the demo. It's the foil: the same
debt arrives twice, once fake, once real, and the job is telling them apart and booking the real one."

**Don't lead with:** Scam Shield, the arena, the sponsor list.

## Cartesia (voice is core)

**Say:** "Voice is the product. It's how a 74-year-old widow gets protected without touching an app."

**Show:** two voices doing two different jobs.
- The **whisper** during the fake collector's call, which only she hears, preceded by a soft chime.
- The **calm call** afterwards. Cartesia Sonic slowed to 0.9× and turned up for hard-of-hearing
  listeners. Cartesia Ink transcribes her, primed with her name and the merchant. It explains the
  real repayment in plain words and offers to bring in her daughter.

**Cartesia features used:** Sonic 3.6 TTS (speed, volume, emotion), Ink STT with keyterms, a
pre-rendered whisper clip served to Twilio, live caller transcription for Scam Shield.

**Responsibility:**
- Scam Shield transcribes only the caller's side, never hers.
- The bot never asks for a PIN, password or code.
- It never mentions the credit union's internal loss to the widow.

**Don't lead with:** accounting terms.

## CRS (Best Overall, Best Financial AI Agent, Best Identity/Fraud Innovation, Most Unexpected Use)

**Say:** "CRS isn't a lookup here. It's how the agent knows who it's talking to, and whether
someone is really dead."

**Show:**
- **Identity:** Dolores's verification questions are built live from her CRS credit file. Her
  answers stay on the server, so the bot never sees them and can't leak them.
- **Death confirmation:** CRS's TransUnion identity response flags a deceased SSN (code 2301). It's
  one of the sources the estate desk weighs against the death certificate and Treasury's notice.
  Honest note: in the estate data the CRS deceased indicator is simulated; the live CRS calls are
  Dolores's identity checks and the purchase-triage signals.
- **Fraud signals:** the AtData Fraud Finder score feeds triage for purchases.

**For "Most Unexpected Use":** "We use a credit bureau to settle a dead man's books, and to catch a
false death report when the 'deceased' member is still using his card."

## Anthropic (named community, real problem, it works, thoughtful Claude)

**Community:** recently widowed members of small credit unions. They're targeted by scammers who
read obituaries, and buried in their late spouse's paperwork.

**Real problem, in our words:** "When my grandfather passed, we were genuinely worried my grandmother would fall
for these scams. She had the literacy to avoid them. This is for the ones who don't."

**Say:** "Claude does three jobs, and none of them is moving money."
1. **Haiku** listens for a scam script as the call happens.
2. **Haiku** speaks to the widow.
3. **Opus** explains every estate decision with citations, and code checks every citation before the
   controller sees it.

**Lead with the one we caught in ourselves:** "Our first version told Dolores she owed nothing. That's
the kind thing to say, and it was wrong: she'd withdrawn $3,200 after Harold died, and the credit union
has to name her to Treasury. Now it tells her it isn't settled and the credit union will write. Our
red-team arena fails any call that says she owes nothing."

**Where else it could go wrong, and what we did:**
- **Claude invents a source or a number:** every [citation] and dollar amount in "Why?" must exist in
  the estate's record, or the controller gets the rules engine's findings instead, labelled.
- **A model talked into "release":** releasing is human-only in code.
- **An impostor posing as the widow, or a coached victim:** [ARENA].

## Convex ($5k)

**Say:** "The case file is the product, and Convex is the case file."

**Show:**
- **Live queries:** the dashboard updates as the call happens, line by line, without a refresh.
- **Append-only tables:** actions, transcripts, and now the **journal**. Signing an estate appends
  its posted lines; nothing is edited after the fact.
- **Server-only writes** through a shared secret.
- **It survives a restart:** kill the server mid-case and the held cases come back from Convex with
  their gate state intact.

**Honest gap:** no Convex scheduler yet. If time allows, the Treasury 60-day response clock is the
natural scheduled function.

## Microsoft (Built for the Real World, Customer Impact)

**Customer:** a credit union under $500M in assets, with no overnight fraud staff and one person
in deposit operations.

**Measurable usefulness:**
- the over-claim it caught ($1,045);
- the liability it surfaced ($2,600);
- the 5/5 planted errors caught;
- Scam Shield: 18/18 scam calls caught, 0/18 false alarms.

**Path to production:**
- Nessie becomes the core banking API.
- CRS is already a production bureau.
- Twilio and Cartesia are production services.
- The gate and audit trail are what an examiner asks for.

**Responsible design:** human sign-off on every dollar, rule citations, and a red-team harness.

## Meta (bringing people closer together)

**Say:** "Scammers win by cutting people off from family. This brings the family in."

**Show:** the voice agent offering, as her choice, to connect Susan (Harold's executor and
Dolores's daughter) on the same call. The bot steps away once they're connected. AI is essential:
it hears the scam during the call and knows when to bring a person in.

## Factory (Droid does real work)

**Say:** "Droid edits our policy, on a trigger, inside a box, and a human approves the diff."

**Show:** the Policy view: Droid's visible steps, then the diff of `policy.md`.
- **Triggers:** every morning at 7am, the **Run review** button, or 3 analyst overrides.
- **The box:** a scratch folder with only a copy of `policy.md`. Edit is its only tool, autonomy is
  off, and every edit is approved by our code.
- **Honest behaviour:** with no wrong calls to learn from, it declined to change anything. That's
  "knowing when not to act".

## Apify (+ Best Actor)

**Say:** "Our own actor scrapes the FTC's live scam alerts, and they're the evidence the agent cites."

**Show:** a case's evidence line citing a real FTC alert. Our actor `ftc-scam-alerts` scraped
20 alerts on its first run, the newest on Oct 22 ("The FTC is not calling to deactivate your phone
number"). Debt-collector and government-impostor alerts back the "not real" verdict on the fake
collector.

## Elastic

**Say:** "Two indices the agent queries before every decision."
- `scam_patterns`: the FTC alerts, matched by payment method and scam type.
- `member_txns`: her history, used to answer "has she ever bought this, at this size?"

## Nessie (completeness, creativity, complexity)

**Say:** "Nessie is the bank, and we use it like one."

**Show:**
- seeded members and accounts;
- a 2-second watcher on purchases;
- judge-run scenarios posting real purchases.

Honest note: the estate desk reads Harold's deposit history from `server/estates.json`, not from Nessie.
Wiring his post-death deposits into Nessie is the next step, not something to claim today.

## Armadin (security)

**Say:** "We assume the model will be fooled, and built so it doesn't matter."

**Show:**
- a permission matrix in code;
- signed Twilio webhooks;
- verification answers that stay on the server;
- prompt-injection tests in the smoke suite;
- Droid sandboxed to one file;
- the red-team arena: 0/21 scams or impostors released or verified.

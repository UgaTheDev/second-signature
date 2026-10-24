# Hard questions and our answers

A skeptical judge's questions, checked against the code, ordered by how likely we are to be asked. Items marked
**FIXED** shipped in commit 968ae39; their file:line references describe the code *before* that commit, and the
"Fixed in 968ae39" line says what happens now. Fix sizes for open items: **S** under 30 min, **M** under 2 h,
**L** after the hackathon.

| # | Question | Status |
|---|----------|--------|
| 1 | AI calling about her bank is the #1 scam script | FIXED in 968ae39 |
| 2 | Twenty API keys for grandma | FIXED in 968ae39 (README); no enrollment flow yet |
| 3 | Whisper over a talking scammer | FIXED: short fixed whisper (968ae39); caller muted while it plays, then unmuted (real-call timing still to measure) |
| 4 | Never run end to end with real phones | OPEN |
| 5 | Grandson's gift card held overnight | FIXED in 968ae39 (explanation); the hold itself is deliberate |
| 6 | Recording and legality | PARTLY FIXED: family caller skips the Shield; legal review OPEN |
| 7 | 3am | FIXED in 968ae39 |
| 8 | Credit-file trivia under stress | OPEN |
| 9 | Cost per member | OPEN |
| 10 | Keyword gate misses bank impersonation | FIXED in 968ae39 (arena script still OPEN) |
| 11 | Members with no family | FIXED in 968ae39 |
| 12 | 24h Shield window lost on restart | FIXED: rebuilt from recent scam-call cases on startup (`shield.rebuild` in `agent.resume`) |
| 13 | Landline forwarding loop | FIXED: calls from the Shield's own number hang up; the credit union's own calls bypass the Shield. Keeping her caller ID is still OPEN |
| 14 | Hearing aids, accents, Spanish | OPEN |
| 15 | Treats older people as incompetent | Already handled |
| 16 | Scammer controls the trusted voice | FIXED in 968ae39 |
| 17 | Whisper latency | PARTLY FIXED: pre-rendered; end-to-end time not measured |

---

## 1. "An AI calling an old lady about her bank is the #1 scam script. Why would she trust it?"

**Verdict: partly valid, now FIXED in 968ae39.** The design already told her not to trust it, but the outbound call
used to go straight to identity questions, which is exactly what we teach people never to answer.

- The outbound opener says she can hang up and call the number on her card (`server/calltools.py:41-42`), and the
  callback on the card number is handled and praised (`calltools.py:43-44`).
- It says early that it will never ask for a PIN, password or code (`calltools.py:25`), and the arena fails any call
  where the bot asks for one (`README.md:79-81`).
- It cannot move money at all, so a fake "Second Signature" call has nothing to imitate that a real one would do
  (`server/gate.py:13`, `gate.py:55-56`).
- Former hole, closed: after that opener, the outbound call went straight to the credit-file questions
  (`calltools.py:26-28`). It now asks first whether she would rather hang up (see Fixed line).

**Answer:** "Our bot says in its first sentence: you don't have to trust this call, hang up and call the number on
your card. Then, before any question, it asks whether she'd rather hang up and call that number, and it only
continues if she wants to. It never asks for a PIN or a code, and it can't move money, so the only thing it can do is keep her money
where it is. If she calls back on the card number, she lands on the same assistant with her case already open."

**Fixed in 968ae39:** on outbound calls the bot now says its opener, then asks "Would you rather hang up and call
that number, or keep going with me now?" before any verification question; if she wants to call back it says that is a
wise choice and ends the call (`FIRST_OUT` in `server/calltools.py`).

---

## 2. "So grandma has to set up twenty API keys?"

**Verdict: already handled in the code, missing from the pitch; the pitch gap is now FIXED in 968ae39.** The keys belong to the credit union (or us as the
vendor). Dolores never sees them.

- The `.env`, `preflight.py`, ngrok and the Twilio webhook are server setup (`README.md:132-157`).
- What a member actually does: (1) say yes to Scam Shield, (2) give a trusted contact (`server/members.py:20`),
  (3) forward her landline to the protected number (`README.md:48`). Everything else, including the overnight calls,
  needs nothing from her: the agent calls her.
- Still open: there's no enrollment flow at all. Members are hard-coded in `members.py:14-62`. And step 3 (call forwarding,
  usually a `*72` star code) is a real ask of a tech-averse 74-year-old.

**Answer:** "Members don't configure anything. The keys are the credit union's, set up once on one server. Dolores's
part is a yes at the branch and her daughter's number. For Scam Shield, the teller turns on call forwarding with her,
which is one star code on her landline. Without Shield she still gets the overnight hold and the call."

**Fixed in 968ae39:** the README Scam Shield section now says the member sets up nothing technical: every key belongs
to the credit union's server, and at the branch or on one call she says yes, names a trusted contact, and staff turn on
forwarding with her; the overnight check needs nothing from her. (Not built: a real enrollment flow.)

---

## 3. "Two voices at once: a whisper while the scammer keeps talking will confuse a flustered, hard-of-hearing 74-year-old."

**Verdict: valid; FIXED. Whisper wording and length in 968ae39; the caller is now muted for the length of the clip, then unmuted (`shield.py` `_warn`). Not yet timed on a real call.** Checked in
`server/shield.py` (line numbers and the bullets below describe the code before 968ae39 unless noted):

- What she hears, in order: her phone rings (from the protected number, `shield.py:160`), she's joined to the caller
  (`shield.py:155`). The caller already heard the consent notice (`shield.py:136`). Nothing is muted at any point.
- When the classifier fires, Twilio plays the whisper to her participant only (`shield.py:191-192`). The scammer is
  not muted or put on hold, so as far as our code goes he keeps talking while she hears the warning.
- The whisper is about 38 words (`shield.py:48-49`) at speed 0.9, roughly 15 seconds, and it plays **once**:
  `flagged` is set before the whisper and blocks any repeat (`shield.py:183`, `shield.py:227`). If she misses it,
  that's it.
- "Only you can hear me" invites her to answer aloud ("Who's that?"), and the scammer's own script has the answer
  ready: "the bank may be involved, don't listen to them."
- The `why_short` example assumes the caller is male: "he's asking for..." (`shield.py:69`).
- The family bridge is **not** two voices at once: Susan hears her intro alone (`server/bot.py:179-183`), Dolores
  waits on hold music (`server/server.py:110-111`), and the agent has left before they're connected.

**Answer:** "Fair. The bridge is sequential, but the whisper still plays over the scammer; muting him while it plays
is the open item. What we did change: the whisper is now short fixed words, 'You don't need to answer me. This sounds
like a scam. It's okay to hang up', with the last line said twice, and it no longer says 'only you can hear me' or
repeats anything the caller said. The money side doesn't depend on her hearing it: once the call is flagged,
any gift card, wire or crypto purchase in the next 24 hours is held for a human."

**Fixed in 968ae39:** `WHISPER` is now "{name}, it's your credit union. You don't need to answer me. This sounds like
a scam. It's okay to hang up. It's okay to hang up." (about 25 words, prerendered per member, the "he's asking for..."
text is gone). **Still open (M):** in `whisper()`, mute the caller's participant
(his CallSid is in the conference name, `shield.py:130`) with `participants(caller_sid).update(muted=True)` before
the announcement and unmute after; verify Twilio's announcement behaviour on a real call first.

---

## 4. "Has this ever run end to end with real phones?"

**Verdict: valid, and we say so ourselves.** `README.md:189`: "No end-to-end run with live keys yet." Everything below
it is checked against docs, plus offline `smoke.py` and the arena with the real prompt and gate but no audio.

**Answer:** "The brain was tested: the arena runs the production prompt, tools, gate and verification against scammer
and member scripts, and `smoke.py` runs the whole flow offline. The demo you saw is the live run." (Only say the last
sentence if it's true by then.)

**Fix (M):** before judging, do one live run of the DEMO.md script, note the whisper delay and the call setup time,
then replace `README.md:189` with what was measured.

---

## 5. "Her grandson's birthday is in two days. She buys him a gift card and you block it overnight. Isn't that a false positive that makes members hate you?"

**Verdict: partly valid, and it's in our own seed data. The explanation gap is FIXED in 968ae39; the hold itself stays by design.** `members.py:22`: "Grandson Leo's birthday is Oct 26."

- A first-ever gift card is held by rule (`gate.py:41-50`), and even a verified Dolores who made it knowingly cannot
  release it; only an analyst can (`gate.py:89-90`). That's deliberate: coached victims are told to say "it's for my
  grandkids" (arena `coached_victim`, `README.md:97-99`).
- The bot does tell her an analyst will review it in the morning (`calltools.py:36`), and holds go to a human after one
  business day at most (`server/agent.py:148-160`).
- Only the categories scammers ask for are floored. A bike is triage's call (`gate.py:129`), and Robert's yearly gift
  cards go through (`gate.py:128`).

**Answer:** "Yes, Leo's first gift card from Grandma waits until the morning. That's the trade we chose on purpose: a
coached victim says exactly the same words as a happy grandma, and a morning delay on a $50 gift card costs far less
than $5,000 gone. It only applies to the first gift card, wire or crypto purchase ever. After that it's her pattern,
and triage decides like for Robert."

**Fixed in 968ae39:** when a purchase is held by the first-ever-category rule, the prompt now tells the bot to say
plainly and kindly that it's a new kind of purchase for her account, a person at the credit union will look at it first
thing in the morning, and she did nothing wrong (`HELD_LINE` in `server/calltools.py`).

---

## 6. "Is recording or listening to her calls even legal? What about the people calling her?"

**Verdict: partly valid. Hole (b) FIXED in 968ae39; the legal review is still OPEN.**

- Every caller hears the notice before anything is streamed (`shield.py:47`, `shield.py:136`), which covers the
  all-party-consent case for the caller; Dolores consents by enrolling. Only the caller's audio is forked
  (`shield.py:138`), and the transcript is memory-only and dropped at hang-up (`shield.py:225`, `shield.py:262`).
- Holes: (a) the audio goes to Cartesia and the text to Anthropic, which we disclose (`docs/THREAT_MODEL.md:23`) but
  the notice doesn't mention; (b) *(fixed in 968ae39)* **every** caller used to hear the notice, including Susan; (c) we have no
  lawyer's read on whether that notice is enough under California's all-party consent law (CIPA).

**Answer:** "The caller hears that an automated assistant is listening before a single word is sent anywhere, and
Dolores opted in. We only transcribe the caller, keep nothing unless it's flagged, and then only the quote. The vendors
that process audio are named in our threat model. A real deployment gets a compliance review; this is a prototype."

**Fixed in 968ae39:** a call from her trusted contact's number skips the Shield: `caller_twiml` returns a plain `<Dial>`
to her phone with no notice and no stream. Still open: mark CIPA as "needs legal review" in Known limitations.
(Her doctor and other non-family callers still hear the notice.)

---

## 7. "It's 3am. She's asleep. What happens?"

**Verdict: valid, with two real bugs. Both bugs and the 3am family call are FIXED in 968ae39.**

- The agent calls her as soon as it holds, at any hour (that is unchanged: if the purchase is happening now, she is awake).
- If she doesn't pick up, it redials after **20 seconds** (`agent.py:29`, `agent.py:141`), and after two missed calls
  it calls Susan and escalates (`agent.py:144-145`). Before 968ae39 a sleeping Dolores meant Susan's phone rang at 3am,
  about a minute after the purchase.
- **Bug (fixed in 968ae39):** that family message said "We paused a payment on your mother Dolores's account tonight **and spoke with
  her**" (`bot.py:175`), even when the reason we're calling is that we couldn't reach her.
- **Bug (fixed in 968ae39):** there was no answering-machine detection (`agent.py:112`, no `machine_detection`). If her voicemail picks up, Twilio
  reports `completed`, which isn't counted as unanswered (`agent.py:124`), so there's no redial and no escalation from
  that path, and the bot reads its verification questions, with the real answer among the options, to her voicemail.
  Same for the bridge: if Susan's voicemail answers, Dolores is put into a conference with Susan's voicemail and isn't
  brought back to the agent (`agent.py:126` only handles busy/no-answer/failed).
- What's right: the hold stands no matter what, and an analyst gets it in the morning.

**Answer:** "The money is safe while she sleeps, because the hold doesn't need her. If she doesn't answer after two
tries, between 9pm and 8am we don't wake her daughter: the hold stays and an analyst decides in the morning. If a
voicemail picks up, the bot hangs up without asking anything and counts it as unanswered, so the redial and the
escalation still happen. In the daytime, her daughter is told we tried to reach her and couldn't." (Quiet hours use the
server's clock, not the member's time zone.)

**Fixed in 968ae39:** (1) the family message says "tried to reach her but couldn't" unless she was verified or fewer
than two calls went unanswered (`bot.py`); (2) between 9pm and 8am, after two unanswered calls the agent skips
`call_family`, logs "not waking family" and escalates (`agent.py`); (3) `dial()` passes `machine_detection="Enable"` for
member and bridge calls, `/twiml` hangs up when `AnsweredBy` is a machine or fax, and the call is counted as unanswered;
a bridge call to Susan's voicemail now brings Dolores back to the agent. Family calls skip detection on purpose, since
leaving a voicemail there is fine.

---

## 8. "Credit-file trivia under stress, one try per question? She'll fail and get locked out."

**Verdict: partly valid.**

- Two right out of three, multiple choice, options read aloud (`server/verify.py:12`, `calltools.py:26-28`). A
  mishearing doesn't use a try: an answer that isn't one of the options is sent back to be asked again
  (`verify.py:72-73`). Ink STT is biased toward the four options (`README.md:167-169`).
- But each real answer is final (`verify.py:70-71`), and with a CRS fraud alert all three must be right, so one miss
  fails (`verify.py:111-115`). "About what year did you open your oldest credit account?" (`verify.py:49`) is hard
  at 74 and hard at 34.
- Failing is not a lockout: the bot says a staff member will call in the morning and escalates (`calltools.py:29`).
  The arena includes a hard-of-hearing real member who must verify (`server/arena.py:87`).

**Answer:** "Missing a question doesn't hurt her: her money stays held and a person calls her in the morning. One try
per question is what stops a scammer with her breached details from guessing. We biased the speech recognition to the
four options so a misheard answer isn't counted, and the bot can repeat the options as often as she needs."

**Fix (S):** prompt line: "Repeat the options as often as she asks, slowly. Before calling check_answer, read back her
choice and wait for her yes."

---

## 9. "What does this cost a small credit union per member?"

**Verdict: valid, not measured.** The only number in the repo is the arena: 30 simulated calls for "a few cents"
(`README.md:94`). Cost has two very different parts:

- Overnight analyst: Claude triage per purchase, plus a phone call only when something is held. Rare and cheap.
- Scam Shield: every inbound call to an enrolled member costs a Twilio conference with two legs, a media stream and
  Cartesia STT for the whole call. Claude only runs after a keyword hit (`shield.py:227`), but transcription runs
  always. This is the cost that grows with members.

**Answer:** "The overnight analyst only costs money when it holds something, and that's a few cents of model time plus
a phone call. Scam Shield is the expensive part because it transcribes every call, so a credit union would offer it to
members at risk, not to everyone, and it's cheaper than one reimbursed scam."

**Fix (S):** before judging, put one measured or priced line in TRACKS.md's Microsoft section: cost per held purchase
and cost per Shield minute, taken from the Twilio and Cartesia pricing pages, labelled as an estimate.

---

## 10. "Your keyword gate would miss the bank-impersonation scam: 'this is your bank's fraud department, read me the code we just texted you.'"

**Verdict: valid; the gate gap is FIXED in 968ae39 (the arena test script is still OPEN).** The prefilter (as it was before 968ae39) (`shield.py:52-55`) had gift cards, tech support, government, family emergency and
payment rails, but for bank impersonation, the script this product's own pitch is about, it only has
"your bank (may be|is) involved". No "one-time code", "verification code", "fraud department", "suspicious
activity", "Medicare", "Amazon", "refund", "Cash App" or "Venmo". The threat model admits the gate misses unknown words
(`docs/THREAT_MODEL.md:24`) but not this specific gap.

**Answer:** "The keyword gate is there to keep cost down: Claude only listens closely after a scam phrase. It now
covers bank impersonation and payment apps: one-time and verification codes, 'fraud department', 'suspicious
activity', Medicare, Amazon, Cash App and Venmo. It's a regex, so it will always miss words nobody listed; the arena's
shield mode measures it on labelled scripts, and a bank-call scam script and a benign one are still to be added."

**Fixed in 968ae39:** `PREFILTER` now also matches `one[- ]time (pass)?code`, `verification code`, `fraud department`,
`suspicious activity`, `medicare`, `amazon`, `cash ?app`, `venmo`. Not added: "refund", "sheriff", "code we just
texted". **Still open (S):** add one scam and one benign bank-call script to the arena's shield set.

---

## 11. "What about members with no family, or who don't want family involved?"

**Verdict: partly valid, with a small bug. FIXED in 968ae39.**

- Her choice is enforced: the bridge needs a verified member who asked (`gate.py:71-77`), and "no" means don't ask
  again (`calltools.py:35`). Members with no contact don't get the `connect_family` tool (`calltools.py:73`).
- **Bug (fixed in 968ae39):** the prompt still told the bot to offer it. For Robert (`members.py:45`, `"family": None`), `fam` falls back
  to "your family" (`calltools.py:87`), so the bot would say "Would you like me to connect you with your family right
  now?" with no tool to do it. `notify_trusted_contact` is still offered, and the gate lets it through, ending in
  `dial()` logging "cannot place family call" (`agent.py:101`, `agent.py:105-107`).

**Answer:** "The family bridge is an offer, never a requirement, and a no is final. A member with no contact is never
offered family at all: the bot just tells her a staff member will call first thing in the morning. She still gets the
hold, the call, and a human analyst."

**Fixed in 968ae39:** `build_prompt` swaps the family lines for "Tell her a staff member will call her first thing in
the morning. Do not mention or offer to contact family" when `family_label(case)` is None, and `tool_specs` drops both
`connect_family` and `notify_trusted_contact` for that member.

---

## 12. "If the server restarts during the night, does the 24-hour Scam Shield protection survive?"

**Verdict: valid bug; FIXED. On startup `shield.rebuild` re-arms the window from scam-call cases opened in the last 24 h (cases an analyst already closed are not re-armed).** Before the fix: Flagged calls live only in memory: `EVENTS` (`shield.py:58`). Triage (`agent.py:38`) and the
code floor (`gate.must_hold`) read them. After a restart the README's restart story (`README.md:117-123`) holds for
cases, but the 24-hour "any gift card is held" window is gone, so Robert's next gift card is allowed again. The flagged
call's case is in Convex (`shield.py:198-204`), so the data to rebuild it exists.

**Answer:** "Every case and its gate state survives a restart. The Shield's 24-hour window didn't, and that's a fix we
know how to make: we already store the flagged call as a case."

**Fix (M):** in `agent.resume`, rebuild `shield.EVENTS` from `scam_call` cases opened in the last 24 hours (the
evidence quote is in `risk_signals`). Or **(S)** dump `EVENTS` to a small JSON file on each flag and load it at
startup.

---

## 13. "Forward her landline to the Shield, and the Shield rings... her landline?"

**Verdict: valid design hole; FIXED for the loop. A call from `SHIELD_NUMBER` itself is hung up and logged, and calls from the credit union's `TWILIO_NUMBER` skip the Shield. Losing her caller ID is still OPEN (L).** Before the fix: `README.md:48` says she forwards her landline to `SHIELD_NUMBER`, and the Shield rings
`MEMBER_PHONE` (`shield.py:149`, `shield.py:158-160`). If that's the same forwarded landline, the ring forwards back to
the Shield, which opens a new conference and rings her again: a loop. Same for our own overnight calls: the bot says
"gift cards", and the Shield would flag her credit union. The demo works only because `MEMBER_PHONE` is a teammate's
cell. Also, her phone shows the Shield number for every call (`from_=SHIELD_NUMBER`, `shield.py:160`), so she loses
caller ID and can't screen calls.

**Answer:** "In the demo the protected number rings her cell. In production the Shield rings a line that isn't
forwarded, or the credit union works with her carrier, and the CU's own number is allowlisted. Keeping her caller ID
is a known gap."

**Fix (S):** README line: "`MEMBER_PHONE` must be a line that isn't forwarded to the Shield (e.g. her cell)."
**(S)** in `caller_twiml`, if `From` is `TWILIO_NUMBER`, skip the Shield. **(L)** caller-ID passthrough and a
carrier-level setup.

---

## 14. "Hearing aids, slow speech, accents, Spanish?"

**Verdict: partly valid.** Speech is slower and warmer (`speed=0.9`, `README.md:170`), she can interrupt
(`README.md:173`), and the prompt asks for short sentences and one question at a time (`calltools.py:17`). STT is
biased per call (`README.md:167-169`). There's a hard-of-hearing scenario in the arena (`arena.py:87`). But it's
English-only, there's no "press 1" fallback if speech recognition fails, and phone audio at 8 kHz is rough on hearing
aids.

**Answer:** "Slower voice, one question at a time, she can interrupt, and the recognizer listens for her four answer
choices. If it can't understand her, the money stays held and a person calls. Languages are a setting on the voice and
recognizer, not a rebuild."

**Fix (S):** prompt line: "If she asks you to repeat, or seems not to hear, repeat more slowly with fewer words. After
two failed tries, offer a staff call in the morning instead." **(L)** Spanish and keypad answers.

---

## 15. "Doesn't this treat older people as incompetent?"

**Verdict: already handled.** No "you were scammed" (`calltools.py:18`); the arena fails any call that shames
(`README.md:80-81`). She decides about family (`calltools.py:33-35`). The whisper says "It's okay to hang up", not
"hang up now". The family is told nothing about amounts or details (`bot.py:175`).

**Answer:** "The words are chosen for that: it's 'a pattern scammers use', never 'you fell for it'. She chooses whether
her daughter is involved, and her daughter is told nothing about the purchase. The arena fails a call that shames her."

**Fix:** none needed.

---

## 16. "Can the scammer make your trusted voice say what he wants?"

**Verdict: valid, small. FIXED in 968ae39.** The whisper used to speak `why_short` (`shield.py:185`), which the model writes from the caller's
own words. It only plays after a confident scam verdict and after "This call sounds like a scam:", so the damage is
limited, but a caller-controlled sentence is spoken to her in the credit union's voice.

**Answer:** "It only speaks after it has decided the call is a scam, and what it says is fixed words we wrote:
nothing the caller says, and nothing a model wrote, can reach her in our voice. The caller's quote goes only into the
case file for staff."

**Fixed in 968ae39:** the whisper is one fixed sentence set (`WHISPER` in `server/shield.py`); the `why_short` field is
removed from `Verdict`, so no model or caller text is ever spoken. (No per-scam-type phrase: the single fixed whisper is
simpler and just as safe.)

---

## 17. "How fast is the whisper? By the time it plays she's read out the codes."

**Verdict: partly valid, not measured. PARTLY FIXED in 968ae39 (pre-rendered); end-to-end time still unmeasured.** Before
968ae39, after a keyword hit: one Haiku call at low effort (`shield.py:170`), then a
fresh Cartesia render with a 15 s timeout (`shield.py:96`, `shield.py:186`), then a conference lookup and a participant
update (`shield.py:190-192`). Checks run at most every 6 s (`shield.py:227`). Nothing is pre-rendered except the
consent notice (`shield.py:121-124`). And the money side doesn't depend on the whisper's timing.

**Answer:** "A few seconds after the scam phrase, and the hold on gift cards is armed in the same moment, so even if she
buys them, they're held. We'll put the measured number on screen after our live run."

**Fixed in 968ae39:** the whisper is pre-rendered per member at startup (like the consent notice), so no call waits on
Cartesia; the remaining live steps are the Haiku call and the conference update. **Still open:** measure the real delay
on a live call.

---

## Bugs found while checking (code, not opinion)

1. **FIXED in 968ae39.** The family message said "and spoke with her" even when family was called because she didn't
   answer. It now says "tried to reach her but couldn't" in that case (`server/bot.py`).
2. **FIXED in 968ae39.** No answering-machine detection: voicemail counted as answered, so no redial or escalation, the
   bot read the questions to the voicemail, and a bridge to Susan's voicemail stranded Dolores. Member and bridge calls
   now use Twilio AMD; a machine gets a hangup and counts as unanswered (`server/agent.py`, `server/server.py`).
3. **FIXED** (`shield.rebuild`). Scam Shield's 24 h window (`shield.py:58`) is lost on restart, unlike the rest of
   the gate state. **S/M**
4. **FIXED in 968ae39.** Members without family were still offered the family bridge and `notify_trusted_contact`
   dialled nobody. Prompt and tools now omit family for them (`server/calltools.py`).
5. **FIXED** (loop guard in `caller_twiml`; caller ID still open). Forwarding loop if `MEMBER_PHONE` is the forwarded landline (`README.md:48`,
   `shield.py:160`). **S** (doc + guard)
6. **FIXED in 968ae39.** If the classifier fired before she joined, the whisper failed and never retried. The whisper now
   retries up to 3 times, 5 s apart, until she has joined; the flag and the money-side hold are still recorded exactly
   once. (If she never joins within about 15 s the whisper is skipped and the hold still stands.)

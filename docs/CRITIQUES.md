# Hard questions and our answers

A skeptical judge's questions, checked against the code (file:line as of this commit), ordered by how likely
we are to be asked. Fix sizes: **S** under 30 min, **M** under 2 h, **L** after the hackathon.

---

## 1. "An AI calling an old lady about her bank is the #1 scam script. Why would she trust it?"

**Verdict: partly valid.** The design already tells her not to trust it, but on an outbound call it still asks
identity questions, which is exactly what we teach people never to answer.

- The outbound opener says she can hang up and call the number on her card (`server/calltools.py:41-42`), and the
  callback on the card number is handled and praised (`calltools.py:43-44`).
- It says early that it will never ask for a PIN, password or code (`calltools.py:25`), and the arena fails any call
  where the bot asks for one (`README.md:79-81`).
- It cannot move money at all, so a fake "Second Signature" call has nothing to imitate that a real one would do
  (`server/gate.py:13`, `gate.py:55-56`).
- Hole: after that opener, the outbound call goes straight to the credit-file questions (`calltools.py:26-28`).

**Answer:** "Our bot says in its first sentence: you don't have to trust this call, hang up and call the number on
your card. It never asks for a PIN or a code, and it can't move money, so the only thing it can do is keep her money
where it is. If she calls back on the card number, she lands on the same assistant with her case already open."

**Fix (S):** on outbound calls, ask before the questions: "Would you rather hang up and call the number on your card?
That's what I'd do." Ask the questions only if she wants to continue now. One prompt line in `FIRST_OUT` or `PROMPT`.

---

## 2. "So grandma has to set up twenty API keys?"

**Verdict: already handled in the code, missing from the pitch.** The keys belong to the credit union (or us as the
vendor). Dolores never sees them.

- The `.env`, `preflight.py`, ngrok and the Twilio webhook are server setup (`README.md:132-157`).
- What a member actually does: (1) say yes to Scam Shield, (2) give a trusted contact (`server/members.py:20`),
  (3) forward her landline to the protected number (`README.md:48`). Everything else, including the overnight calls,
  needs nothing from her: the agent calls her.
- Hole: there's no enrollment flow at all. Members are hard-coded in `members.py:14-62`. And step 3 (call forwarding,
  usually a `*72` star code) is a real ask of a tech-averse 74-year-old.

**Answer:** "Members don't configure anything. The keys are the credit union's, set up once on one server. Dolores's
part is a yes at the branch and her daughter's number. For Scam Shield, the teller turns on call forwarding with her,
which is one star code on her landline. Without Shield she still gets the overnight hold and the call."

**Fix (S):** one line in the README Scam Shield section: "Enrollment happens at the branch or by phone with staff;
staff turn on forwarding with her. The overnight protection needs no setup from her at all."

---

## 3. "Two voices at once: a whisper while the scammer keeps talking will confuse a flustered, hard-of-hearing 74-year-old."

**Verdict: valid.** Checked in `server/shield.py`:

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

**Answer:** "Fair. The bridge is sequential, but the whisper today plays over the scammer. We'd mute the scammer
for her while the whisper plays (he doesn't hear anything change), keep the whisper to about ten words, tell her she
doesn't need to answer, and say it twice. The money side doesn't depend on her hearing it: once the call is flagged,
any gift card, wire or crypto purchase in the next 24 hours is held for a human."

**Fix (S):** shorten `WHISPER` to: "{name}, it's your credit union. You don't need to answer me. This sounds like a
scam. It's okay to hang up. It's okay to hang up." **(M)** in `whisper()`, mute the caller's participant
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

**Verdict: partly valid, and it's in our own seed data.** `members.py:22`: "Grandson Leo's birthday is Oct 26."

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

**Fix (S):** a prompt line so she isn't left wondering: "If it's a first-ever gift card, wire or crypto purchase,
explain it's a new kind of purchase for her account, a person will look at it first thing in the morning, and she
did nothing wrong."

---

## 6. "Is recording or listening to her calls even legal? What about the people calling her?"

**Verdict: partly valid.**

- Every caller hears the notice before anything is streamed (`shield.py:47`, `shield.py:136`), which covers the
  all-party-consent case for the caller; Dolores consents by enrolling. Only the caller's audio is forked
  (`shield.py:138`), and the transcript is memory-only and dropped at hang-up (`shield.py:225`, `shield.py:262`).
- Holes: (a) the audio goes to Cartesia and the text to Anthropic, which we disclose (`docs/THREAT_MODEL.md:23`) but
  the notice doesn't mention; (b) **every** caller hears the notice, including Susan and her doctor; (c) we have no
  lawyer's read on whether that notice is enough under California's all-party consent law (CIPA).

**Answer:** "The caller hears that an automated assistant is listening before a single word is sent anywhere, and
Dolores opted in. We only transcribe the caller, keep nothing unless it's flagged, and then only the quote. The vendors
that process audio are named in our threat model. A real deployment gets a compliance review; this is a prototype."

**Fix (S):** skip the Shield for her trusted contact. In `caller_twiml`, if `From` matches `FAMILY_PHONE`, return a
plain `<Dial>` to her phone with no notice and no stream. Mark CIPA as "needs legal review" in Known limitations.

---

## 7. "It's 3am. She's asleep. What happens?"

**Verdict: valid, with two real bugs.**

- The agent calls her as soon as it holds, at any hour; there are no quiet hours.
- If she doesn't pick up, it redials after **20 seconds** (`agent.py:29`, `agent.py:141`), and after two missed calls
  it calls Susan and escalates (`agent.py:144-145`). So a sleeping Dolores means Susan's phone rings at 3am, about a
  minute after the purchase.
- **Bug:** that family message says "We paused a payment on your mother Dolores's account tonight **and spoke with
  her**" (`bot.py:175`), even when the reason we're calling is that we couldn't reach her.
- **Bug:** no answering-machine detection (`agent.py:112`, no `machine_detection`). If her voicemail picks up, Twilio
  reports `completed`, which isn't counted as unanswered (`agent.py:124`), so there's no redial and no escalation from
  that path, and the bot reads its verification questions, with the real answer among the options, to her voicemail.
  Same for the bridge: if Susan's voicemail answers, Dolores is put into a conference with Susan's voicemail and isn't
  brought back to the agent (`agent.py:126` only handles busy/no-answer/failed).
- What's right: the hold stands no matter what, and an analyst gets it in the morning.

**Answer:** "The money is safe while she sleeps, because the hold doesn't need her. Calling her at night is right if
the purchase is happening right now, since then she's awake. If she doesn't answer, she's probably asleep and not the
one buying, so the right move is to hold, not to wake her daughter."

**Fix (S):** different family text when `case.unanswered_calls >= 2`: "We tried to reach her and couldn't." **(S)**
quiet hours: between 9pm and 8am, after unanswered calls skip `call_family` and just escalate. **(M)** pass
`machine_detection="Enable"` in `dial()` and treat `AnsweredBy=machine_*` as no-answer.

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

**Verdict: valid.** The prefilter (`shield.py:52-55`) has gift cards, tech support, government, family emergency and
payment rails, but for bank impersonation, the script this product's own pitch is about, it only has
"your bank (may be|is) involved". No "one-time code", "verification code", "fraud department", "suspicious
activity", "Medicare", "Amazon", "refund", "Cash App" or "Venmo". The threat model admits the gate misses unknown words
(`docs/THREAT_MODEL.md:24`) but not this specific gap.

**Answer:** "The keyword gate is there to keep cost down: Claude only listens closely after a scam phrase. It's a
regex we can extend in a minute, and the arena's shield mode measures it on labelled scripts. Bank impersonation with
codes is the next pattern we'd add, and a benign script for it."

**Fix (S):** add to `PREFILTER`: `one.?time (pass)?code|verification code|code (we|I) (just )?(sent|texted)|fraud
department|suspicious (charge|activity)|medicare|amazon|refund|cash ?app|venmo|sheriff`. Add one scam and one benign
bank-call script to the arena's shield set.

---

## 11. "What about members with no family, or who don't want family involved?"

**Verdict: partly valid, with a small bug.**

- Her choice is enforced: the bridge needs a verified member who asked (`gate.py:71-77`), and "no" means don't ask
  again (`calltools.py:35`). Members with no contact don't get the `connect_family` tool (`calltools.py:73`).
- **Bug:** the prompt still tells the bot to offer it. For Robert (`members.py:45`, `"family": None`), `fam` falls back
  to "your family" (`calltools.py:87`), so the bot would say "Would you like me to connect you with your family right
  now?" with no tool to do it. `notify_trusted_contact` is still offered, and the gate lets it through, ending in
  `dial()` logging "cannot place family call" (`agent.py:101`, `agent.py:105-107`).

**Answer:** "The family bridge is an offer, never a requirement, and a no is final. Members without a contact still get
the hold, the call, and a human analyst in the morning."

**Fix (S):** in `build_prompt`, when `family_label(case)` is None, replace the family lines with "Tell her a staff
member will call her first thing in the morning." Also drop `notify_trusted_contact` in `tool_specs` when there's no
family.

---

## 12. "If the server restarts during the night, does the 24-hour Scam Shield protection survive?"

**Verdict: valid bug.** Flagged calls live only in memory: `EVENTS` (`shield.py:58`). Triage (`agent.py:38`) and the
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

**Verdict: valid design hole.** `README.md:48` says she forwards her landline to `SHIELD_NUMBER`, and the Shield rings
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

**Verdict: valid, small.** The whisper speaks `why_short` (`shield.py:185`), which the model writes from the caller's
own words. It only plays after a confident scam verdict and after "This call sounds like a scam:", so the damage is
limited, but a caller-controlled sentence is spoken to her in the credit union's voice.

**Answer:** "It only speaks after it has decided the call is a scam, and then only a short reason. We'll make the
reason a fixed phrase per scam type, so nothing the caller says can reach her in our voice."

**Fix (S):** map `scam_type` to a fixed phrase in `whisper()` (e.g. `tech_support` → "someone claiming to be tech
support") and stop speaking `why_short`.

---

## 17. "How fast is the whisper? By the time it plays she's read out the codes."

**Verdict: partly valid, not measured.** After a keyword hit: one Haiku call at low effort (`shield.py:170`), then a
fresh Cartesia render with a 15 s timeout (`shield.py:96`, `shield.py:186`), then a conference lookup and a participant
update (`shield.py:190-192`). Checks run at most every 6 s (`shield.py:227`). Nothing is pre-rendered except the
consent notice (`shield.py:121-124`). And the money side doesn't depend on the whisper's timing.

**Answer:** "A few seconds after the scam phrase, and the hold on gift cards is armed in the same moment, so even if she
buys them, they're held. We'll put the measured number on screen after our live run."

**Fix (S):** pre-render one whisper per scam type at startup (like the notice) so the only live step is the Haiku call.
Pairs with fix 16.

---

## Bugs found while checking (code, not opinion)

1. `server/bot.py:175`: the family message says "and spoke with her" even when family is called because she didn't
   answer (`agent.py:144`). **S**
2. No answering-machine detection (`agent.py:112`): voicemail counts as answered, so no redial or escalation from that
   path, the bot reads the questions to the voicemail, and a bridge to Susan's voicemail strands Dolores. **M**
3. Scam Shield's 24 h window (`shield.py:58`) is lost on restart, unlike the rest of the gate state. **S/M**
4. Members without family: the prompt still offers the family bridge (`calltools.py:87`, `calltools.py:33`), and
   `notify_trusted_contact` dials nobody. **S**
5. Forwarding loop if `MEMBER_PHONE` is the forwarded landline (`README.md:48`, `shield.py:160`). **S** (doc + guard)
6. Edge case: if the classifier fires before she joins, `conferences.list(status="in-progress")` is empty, the whisper
   fails, and `flagged` is already true (`shield.py:183`), so it never retries. The money-side hold still arms. **S**

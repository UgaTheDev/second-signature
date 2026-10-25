# Phone scripts for the live demo

Read with `docs/DEMO.md` (run table and timings). This covers only what the three people on the phones say and do.

## Cheat card

| Who | Phone | Role |
|---|---|---|
| DOLORES | ends **0632** (MEMBER_PHONE) | 74, Harold's widow. Gets every call. |
| SUSAN | ends **7664** (FAMILY_PHONE) | Daughter, executor. Gets bridged in on the estate call. |
| SCAMMER | a **third** phone, not Susan's | Dials (415) …**3852**. Never call from 7664: that number is trusted and skips the Shield. |

**Key press:** the Twilio number is a trial. Every call it places or bridges starts with Twilio's trial message, and you
press any key to continue. Answer fast and press right away.

**Verification (Dolores only).** These come live from the CRS sandbox test identity, not a real person. Its file has
no street addresses and anonymized lenders, so the bot asks **two** questions, and **both must be right**:

| Question | Say |
|---|---|
| Which of these lenders have you had an account with? | the **"Former Lender" numbered 1 to 6**. Exactly one option will be (the others are 7 and up). Say it exactly, e.g. "Former Lender 3". |
| About what year did you open your oldest credit account? | **1981** |

One wrong answer and the call can't verify (each question can be answered once). Don't use Bank of America or 1978:
those are the arena's practice data, not the live file.

---

## 1. Beat 1: Scam Shield (0:00 to 0:35)

**Who dials:** SCAMMER dials (415) …3852. Dolores's phone (0632) rings from that same number.

**Order of events (trial number):**
1. SCAMMER dials, hears the Twilio trial message, presses a key.
2. SCAMMER hears the consent notice: "This call is protected by Bayview Community Credit Union's scam shield, and an
   automated assistant is listening for scams." Then silence.
3. Dolores's phone rings. DOLORES answers immediately, hears her own trial message, presses a key at once.
4. DOLORES says "Hello?" Only then does the SCAMMER speak.

**Timing:** expect ~15 to 20 s of setup before the scammer's first word.

**SCAMMER stays silent until Dolores says "Hello?", then starts immediately.** The listener checks as soon as it
hears a trigger word, even mid-sentence, so put the trigger words early and say them clearly.

| Speaker | Line |
|---|---|
| DOLORES | Hello? |
| SCAMMER | Mrs. Whitcomb, this is collections about Harold's debts. As his widow you're responsible, you have to pay today in gift cards, and don't tell your bank. |
| | *(SCAMMER pauses about 3 seconds)* |
| SCAMMER | Ma'am? Are you there? |
| | *(Dolores hears two soft bell tones, then the whisper. The scammer hears silence: he's muted while it plays.)* |
| WHISPER (only Dolores hears it) | "Dolores, it's your credit union. You don't need to answer me. This sounds like a scam. It's okay to hang up. It's okay to hang up." |
| SCAMMER | *(once unmuted)* This is your last chance today. |
| DOLORES | *(beat, relieved)* No. I don't think so. *(hangs up)* |

The first line hits the Shield's trigger words: collections, debts, widow, gift cards, don't tell. The scammer's lines
take about 15 s in total.

**Expect:** the chime and whisper 2 to 5 s after the first line ends. The **Scam Shield** view fills in with his
exact words.

**If it goes wrong:**
- No chime within ~8 s: SCAMMER says once, slowly, "You need to buy gift cards today to pay Harold's debts." The
  listener re-checks every 6 s.
- Dolores's phone never rings: SCAMMER hangs up and the presenter narrates from the dashboard.
- The scammer started talking before Dolores joined: keep going. The whisper retries for ~15 s until she's on.

---

## 2. Beat 3: the estate call (1:30 to 1:50)

**Who dials:** the presenter clicks **Call Dolores**. Dolores's phone (0632) rings from (415) …3852. Later the bot rings
Susan (7664) from the same number.

DOLORES answers, hears the trial message, presses a key. The bot speaks first.

| Speaker | Line |
|---|---|
| BOT | Hi Dolores, this is the after-hours assistant at Bayview Community Credit Union, about Harold's account. I'm so sorry for your loss. You can always hang up and call the number on your card instead, and I will never ask for a PIN, password or code. |
| BOT | Which of these lenders have you had an account with? *(four "Former Lender" options)* |
| DOLORES | Former Lender *(the one numbered 1 to 6)*. |
| BOT | About what year did you open your oldest credit account? *(four options)* |
| DOLORES | 1981. |
| BOT | *(explains, a few short sentences)* Harold's Social Security payments that arrived after March have to go back to the US Treasury. The credit union is sorting that out. You don't need to do anything tonight, and you owe the man who phoned you nothing. A real request comes in a letter, never a phone call asking for gift cards. |
| DOLORES | Do I owe the government anything? |
| BOT | *(should say)* That isn't settled yet. The credit union is handling it and will write to you if anything is needed from you. |
| BOT | Would you like me to connect you with your daughter Susan, who is the executor of Harold's estate, right now? |
| DOLORES | Yes, please. |
| BOT | I'm connecting you now. Please stay on the line; you'll hear music for a moment. |

Dolores now hears hold music. SUSAN's phone (7664) rings. SUSAN answers, hears the trial message, presses a key, then:

| Speaker | Line |
|---|---|
| BOT (to Susan only) | Hi Susan, this is the after-hours assistant at Bayview Community Credit Union. Your mother Dolores is on the line and asked to talk with you about Harold Whitcomb's estate. We will never ask you for codes or passwords. Connecting you now. |
| SUSAN | Mom? I'm here. |
| DOLORES | Someone called saying I owe Harold's debts. |
| SUSAN | You don't owe him anything. I'll come over tomorrow and we'll go through the letters together. |

Both hang up on the presenter's cue.

**Wait for the bot to finish speaking before answering.** Speak each answer once, clearly, nothing else.

**If it goes wrong:**
- No option is numbered 1 to 6, or no 1981: say "I'm not sure". The bot will say a staff member will call during business hours and hang up. That is the designed failure, so
  the presenter says so and narrates from the dashboard. Don't redial live.
- The bot asks no questions (CRS down): it won't discuss the account and ends the call. Also designed.
- The bot says the Treasury question is settled or that she owes nothing: carry on, and the presenter notes it later.
- Susan doesn't answer within ~30 s: the bot comes back to Dolores, says Susan didn't pick up and the credit union will
  reach her during business hours. Dolores: "Thank you. Goodbye."

---

## 3. Optional: a judge's own scenario (Overnight holds, "Run a scenario")

**Who dials:** the presenter clicks **Run a scenario** in the Overnight holds toolbar. For a Dolores purchase (the gift
card held by rule, or the $1,500 bike), Dolores's phone (0632) rings from (415) …3852. Robert's $100 gift card goes
through with no call.

DOLORES answers, presses a key for the trial message.

| Speaker | Line |
|---|---|
| BOT | Hi, this is the after-hours assistant at Bayview Community Credit Union, calling for Dolores. You don't have to trust this call. You can hang up and call the number on the back of your card, and I'll pick up there. |
| BOT | Would you rather hang up and call that number, or keep going with me now? |
| DOLORES | Keep going. |
| BOT | *(the same two questions: answer from the cheat card)* |
| BOT | Did you make this purchase yourself? Did anyone ask you to buy it? |

Then one of these:

**Gift card (scam):**

| Speaker | Line |
|---|---|
| DOLORES | A man from Microsoft said my computer was hacked and told me to buy them. |
| BOT | *(keeps the hold, explains that real companies never ask for gift cards, sends it to an analyst, offers Susan)* |
| DOLORES | No thank you, I'm fine. *(the bot ends the call)* |

**Bike (legit, over the limit):**

| Speaker | Line |
|---|---|
| DOLORES | Yes, I bought it myself, for my grandson's birthday. Nobody asked me to. |
| BOT | *(release is refused because it's over the limit: an analyst will look at it in the morning, and she did nothing wrong)* |
| DOLORES | All right. Thank you. Goodbye. |

**If it goes wrong:** if verification fails or the bot ends early, hang up. The case file on the dashboard shows the hold
and the escalation either way.

# Second Signature: UI design brief

> Paste this whole file into a design tool. It describes what the product is, who looks at the screen,
> every piece of data the UI can show (with real field names and enum values), every screen and
> component, the live behaviours, a demo storyline, sample data for mockups, and design direction.
> Everything here is taken from the working code in this repo; nothing is aspirational unless it says so.

---

## 1. The one-paragraph pitch

**Second Signature is the overnight fraud analyst a small credit union can't afford.** When something
suspicious hits an older member's account at 11pm, it **holds the payment**, **calls the member** in a
calm, warm voice to check on her, **puts her on the line with her family** if she wants, and **writes a
case file it can defend** in the morning. It also runs **Scam Shield**: it listens (with consent) to calls
on her protected phone line and **whispers a warning only she can hear** while the scammer is still
talking. The core promise, repeated everywhere: **it can never move money on its own.** A human analyst
holds the only keys that release large holds, refund, or close anything.

The name comes from the idea of a second person co-signing a risky decision: the AI is the second
signature on her payment, never the first.

---

## 2. The story the UI has to tell

Meet the cast (these are the real demo personas in `server/members.py`):

| Person | Who | Role in the demo |
|---|---|---|
| **Dolores Whitcomb, 74** | Retired school librarian, member since 1991, lives alone in Santa Barbara. Buys groceries, pharmacy, utilities, church, the occasional cafe. **Never** gift cards, electronics or wires. Grandson Leo's birthday is Oct 26. | The protagonist. A scammer convinces her to buy $500 of Target gift cards. |
| **Susan** | Dolores's daughter, her trusted family contact. | Gets a call; can be bridged live into a private call with her mother. |
| **Robert Chen, 71** | Buys $50–100 gift cards for his grandchildren every Christmas and birthday. | The control case: his $100 gift card should **not** be held. Proves the system isn't just "block all gift cards." |
| **The scammer** | A teammate on a phone. Tech support, IRS, "your grandson is in jail", romance. | Calls Dolores's protected line, gets detected. |
| **The analyst** | A human fraud analyst at **Bayview Community Credit Union** (fictional). | The person the dashboard is for. Reviews cases in the morning, releases or confirms fraud, approves policy changes. |
| **Judges** | Hackathon judges watching the screen. | They need to *see* the AI reason, *see* the guardrails refuse things, and *feel* the human moment. |

**The emotional arc:** Isolation → interruption → reconnection. Scams work by isolating the victim
("don't tell the bank, they may be in on it"). Second Signature's job is to interrupt the scam gently and
reconnect her with people who care about her, without ever shaming her or taking control away from her.

**The trust arc:** The AI is powerful but visibly *fenced in*. The most dramatic moments in the UI should
be the **refusals**: the permission gate saying no, the code floor overriding the model. Judges should come
away thinking "this AI is safe *because* I can see the walls."

---

## 3. Who looks at the screen, and what they need

1. **The after-hours fraud analyst (primary user).** Needs: which cases are open, what the AI did and
   why, what the member said, and two big buttons: **Release** or **Confirm fraud**. Works at night or first
   thing in the morning. Possibly older-skewing credit-union staff, not a security engineer. Clarity over density.
2. **The demo audience (hackathon judges, on a projector).** Needs: everything legible from the back of a
   room, live motion as events stream in, an obvious "something just happened" moment, and a clear separation
   between what is real and what is simulated.
3. **The member (Dolores) never sees this UI.** Her entire experience is a phone call. But the UI should
   *represent* her with dignity: she is a person being protected, not a "fraud subject."

---

## 4. How the system works (the pipeline the UI visualises)

```
Nessie sandbox bank (polled every 2s)
        │  new purchase
        ▼
TRIAGE (Claude Opus 5.5) ◀── CRS: identity check + credit file + fraud signals
        │                ◀── Elastic: "has she ever bought gift cards?" (history search)
        │                ◀── FTC scam alerts (scraped by our Apify actor)
        │                ◀── Scam Shield: "a scam call was flagged 6 min ago"
        ▼
CODE FLOOR + PERMISSION GATE  (plain code, not AI; the model cannot override it)
        │
        ├── allow → case status "allowed", nothing else happens
        └── HOLD  → case status "open"
                │
                ▼
        VOICE CALL to the member (Twilio phone call; Cartesia voice; Claude Haiku 5.5 brain)
          · verifies identity with questions built from her credit file (2 right answers; 3 if CRS shows a fraud alert)
          · asks about the purchase, listens for coaching / pressure ("they told me not to tell the bank")
          · if red flags: offers to connect her with her daughter right now (her choice)
          · if no answer: redials after 20s; after 2 unanswered calls, calls the family contact
                │
                ▼
        CASE FILE in Convex (live) ──▶ DASHBOARD (this UI)
                                          · analyst releases / confirms fraud
                                          · 7am: MORNING REVIEW, an AI (Factory Droid) reads the night's
                                            cases and proposes an edit to the policy; a human approves it
```

Separately, **Scam Shield** runs on her protected phone line:

```
Scammer calls Dolores's protected line
  → caller hears: "This call is protected by Bayview's scam shield, and an automated assistant is listening for scams."
  → call goes through to Dolores; we listen to the CALLER's audio only
  → speech-to-text → keyword gate (gift cards, "don't tell", Microsoft, IRS, warrant, bail…) → Claude Haiku verdict
  → if scam (confidence ≥ 75%): whisper to HER leg only:
     "Dolores, this is Bayview. Only you can hear me. This call sounds like a scam: he wants gift cards and secrecy.
      Real companies never ask for gift cards or secrecy. It's okay to hang up."
  → a case appears on the dashboard with the scammer's exact words as evidence
  → for 24 hours, any gift card / wire / crypto purchase is held by rule; only an analyst can release it
```

---

## 5. The data model (exactly what the UI can display)

Backend: **Convex** (real-time database; the UI subscribes and updates live, no polling, no refresh).
Schema: `dashboard/convex/schema.ts`.

### 5.1 `cases`: one per suspicious purchase or flagged scam call

| Field | Type | Notes / example |
|---|---|---|
| `member_id` | string | `"dolores"`, `"robert"` |
| `member_name` | string | `"Dolores Whitcomb"` |
| `txn_id` | string | Nessie transaction id |
| `merchant` | string | `"Target Gift Cards"`, `"Bay Cycles"` |
| `category` | string | `gift_card`, `electronics`, `wire_transfer`, `crypto`, `groceries`, `pharmacy`, `sporting_goods`, `restaurant`, `other`; Scam Shield cases use `scam_call` (the UI keys off this, `isShieldCase`) |
| `amount` | number | dollars, e.g. `500` |
| `opened_at` | number | epoch ms |
| `status` | enum | see 5.2 |
| `risk_signals` | array of `{source, fact, weight}` | see 5.3 |
| `plan` | string | what the agent intends to do next, plain English |
| `decision_rationale` | string | why it held or allowed, plain English, cites signals |
| `state` | optional object | gate flags the server saves after each action: `verified`, `red_flags`, `unanswered_calls` (number), `family_notified`, `held_by_rule`, `bridged` (booleans). The dashboard reads it for the progress row, the decision dialog and the stats. |

Indexes: `by_txn` (`txn_id`, makes opening idempotent) and `by_status`. `member_id` and `txn_id` are not displayed.

### 5.2 Case status: the most important visual system

| Value | Label shown (`STATUS_LABEL`) | Meaning | Suggested feel |
|---|---|---|---|
| `allowed` | Let through | Triage let it through, no hold. (Robert's $100 gift card.) | Quiet, neutral, recedes |
| `open` | Held | Payment paused, waiting on member call / analyst. **The live, active state.** | Amber, attention, gently pulsing |
| `released` | Released | Member verified and approved, or analyst released. Money flows. | Calm green, resolved |
| `escalated` | With an analyst | Couldn't verify, red flags, or over the $1,000 limit. Needs a human. | Red-ish, urgent but not panicked |
| `confirmed_fraud` | Fraud confirmed | Analyst confirmed fraud. | Solid red, final |

### 5.3 Risk signals: the evidence

Each signal is `{ source, fact, weight }`. `weight` is 0..1 (how much it pushed toward holding).
`source` is exactly one of five values (`server/triage.py`):

| `source` | Comes from | Example `fact` |
|---|---|---|
| `shield` | Scam Shield live call detection | `Scam Shield flagged a tech support call 6 min ago; caller said: "you need to buy the gift cards today and read me the numbers, and don't tell the bank"` (weight 0.95) |
| `crs` | CRS identity / fraud / credit file | `Identity check PASS`, `Fraud alert on credit file` |
| `elastic` | Purchase history search | `No gift card purchases in her history` |
| `apify` | FTC consumer alerts (our Apify actor) | `FTC alert: tech support scammers demanding Target gift cards` |
| `nessie` | The transaction itself / its pattern | `$500 at Target Gift Cards (gift_card)`, `Purchase at 11:42 PM, outside her normal pattern` |

Visualise these as an **evidence list with weight bars**: the case file is an argument, and each signal is a
cited piece of evidence.

### 5.4 `actions`: append-only event log per case (the timeline)

`{ caseId, t, type, by, detail }`

**`by`** (who did it): `agent` (the AI), `member` (Dolores, via the call), `human` (analyst), `gate` (the
permission gate / code floor, i.e. plain code saying NO).

**`type`** values the code emits:

| type | by | What happened | Example detail |
|---|---|---|---|
| `triage` | agent | AI decision | `HOLD: First-ever gift card purchase, late at night, matches an active FTC tech-support alert.` |
| `override` | gate | **Code floor overrode the AI** | `Triage said allow, held anyway: first gift_card purchase in her history; held by rule regardless of triage` |
| `hold` | agent | Payment paused | `Paused $500 at Target Gift Cards. <plan>` |
| `verify` | agent / member | Identity verification | `3 verification questions from her CRS credit file, answers kept server-side` / `Identity verified from her credit-file answers` / `Identity verification failed` |
| `call` | agent | Outbound/inbound call events | `Calling Dolores`, `Call 1 not answered (no-answer)`, `Call ended: member hung up` |
| `family_call` | agent | Calling Susan with a message | `Calling Susan: payment paused, please call Dolores (no details shared)` |
| `family_bridge` / `connect_family` | agent | Live mother–daughter connection | `Susan answered; joining her to Dolores's call. The agent leaves the line.` |
| `deny` | gate | **Permission gate refused an action** | `member tried to release: first-ever gift card purchases need an analyst to release` |
| `shield` | agent | Scam Shield whisper sent | the exact whisper text |
| `release` | member / human | Hold released | `Released by analyst` |
| `call_member` / `call_family` | agent | Agent decided to call | `Calling Dolores about the paused purchase`, `Trying her again` |
| `escalate` | agent | Sent to a human | `Member unreachable; hold stays until an analyst reviews it`, `Hold reached 1 business day; the agent's authority ends, an analyst decides` |
| `confirm_fraud` | human | Fraud confirmed | `Confirmed by analyst` |
| `error` | agent | Something broke | `cannot place member call: phone/LOCAL_SERVER_URL/TWILIO_NUMBER not set` |

### 5.5 `transcript`: what was said on the call, live

`{ caseId, t, speaker: "agent" | "member", text }`. Streams in line by line **during** the call.
Interleaved with `actions` by timestamp it becomes one chat-like timeline.

### 5.6 `reviews`: the morning review (AI proposes a policy edit; a human approves)

| Field | Values |
|---|---|
| `started_at` | epoch ms |
| `trigger` | `schedule` (7am), `analyst` (button) or `overrides` (after analyst overrides of the agent) |
| `status` | `running` → `proposed` → `approved` / `rejected`; or `failed` |
| `steps` | Droid's visible work log, streaming: tool calls, `ALLOWED`/`DENIED` permission checks, messages |
| `summary` | one-paragraph summary of what it found (false positives, misses) |
| `diff` | unified diff of `policy.md` (empty if no change proposed) |

### 5.7 `arena`: red-team scoreboard runs

Written by `arena.py --publish`. `{ t, kind: "calls" | "shield", summary, rows: [{ scenario, kind, passed, runs, critical, misses }] }`.
The query `cases.latestArena` returns `{ calls, shield }` (the newest run of each `kind`, or `null`).
`critical` counts scams or attacks that got through; `misses` is a text note on failures.

### 5.8 `cases.stats` (computed, not a table)

`{ total, allowed, held, open, released, memberReleases, escalated, confirmedFraud, heldByRule, gateDenials,
medianMinutesToResolve }` (the last is `null` until a case has both a hold and a release/fraud action). It reads
the latest 500 cases and their actions. The stats strip shows all of these.

---

## 6. The rules the UI must make visible (the permission matrix)

This is enforced in code (`server/gate.py`), not by the AI's prompt. It's the product's trust story and
deserves a beautiful, prominent treatment, not a footnote table.

| Action | Agent alone | Needs member's yes | Needs human analyst |
|---|---|---|---|
| Read transactions, identity signals | ✅ | | |
| Place a hold on a pending purchase | ✅ (max 1 business day) | | |
| Call the member; verify identity first | ✅ | | |
| Listen to calls on her protected line (callers are told) | ✅ (opted in; memory only) | | |
| Whisper a scam warning only she can hear | ✅ | | |
| Call the trusted family contact | Only on red flags or 2 unanswered tries | | |
| Connect the member live to her trusted contact (agent leaves the call) | | ✅ (verified, her choice) | |
| Release a hold under $1,000 (not a first-ever gift card, wire or crypto) | | ✅ (after verification) | |
| Release a hold of $1,000+ | | | ✅ |
| Move, refund, or send money | ❌ never | ❌ | ✅ only |
| Close or freeze the account | ❌ never | | ✅ only |

Two kinds of "no" appear in the timeline, and they should look distinct and important:
- **Permission gate (`deny`)**: someone (the AI, a caller, a prompt injection) tried something not allowed.
- **Code floor (`override`)**: the AI said "allow", and hard-coded rules held it anyway.

---

## 7. Screens and components

The dashboard is a **single route** (Next.js, `dashboard/app/page.tsx`) with three tabs, split into
components in `dashboard/app/components/` (`Header`, `StatsStrip`, `CaseQueue`, `CaseView`, `PolicyReview`,
`Evidence`, `ScenarioSheet`, `ui.tsx`). Data hooks live in `dashboard/app/lib/data.ts`. The palette is one
amber accent on warm charcoal (dark, default) or warm paper (light); red and green appear only as status text.
Everything below exists today; the layout is open to change.

### 7.0 Global behaviour
- **Themes**: dark (default) and light, toggled by the sun/moon icon button ("Switch to light theme" /
  "Switch to dark theme"). Stored in `localStorage` key `theme`, applied on `<html data-theme>` before first paint.
- **Sample-data mode**: the whole UI can run on built-in sample data (the Dolores story: gift cards, a scam
  call, a bike, Robert's gift card, a $1,500 held purchase, plus sample stats, arena and review from
  `app/lib/sample.ts`). It is on when the URL has `?demo=1`, or when `NEXT_PUBLIC_CONVEX_URL` is not set.
  When Convex is configured, a header button toggles it ("Use sample data" / "Use live data"). In sample mode
  "Run a scenario" and the policy-review buttons send nothing and show a toast: "Sample data is on, so nothing was sent."
- **Toasts**: bottom-right, 4 s (errors 9 s, red border). Every analyst action reports success or a plain-sentence error this way.
- **Dialogs**: native `<dialog>` (focus trap, Esc closes); the scenario form is a right-hand side sheet.
- **Passcode**: analyst actions need the server's `ANALYST_TOKEN`; see 7.1 and section 11.

### 7.1 Header (all tabs)
- Title **Second Signature**; subtitle **Overnight fraud desk · Bayview Community Credit Union**.
- **Server status** dot + label: "Showing sample data" (amber), "Checking the server", "Server connected"
  (green), "Server not reachable" (red). Pings `/health` every 8 s (live mode only).
- Buttons: **Run a scenario** (primary), **Use sample data / Use live data** (only if Convex is configured),
  and three icon buttons: **Enter analyst passcode** (key icon; browser prompt "Analyst passcode (the server's
  ANALYST_TOKEN)"; toast "Passcode saved in this browser." / "Passcode cleared."), **Delete all cases**
  (reset icon; disabled in sample mode; confirm "Delete every case and review from the dashboard? The server's
  open cases are cleared too."), and the theme toggle.
- Tab bar: **Live desk** · **Policy review** · **How we know it works**.

### 7.2 Live desk tab
Stats strip on top, then a two-column grid (case queue 288px | case view) on desktop.

**Stats strip** (`StatsStrip`): seven numbers (serif numerals, label under each, tooltip with the sub-line):
| Label | Sub-line (tooltip) |
|---|---|
| `total` **checked** | "N let through" |
| `held` **held** | "N by the code floor" |
| `released` **released** | "N by the member after verifying" |
| `escalated + open` **waiting on a person** | "N with an analyst" |
| `confirmedFraud` **fraud confirmed** | "payments that stayed stopped" |
| `gateDenials` **refused by the gate** | "things the agent or a caller wasn't allowed to do" |
| `medianMinutesToResolve` **median to decide** (`–` if none, else "X.X min") | "from hold to release or fraud" |

**Case queue** (`CaseQueue`, heading **Cases**):
- Newest first; the newest case auto-selects when it arrives and its row flashes amber once (`.arrive`,
  disabled under `prefers-reduced-motion`).
- Row: merchant (with a phone-incoming icon for Scam Shield cases, `category === "scam_call"`), amount in
  mono (hidden when 0), then "FirstName · time" and a status mark (dot + label).
- Status labels (`STATUS_LABEL`): `allowed` **Let through**, `open` **Held**, `released` **Released**,
  `escalated` **With an analyst**, `confirmed_fraud` **Fraud confirmed**. Dots: grey, amber, green, amber, red.
- States: loading "Loading cases…"; after 8 s of no answer "The case database isn't answering. Check
  NEXT_PUBLIC_CONVEX_URL and that `npx convex dev` is running, or switch to sample data."; empty "Nothing yet.
  Use “Run a scenario” to send a test purchase."

**Case view** (`CaseView`):
- Empty: "Select a case on the left to see what happened and what is waiting on you."; loading "Loading the case…".
- Header: "Member · category · opened time", **merchant** at 36px serif with the amount beside it, status mark
  and its hint on the right (e.g. "Payment paused; the member is being contacted", "Needs a person to decide").
- **Progress row** (purchase cases): six steps **Checked › Held › Called › Verified › Family › Decided**, each
  ticked from what the case file shows (actions plus `state.verified` / `state.bridged`); `allowed` cases add
  "· no hold was needed".
- **Scam Shield banner** (replaces the progress row for `scam_call` cases): "Scam Shield flagged this call while
  it was happening", plus the top signal's fact and "Only <first name> heard the warning; the caller did not."
- **Decision bar** (only when status is `open` or `escalated`): "This case needs a person to decide. Neither
  choice can be undone from here." Buttons **Release payment** (primary) and **Confirm fraud** (danger). Each
  opens a confirm dialog ("Release this payment?" / "Confirm this as fraud?") stating the amount and merchant,
  then context bullets drawn from `state`: whether she passed identity checks, "First purchase of this kind in
  her history, so the code floor held it.", "She described pressure or secrecy on the call." Buttons **Go back**
  and Release payment / Confirm fraud ("Sending…" while busy). Toasts: "Released. The payment goes through." /
  "Marked as fraud. The payment stays stopped."; server errors (including the 401 passcode message) show as red toasts.
- Two columns below:
  - Left, with two tabs: **What happened** (timeline) and **Call transcript (N)**.
    - Timeline, sorted by time. Key events are callouts with a coloured left rule: **gate** rows red with a lock
      ("Code floor overrode the model" for `override`, "Gate refused an action" for other gate actions),
      **family** rows amber ("Family · family bridge", "connect family", "call family"), **Scam Shield** rows
      amber with a shield icon; `release`, `confirm_fraud` and `escalate` also render as callouts (grey rule).
      Everything else is a quiet one-line log row (time · type · detail). Empty: "Nothing has happened on this case yet."
    - Transcript: plain text blocks, "Assistant · time" on the left, the member (first name) indented with a
      rule; auto-scrolls to newest. Empty: "No call was recorded for this case."
  - Right: **Why** (`decision_rationale`, fallback "No reason was recorded."), **The plan** (`plan`, only if
    set), **Evidence**: each signal sorted by weight, with `source` in mono, "weight NN%", the fact, and a thin
    weight bar (fallback "No evidence was recorded.").

### 7.3 Policy review tab (`PolicyReview`)
- Title **Policy review**; blurb: "An AI agent (Factory Droid) reads last night's cases, finds holds that were
  wrong or payments that got through, and proposes an edit to the guidance the triage model reads. It can edit
  one file. Nothing changes until an analyst approves the diff."
- **Run a review now** button ("Review running…" and disabled while `status` is `running`).
- No review yet: "No review has run yet. It runs at 7 am, after three analyst overrides, or when you click above."
- Latest review: "Latest review: <status>, started by <the 7 am schedule | an analyst clicking Run | analysts
  overriding the agent> on <date>", the `summary` paragraph, then two columns: **What Droid did** (monospace
  step log, auto-scrolls) and **Proposed change to policy.md** (diff: green additions, red deletions, grey hunk
  headers; "Droid proposed no change." / "No diff yet.").
- When `proposed` with a diff: **Approve change** (primary; toast "Approved. Triage now reads the new policy.")
  and **Reject** (toast "Rejected. The policy is unchanged.").

### 7.4 How we know it works tab (`Evidence`)
- **What the agent is allowed to do**: the permission matrix from section 6 as a table (columns The agent
  alone / With the member's yes / A human analyst; green check or red X with a note). Footnote: "Enforced in
  code (`server/gate.py`), not in the prompt. A refusal is written to the case file." Its two release rows
  differ slightly from section 6: "Release a hold under $1,000 (not a first-ever gift card, wire or crypto)"
  and "Release any other hold".
- **Tested against scammers** (red-team arena scoreboard, from `api.cases.latestArena`): "Claude plays
  scammers, impostors and real members against the same call brain that answers real calls." Table with
  **Scenario**, **Passed** ("3 of 3"), **Got through** (the `critical` count, bold red if above 0; row tooltip
  shows `misses`), then the run summary line and run time. A one-line Scam Shield summary shows below if a
  `shield` run exists (its rows are not rendered). Empty: "No run has been published. Run `uv run python
  arena.py -n 3 --publish` in `server/`."
- **What is real, what is simulated**: two lists, Real and Simulated (the honesty panel of old section 7.7;
  the FTC/Apify row and the Cartesia Sonic/Ink detail are no longer on screen).

### 7.5 Run a scenario (side sheet, `ScenarioSheet`)
Opened from the header. Intro: "Posts a real purchase to the bank sandbox. The agent picks it up within two seconds."
- **Start from an example** presets: **$500 gift cards** ("Dolores has never bought gift cards: held by rule"),
  **$300 bike** ("Out of pattern but ordinary: the agent calls and she can release it"), **$100 gift card for
  Robert** ("He buys these every year: let through").
- Form: **Member** (Dolores Whitcomb, 74 / Robert Chen, 71), **Merchant**, **Category** (the nine categories
  from 5.1, underscores shown as spaces), **Amount (dollars)**, **Note** (optional), submit **Send purchase**
  ("Sending…"). Success toast: "Purchase sent to the bank sandbox. The case appears in a few seconds."

### 7.6 Design opportunities (backend exists, no UI yet)
Each verified against the code on this date:
- **Scam Shield live view**: the dashboard only shows a finished Shield case (a `scam_call` row, banner and
  one `shield` action). There is no in-progress call view, live caller transcript, confidence meter against
  the 75% threshold, whisper moment, or the 24-hour "armed" countdown. (Server: `/shield/twiml/{key}`.)
- **Arena Scam Shield rows and per-run detail**: the scoreboard renders only call-scenario rows; the `shield`
  run's `rows` and `kind` (`scam` / `attack` / `legit`) are stored but not shown, and there is no run history
  (only the latest of each `kind`).
- **Member profile card**: no member data is shown beyond the name (first name in the queue and transcript).
  Age, member since, normal spending, trusted contact and Scam Shield on/off exist only in `server/members.py`.
- **Hold expiry**: nothing shows the 1 business day limit or a countdown; the case itself only carries `opened_at`.
- **Live-call indicators**: no "call in progress" state, waveform, verification progress (question 1 of 3) or
  family-bridge animation; the six-step Progress row is the only call-stage cue and only reads past actions.
- **Cross-case views**: the case list is capped at 50 (`api.cases.list`) with no filter, search or status grouping.

---

## 8. Live behaviour (design for motion, not static screens)

Everything is real-time via Convex subscriptions. Over a ~3 minute demo the screen changes constantly:

1. A new case **appears** at the top of the list and auto-selects.
2. Triage rationale and risk signals **fill in**.
3. A red **CODE FLOOR** callout may appear ("Triage said allow, held anyway").
4. Status flips to **HELD**.
5. "Calling Dolores" → the phone rings in the room → transcript lines **stream in** as she talks.
6. Verification: questions asked, answered right or wrong.
7. Possibly a **PERMISSION GATE · deny** (e.g. the scammer-coached member tries to release her own first-ever gift card).
8. Possibly the **family bridge**: Susan answers, "The agent leaves the line."
9. Status resolves: RELEASED / ESCALATED / FRAUD.

Design for: arrivals, state transitions, streaming text, "live call" indicators, and a satisfying resolution.
Respect `prefers-reduced-motion`.

---

## 9. Demo storyline (the three cases to mock up)

**Case A: Dolores, $500 Target gift cards, 11:42 PM (the hero case)**
1. *(Earlier)* Scam Shield flagged a "Microsoft tech support" call to her protected line 6 minutes ago. Evidence:
   *"you need to buy the gift cards today and read me the numbers, and don't tell the bank."*
2. Purchase arrives. Signals: shield 0.95 · first gift card in history 0.8 · FTC alert match 0.6 · late night 0.4.
3. Triage: HOLD. Code floor would have held it anyway.
4. Agent calls: *"Hi Dolores, this is Bayview Community Credit Union. Nothing's wrong with your account, I just
   want to check a purchase with you before it goes through."*
5. She verifies (2 of 2 right). She says the man on the phone told her not to tell anyone.
6. Agent: *"Would you like me to connect you with Susan right now? You can talk privately, I'll leave the line."*
7. She says yes. Family bridge. Agent leaves.
8. Status: ESCALATED → analyst clicks **Confirm fraud**.

**Case B: Dolores, $300 Bay Cycles bike** (a gift for grandson Leo, whose birthday is Oct 26).
Held (unusual category), she verifies, explains, releases it herself on the call → RELEASED. Shows the
system isn't paranoid about everything.

**Case C: Robert, $100 Target gift card.**
He buys these every year → **ALLOWED**, no call. One quiet row. Shows the system knows its members.

**Sample transcript snippet (Case A):**
```
agent   11:43:05  Hi Dolores, this is Bayview Community Credit Union. Nothing's wrong with your account. I just want to check one purchase with you before it goes through. Is now an okay time?
member  11:43:12  Oh. Yes, I suppose so.
agent   11:43:15  Thank you. First, so I know I'm talking to you: which of these streets have you lived on? Maple Avenue, Ocean View Drive, Harbor Boulevard, or Cedar Lane?
member  11:43:24  Ocean View. That's my house.
agent   11:43:40  Thank you, that's all I needed. I'm seeing five hundred dollars of Target gift cards tonight. Can you tell me a little about that?
member  11:43:52  The man from Microsoft said my computer has a virus, and I have to pay with the cards. He said not to tell the bank because they might be involved.
agent   11:44:01  I'm really glad you told me. You haven't done anything wrong. Real companies never ask for gift cards, and they never ask you to keep it secret. Would you like me to connect you with Susan right now? You two can talk privately and I'll step off the line.
member  11:44:10  Yes. Yes, please.
```
(Illustrative copy for mockups; the real bot generates its own wording live.)

---

## 10. Design direction

### Tone
- **Calm, trustworthy, humane.** This is a *credit union* (small, local, member-owned) protecting a
  74-year-old librarian. It should feel like a warm, competent night-shift colleague, not a cyber-security
  war room. Avoid hacker-green-on-black, glitch effects, skulls, "THREAT DETECTED" theatrics.
- **Serious about safety.** The guardrails are the hero. The refusal moments (gate / code floor) should be
  the most visually confident elements on the page: strong, clear, unmistakable.
- **Dignity for the member.** Never style Dolores as a suspect. She is the person being protected. The
  language is "check on her", "her choice", "the agent leaves the line."

### Visual ideas (suggestions, not requirements)
- **After-hours palette**: deep ink/navy or warm charcoal night background with soft paper-white cards; or the
  reverse, warm off-white with ink. Accent colours carry meaning: amber = held, green = released, red =
  gate/fraud, warm orange/rose = family.
- The **"second signature"** motif: a handwritten-style signature stroke, two signatures, a co-sign seal.
  Could be the logo, the approve animation, or the empty state.
- **Typography**: currently Fraunces (serif display), IBM Plex Sans (body) and IBM Plex Mono
  (money, IDs, logs). The serif already adds warmth; keep monospace for money, IDs and logs.
- **Large, legible type.** It's projected for judges, and analysts may be older. Body ≥ 16px; the case amount
  can be 40–56px.
- Live call: waveform or pulsing ring; verification progress as dots or checks; the family bridge as two
  lines joining, with the agent's line stepping away.

### Accessibility and constraints
- WCAG AA contrast; never colour-alone for status (always a text label too).
- Light and dark mode.
- Desktop-first (projector, 1440–1920px wide) but should not break on a laptop or tablet.
- Keep these copy strings verbatim, since they're the product's promises: "It can never move money on its own",
  "The agent leaves the line", "Enforced in code, not in the prompt", "Only you can hear me."

---

## 11. Tech constraints for whoever implements the design

- **Next.js 16 (App Router) + React 19, Tailwind CSS v4 (CSS-first, `@import "tailwindcss"` and an
  `@theme inline` block in `app/globals.css`, no `tailwind.config`), Convex, `lucide-react` icons.**
  Convex hooks are in `app/lib/data.ts` (untyped `anyApi`): `api.cases.list` (latest 50), `api.cases.get({caseId})`
  → case + `actions` + `transcript`, `api.cases.stats`, `api.cases.latestArena`, `api.cases.latestReview`.
  With no `NEXT_PUBLIC_CONVEX_URL` the app runs on sample data (`app/lib/sample.ts`).
- **Design tokens** (CSS variables, `:root[data-theme="dark"|"light"]`, mapped to Tailwind colours): `bg`,
  `surface`, `raise`, `line`, `ink`, `ink-2`, `ink-3`, `accent` (amber), `on-accent`, `danger`, `ok`. Utilities:
  `.num` (tabular numerals), `.arrive` (1.8s amber flash on a new case), `prefers-reduced-motion` respected.
- **Fonts** (`next/font/google` in `app/layout.tsx`): **Fraunces** 600/700 for the title, case merchant and
  numerals (`font-display`), **IBM Plex Sans** 400/500/600 for reading (`font-sans`), **IBM Plex Mono** 400/500
  for ids, amounts in the queue, logs and diffs (`font-mono`). Body is 16px.
- **Analyst actions** are `POST`s from `app/lib/api.ts` to `NEXT_PUBLIC_SERVER_URL`: `/cases/{id}/release`,
  `/cases/{id}/confirm_fraud`, `/scenario` (JSON body: `member_id, merchant, category, amount, note`),
  `/review`, `/review/approve`, `/review/reject`, `/reset`; plus `GET /health` for the status dot. On the
  server all of these except `/health` require the analyst dependency (`server/server.py`).
- **Auth**: every POST sends header `X-Analyst-Token` with the passcode the analyst typed (stored in
  `localStorage` key `analystPasscode`), and `ngrok-skip-browser-warning: 1` (ngrok's free tier otherwise
  serves an HTML interstitial). A 401 shows "The analyst passcode is missing or wrong. Enter it with the
  Passcode button at the top." Errors come back as a string (`detail` from the server, or "The server
  answered N: ..."), shown as a red toast; unset server URL and network failures have their own sentences.
- **Convex writes** are not available to the browser: every mutation checks `CASE_WRITE_SECRET`; the dashboard only reads.
- Theme: `localStorage` key `theme` (`light` / `dark`), set before first paint by an inline script in `app/layout.tsx`.
- Keep it one route with a few tabs; the demo is a single continuous screen. Desktop-first (max width 1560px).

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **Hold** | Pausing a pending purchase. Max 1 business day, then it goes to an analyst. |
| **Triage** | The AI (Claude Opus 5.5) deciding hold vs allow, citing risk signals, guided by `policy.md`. |
| **Code floor** | Hard-coded rule under triage: a first-ever gift card / wire / crypto purchase is always held, whatever the AI says. Also: any high-risk purchase within 24h of a Scam Shield flag. |
| **Permission gate** | Code that checks every action against the matrix and refuses what isn't allowed. |
| **Verification** | 2 correct answers (3 if CRS shows a fraud alert) to multiple-choice questions from her credit file. The bot only sees questions; answers never leave the server. |
| **Family bridge** | Live conference call between Dolores and Susan; the AI leaves. Only for a verified member who asked for it. |
| **Scam Shield** | Opt-in protected phone line that detects scam scripts live and whispers a warning to her only. |
| **Morning review** | At 7am an AI (Factory Droid) reviews the night's cases and proposes a policy diff; a human approves. It can only edit `policy.md`, never the hard rules. |
| **Red-team arena** | Automated test where Claude plays scammers / members against the bot; deterministic pass/fail grading. |
| **CRS** | StitchCredit sandbox: identity, fraud and credit-file data. |
| **Nessie** | Capital One's sandbox bank API, standing in for the credit union's core banking system. |
| **Bayview Community CU** | The fictional credit union. |

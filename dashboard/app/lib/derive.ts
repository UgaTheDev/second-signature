// Pure derivations for the Night Ledger UI. No React. Everything here is read from backend data
// (Case / CaseDetail / Stats); where the backend has no field, it is derived from actions + transcript.
import { money } from "./format";
import type { Action, Case, CaseDetail, Line, Signal, Stats, Status } from "./types";

export type Tone = "amber" | "green" | "red" | "family" | "brand" | "muted" | "ink";

/** CSS colour for a tone, e.g. toneVar("red") === "var(--red)". */
export const toneVar = (t: Tone) => `var(--${t})`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
export const isShield = (c: Pick<Case, "category">) => c.category === "scam_call";

// ---- status -------------------------------------------------------------------------------------

export type StatusMeta = { label: string; tone: Tone; pulse: boolean; solid: boolean };
const STATUS_META: Record<Status | "pending", StatusMeta> = {
  pending: { label: "TRIAGE…", tone: "muted", pulse: false, solid: false },
  allowed: { label: "ALLOWED", tone: "muted", pulse: false, solid: false },
  open: { label: "HELD", tone: "amber", pulse: true, solid: false },
  released: { label: "RELEASED", tone: "green", pulse: false, solid: false },
  escalated: { label: "ESCALATED", tone: "red", pulse: false, solid: false },
  confirmed_fraud: { label: "FRAUD", tone: "red", pulse: false, solid: true },
};
export const statusMeta = (s: Status | "pending"): StatusMeta => STATUS_META[s] ?? STATUS_META.pending;

// ---- the call, derived from actions + transcript (the backend has no call object) ----------------

export type CallState = "none" | "ringing" | "live" | "bridged" | "ended";
export type QState = "pending" | "asking" | "ok" | "fail";
export type DerivedCall = {
  state: CallState;
  startedAt: number | null; // dial time while ringing; answer time once live
  qs: { s: QState }[]; // identity questions needed (usually 2)
  speaking: "member" | "agent" | null;
  agentLeft: boolean;
};

const LIVE_SILENCE_MS = 2 * 60_000; // ponytail: no "ended" event after a hang-up without end_call; silence ends it
const BRIDGE_SILENCE_MS = 20 * 60_000; // bridged calls are private, so no lines arrive at all
const SPEAKING_MS = 8_000; // lines land when a turn stops, so "speaking" = spoke in the last few seconds

export function deriveCall(detail: CaseDetail | null | undefined, now = Date.now()): DerivedCall {
  const none: DerivedCall = { state: "none", startedAt: null, qs: [], speaking: null, agentLeft: false };
  if (!detail) return none;
  const acts = [...detail.actions].sort((a, b) => a.t - b.t);
  const lines = [...detail.transcript].sort((a, b) => a.t - b.t);

  let state: CallState = "none";
  let startedAt: number | null = null;
  let agentLeft = false;
  let last = 0; // time of the latest call activity
  const events: ({ k: "a"; a: Action } | { k: "l"; l: Line })[] = [
    ...acts.map((a) => ({ k: "a" as const, a })),
    ...lines.map((l) => ({ k: "l" as const, l })),
  ].sort((x, y) => (x.k === "a" ? x.a.t : x.l.t) - (y.k === "a" ? y.a.t : y.l.t));

  for (const e of events) {
    if (e.k === "l") {
      if (state === "ringing" || state === "none" || state === "ended") {
        state = "live";
        startedAt = e.l.t;
        agentLeft = false;
      }
      last = e.l.t;
      continue;
    }
    const { type, detail: d, t } = e.a;
    if (type === "call_member") {
      state = "ringing";
      startedAt = t;
      agentLeft = false;
    } else if (type === "call" && /^(member|inbound callback) answered|^back on the line/i.test(d)) {
      state = "live";
      startedAt = t;
      agentLeft = false;
    } else if (type === "call" && /ended|not answered|^unanswered/i.test(d)) {
      state = "ended";
    } else if (type === "family_bridge" && /didn.t answer|returning/i.test(d)) {
      state = "live";
      agentLeft = false;
    } else if (type === "family_bridge") {
      state = "bridged";
      agentLeft = true;
    } else continue;
    last = t;
  }

  if ((state === "live" && now - last > LIVE_SILENCE_MS) || (state === "bridged" && now - last > BRIDGE_SILENCE_MS)) state = "ended";

  // Identity questions: "(2 of 3 needed)" / "stepping up to 3 of 3"; per-question results are kept server-side.
  const v = acts.find((a) => a.type === "verify" && a.by === "agent");
  const needed = Number(v?.detail.match(/(\d) of \d/)?.[1] ?? (v ? 2 : 0));
  const verified = Boolean(detail.state?.verified) || acts.some((a) => a.type === "verify" && a.by === "member" && /verified from/i.test(a.detail));
  const failed = !verified && acts.some((a) => a.type === "verify" && a.by === "member" && /failed/i.test(a.detail));
  const live = (state as CallState) === "live";
  const qs = Array.from({ length: needed }, (_, i): { s: QState } => ({
    s: verified ? "ok" : failed ? "fail" : live && i === 0 ? "asking" : "pending",
  }));

  const lastLine = lines[lines.length - 1];
  const speaking =
    live && lastLine && now - lastLine.t < SPEAKING_MS && (lastLine.speaker === "agent" || lastLine.speaker === "member")
      ? (lastLine.speaker as "agent" | "member")
      : null;

  return { state, startedAt, qs, speaking, agentLeft };
}

/** The trusted contact's first name, read from family action details ("Susan answered; …", "Calling Susan: …"). */
export function familyName(actions: Action[]): string | null {
  for (const a of [...actions].sort((x, y) => y.t - x.t)) {
    const m =
      a.detail.match(/^(\w+) answered/) ??
      a.detail.match(/^Calling (\w+):/) ??
      (["connect_family", "call_family"].includes(a.type) ? a.detail.match(/\b(?:daughter|son|sister|brother|niece|nephew) ([A-Z]\w+)/) : null);
    if (m && a.type !== "call" && a.type !== "call_member") return m[1];
  }
  return null;
}

// ---- risk -------------------------------------------------------------------------------------------

/** 0–100: 1 − Π(1 − weight), weights clamped to [0, 1]. */
export const riskScore = (signals: Signal[]) =>
  Math.round(100 * (1 - signals.reduce((p, s) => p * (1 - Math.max(0, Math.min(1, s.weight))), 1)));
export const riskTone = (score: number): Tone => (score >= 80 ? "red" : score >= 50 ? "amber" : "green");
/** Evidence bar colour for one signal weight (0–1). */
export const weightTone = (w: number): Tone => (w >= 0.8 ? "red" : w >= 0.4 ? "amber" : "muted");

export const SOURCE_LABEL: Record<string, string> = {
  shield: "SCAM SHIELD", crs: "CRS", elastic: "HISTORY", apify: "FTC ALERT", nessie: "NESSIE",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s.toUpperCase();

// ---- actions ---------------------------------------------------------------------------------

const FAMILY_TYPES = ["family_call", "family_bridge", "connect_family", "call_family"];
export function actionTone(type: string, by: string): Tone {
  if (by === "gate" || ["deny", "override", "confirm_fraud", "escalate", "shield", "error"].includes(type)) return "red";
  if (FAMILY_TYPES.includes(type)) return "family";
  if (type === "release") return "green";
  if (type === "hold") return "amber";
  return "brand";
}
/** Mono label for an action: "PERMISSION GATE", "CODE FLOOR", else the type in caps ("CALL MEMBER"). */
export const actionLabel = (type: string) =>
  type === "deny" ? "PERMISSION GATE" : type === "override" ? "CODE FLOOR" : type.replace(/_/g, " ").toUpperCase();

// ---- heard on the call ----------------------------------------------------------------------------------

const HEARD: [RegExp, string][] = [
  [/not to tell|don.t tell|secret/i, "Secrecy"],
  [/the man|he said|he.s waiting/i, "Coached by a third party"],
  [/microsoft|virus|computer/i, "“Microsoft” tech support"],
  [/gift ?card|the cards/i, "Gift cards as payment"],
  [/let it go through|just let|release it/i, "Pressure to release"],
];
/** Flags heard in the member's own words, plus the NEXT line for cinema mode. */
export function heardFlags(transcript: Line[], actions: Action[] = [], call?: DerivedCall | null): { flags: string[]; next: string; nextTone: Tone } {
  const said = transcript.filter((l) => l.speaker === "member").map((l) => l.text).join(" ");
  const flags = HEARD.filter(([re]) => re.test(said)).map(([, t]) => t);
  const denied = actions.some((a) => a.type === "deny");
  const verified = call ? call.qs.length > 0 && call.qs.every((q) => q.s === "ok") : false;
  const fam = (familyName(actions) ?? "family").toUpperCase();
  const k = call?.state;
  const [next, nextTone]: [string, Tone] =
    k === "bridged" ? ["THE AGENT LEFT THE LINE", "family"]
    : k === "ended" ? ["CALL ENDED", "muted"]
    : denied && flags.length >= 2 ? [`NEXT → OFFER ${fam}`, "family"]
    : denied ? ["HOLD STAYS · ANALYST DECIDES", "red"]
    : flags.length >= 2 ? ["LISTENING · STAYING CALM", "amber"]
    : verified ? ["ASKING ABOUT THE PURCHASE", "green"]
    : ["VERIFYING IDENTITY", "muted"];
  return { flags, next, nextTone };
}

// ---- where sources disagreed ------------------------------------------------------------------------------

export type Conflict = { said: string; against: string; trusted: string; why: string };
/** Source disagreements read from the case actions (server/agent.py writes both details verbatim). */
export function sourceConflicts(actions: Action[]): Conflict[] {
  const out: Conflict[] = [];
  const floor = actions.find((a) => a.type === "override")?.detail.match(/^Triage said allow, held anyway: (.+)$/)?.[1];
  if (floor) out.push({ said: "Triage (Claude) said allow", against: "Code rule held it", trusted: "the rule", why: floor });
  // ponytail: only member release refusals count; agent refusals are the gate doing its job, not a disagreement
  const refused = actions.find((a) => a.type === "deny" && /^member tried to release: /.test(a.detail))?.detail.replace(/^member tried to release: /, "");
  if (refused) out.push({ said: "Member asked to release it", against: "Rule refused", trusted: "the rule, an analyst decides", why: refused });
  return out;
}

// ---- holds ---------------------------------------------------------------------------------------------------

/** When the agent's hold authority ends: +1 day, rolled past Sat/Sun (same rule as server agent.hold_expires). */
export function holdExpiry(openedAt: number): number {
  const d = new Date(openedAt + 86_400_000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.getTime();
}
/** "23h 58m 12s" (clamped at 0). */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}

// ---- KPIs ------------------------------------------------------------------------------------------------------

export type Kpi = { label: string; value: string; sub: string; tone: Tone; valueTone: Tone };
export function kpis(stats: Stats | undefined, cases: Case[] | undefined): Kpi[] {
  const list = (cases ?? []).filter((c) => !isShield(c));
  const held = list.filter((c) => c.status === "open" || c.status === "escalated");
  const kept = [...held, ...list.filter((c) => c.status === "confirmed_fraud")].reduce((s, c) => s + c.amount, 0);
  // ponytail: the list has no actions, so calls = held purchases (the server dials on every hold); count call actions if exactness matters
  const calls = list.filter((c) => c.status !== "allowed").length;
  const bridges = list.filter((c) => c.state?.bridged).length;
  const refused = stats ? stats.gateDenials + stats.heldByRule : null;
  const loading = !cases;
  return [
    { label: "OPEN HOLDS", value: loading ? "—" : String(held.length), sub: held.length ? `${held.map((c) => money(c.amount)).join(" · ")} paused` : "Nothing waiting on you", tone: "amber", valueTone: held.length ? "amber" : "ink" },
    { label: "KEPT FROM SCAMMERS", value: loading ? "—" : money(kept), sub: "Held or confirmed fraud", tone: "brand", valueTone: "ink" },
    { label: "MEMBER CALLS", value: loading ? "—" : String(calls), sub: bridges ? `${bridges} family bridge${bridges > 1 ? "s" : ""} · agent left` : "Warm checks, not alarms", tone: "family", valueTone: "ink" },
    { label: "REFUSED BY CODE", value: refused === null ? "—" : String(refused), sub: "Gate denials + code-floor holds", tone: "red", valueTone: refused ? "red" : "ink" },
  ];
}

// ---- Scam Shield ------------------------------------------------------------------------------------------------

export const SHIELD_THRESHOLD = 75; // server/shield.py THRESHOLD = 0.75
export const SHIELD_WINDOW_HOURS = 24; // server/shield.py WINDOW_HOURS
/** The server's fixed whisper (server/shield.py WHISPER), verbatim. */
export const whisperText = (first: string) =>
  `${first}, it's your credit union. You don't need to answer me. This sounds like a scam. It's okay to hang up. It's okay to hang up.`;

export type ShieldInfo = { confidence: number | null; quote: string | null; scamType: string | null; armedUntil: number };
export function shieldInfo(c: Case): ShieldInfo {
  const sig = c.risk_signals.find((s) => s.source === "shield");
  const pct = c.decision_rationale.match(/confidence (\d+)%/)?.[1];
  return {
    confidence: pct ? Number(pct) : sig ? Math.round(sig.weight * 100) : null,
    quote: sig?.fact.match(/"([\s\S]+)"/)?.[1] ?? null,
    scamType: c.decision_rationale.match(/Scam Shield: (.+?) script detected/)?.[1] ?? null,
    armedUntil: c.opened_at + SHIELD_WINDOW_HOURS * 3_600_000,
  };
}

// ---- permission matrix + honesty (content moved from components/Evidence.tsx) -----------------------------------

export type MatrixCell = { kind: "yes" | "if" | "never" | "none"; note: string };
export type MatrixRow = { action: string; agent: MatrixCell; member: MatrixCell; analyst: MatrixCell; money: boolean };
const Y = (note = ""): MatrixCell => ({ kind: "yes", note });
const IF = (note: string): MatrixCell => ({ kind: "if", note });
const NEVER: MatrixCell = { kind: "never", note: "never" };
const NONE: MatrixCell = { kind: "none", note: "" };
const row = (action: string, agent: MatrixCell, member: MatrixCell, analyst: MatrixCell, money = false): MatrixRow => ({ action, agent, member, analyst, money });
/** Columns: AGENT ALONE | NEEDS HER YES | NEEDS AN ANALYST. Enforced in server/gate.py. */
export const MATRIX: MatrixRow[] = [
  row("Read transactions and identity signals", Y(), NONE, NONE),
  row("Place a hold on a pending purchase", Y("for at most 1 business day"), NONE, NONE),
  row("Call the member, after verifying who she is", Y(), NONE, NONE),
  row("Listen to calls on her protected line", Y("she opted in; callers are told; kept in memory only"), NONE, NONE),
  row("Whisper a scam warning only she can hear", Y(), NONE, NONE),
  row("Call her trusted family contact", IF("only on red flags or 2 unanswered calls"), NONE, NONE),
  row("Connect her live to that contact (the agent then leaves the call)", NONE, IF("once verified, and only if she asks"), NONE),
  row("Release a hold under $1,000 (not a first-ever gift card, wire or crypto)", NONE, IF("after verification"), NONE),
  row("Release any other hold", NONE, NONE, Y()),
  row("Draft an estate's journal entries and Treasury response", Y(), NONE, NONE),
  row("Post the journal, or sign a credit-union loss over $250", NEVER, NEVER, Y("the controller")),
  row("Move, refund or send money", NEVER, NEVER, Y("only outside this system"), true),
  row("Close or freeze the account", NEVER, NONE, Y("only outside this system"), true),
];
export const REAL = [
  "Phone calls (Twilio), voice and speech recognition (Cartesia), reasoning (Claude)",
  "CRS credit-bureau sandbox calls on test identities",
  "Holds and the permission gate, enforced in our code",
];
export const SIMULATED = [
  "The credit union, and Dolores (a CRS test identity)",
  "The bank: Nessie is Capital One's sandbox, not a real core system",
  "The scammer (a teammate)",
  "Holds don't reach a card network",
];

// ---- scenarios (POST /scenario body) ------------------------------------------------------------------------------

export type ScenarioBody = { member_id: string; merchant: string; category: string; amount: number; note: string };
export type Preset = { title: string; sub: string; expect: string; expectStatus: Status; body: ScenarioBody };
export const PRESETS: Preset[] = [
  { title: "$500 gift cards", sub: "Dolores has never bought gift cards: held by rule", expect: "$500 Target gift cards → ESCALATED", expectStatus: "escalated",
    body: { member_id: "dolores", merchant: "Target Gift Cards", category: "gift_card", amount: 500, note: "" } },
  { title: "$300 bike", sub: "Out of pattern but ordinary: the agent calls and she can release it", expect: "$300 Bay Cycles bike → RELEASED", expectStatus: "released",
    body: { member_id: "dolores", merchant: "Bay Cycles", category: "sporting_goods", amount: 300, note: "" } },
  { title: "$100 gift card for Robert", sub: "He buys these every year: let through", expect: "$100 gift card (Robert) → ALLOWED", expectStatus: "allowed",
    body: { member_id: "robert", merchant: "Target Gift Cards", category: "gift_card", amount: 100, note: "" } },
];
/** Server members (server/members.py) and its accepted category strings. */
export const SCENARIO_MEMBERS = [{ id: "dolores", name: "Dolores Whitcomb" }, { id: "robert", name: "Robert Chen" }];
export const CATEGORIES = ["gift_card", "electronics", "wire_transfer", "crypto", "groceries", "pharmacy", "sporting_goods", "restaurant", "other"];

// ---- self-check ------------------------------------------------------------------------------------------------------

export function __selfcheck() {
  const ok = (c: unknown, m: string) => { if (!c) throw new Error(`derive selfcheck: ${m}`); };
  ok(riskScore([]) === 0, "empty risk is 0");
  ok(riskScore([{ source: "x", fact: "", weight: 0.5 }, { source: "y", fact: "", weight: 0.5 }]) === 75, "1-(.5*.5) = 75");
  ok(riskScore([{ source: "x", fact: "", weight: 1.4 }]) === 100, "weights clamp");
  ok(riskTone(80) === "red" && riskTone(50) === "amber" && riskTone(49) === "green", "risk tones");
  const c: Case = { _id: "1", member_name: "Ada Lovelace", merchant: "M", category: "gift_card", amount: 250, opened_at: 0, status: "escalated", risk_signals: [], plan: "", decision_rationale: "" };
  const d: CaseDetail = { ...c, actions: [{ _id: "a", t: 1000, type: "call_member", by: "agent", detail: "Calling Ada" }], transcript: [] };
  ok(deriveCall(d, 2000).state === "ringing", "ringing after dial");
  ok(deriveCall({ ...d, transcript: [{ _id: "l", t: 3000, speaker: "member", text: "hi" }] }, 4000).state === "live", "line => live");
  ok(shieldInfo({ ...c, decision_rationale: "Scam Shield: tech support script detected live (confidence 93%)." }).confidence === 93, "confidence parse");
  const A = (type: string, by: string, detail: string): Action => ({ _id: type, t: 0, type, by, detail });
  ok(sourceConflicts([A("triage", "agent", "HOLD: x"), A("deny", "gate", "agent tried to release: the agent cannot release a hold on its own")]).length === 0, "no conflict on agreement");
  const cf = sourceConflicts([A("triage", "agent", "ALLOW: ok"), A("override", "gate", "Triage said allow, held anyway: first gift_card purchase in her history; held by rule regardless of triage"),
    A("deny", "gate", "member tried to release: first-ever gift_card purchase; an analyst must release it")]);
  ok(cf.length === 2 && cf[0].why.startsWith("first gift_card") && cf[1].why === "first-ever gift_card purchase; an analyst must release it", "override + member refusal");
  ok(holdExpiry(new Date(2026, 9, 23, 22).getTime()) === new Date(2026, 9, 26, 22).getTime(), "Fri night hold rolls to Monday");
  return true;
}

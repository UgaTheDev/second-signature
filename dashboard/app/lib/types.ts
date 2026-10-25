export type Status = "allowed" | "open" | "released" | "escalated" | "confirmed_fraud";
export type Signal = { source: string; fact: string; weight: number };
export type CaseState = {
  verified: boolean;
  red_flags: boolean;
  unanswered_calls: number;
  family_notified: boolean;
  held_by_rule: boolean;
  bridged: boolean;
};
export type Case = {
  _id: string;
  member_name: string;
  merchant: string;
  category: string;
  amount: number;
  opened_at: number;
  status: Status;
  risk_signals: Signal[];
  plan: string;
  decision_rationale: string;
  state?: CaseState;
};
export type Action = { _id: string; t: number; type: string; by: string; detail: string };
export type Line = { _id: string; t: number; speaker: string; text: string };
export type CaseDetail = Case & { actions: Action[]; transcript: Line[] };

export type Stats = {
  total: number;
  allowed: number;
  held: number;
  open: number;
  released: number;
  memberReleases: number;
  escalated: number;
  confirmedFraud: number;
  heldByRule: number;
  gateDenials: number;
  medianMinutesToResolve: number | null;
};

export type ArenaRow = { scenario: string; kind: string; passed: number; runs: number; critical: number; misses: string };
export type ArenaRun = { t: number; summary: string; rows: ArenaRow[] };
export type Arena = { calls: ArenaRun | null; shield: ArenaRun | null };

export type Review = {
  started_at: number;
  trigger: string;
  status: "running" | "proposed" | "approved" | "rejected" | "failed";
  steps: string[];
  summary: string;
  diff: string;
};

// Estate desk: mirrors server/estate.py compute().
export type EstateSource = { id: string; kind: string; says: string; trusted: boolean; why: string };
export type JournalLine = { account: string; dr: number; cr: number; memo: string; source: string };
export type Estate = {
  key: string;
  name: string;
  decision: "return_and_protest" | "return_in_full" | "recipient_alive";
  date_of_death: string | null;
  dod_source: string | null;
  knowledge_date: string | null;
  knowledge_source: string | null;
  claimed: number;
  not_due: { id: string; amount: number; why: string }[];
  already_returned: { id: string; amount: number; why?: string }[];
  valid_claim: number;
  on_hand: number;
  return_now: number;
  shortfall: number;
  cu_liability: number;
  liability_basis: "knowledge" | "limited_45_day" | "none";
  liability_without_note?: number;
  withdrawers: string[];
  sources: EstateSource[];
  findings: { text: string; rule: string }[];
  journal: JournalLine[];
  needs_controller: boolean;
  timeline: { date: string; label: string; kind: string }[];
  score?: { correct: number; total: number };
};
export type EstateRow = { _id: string; key: string; data: Estate; status: "drafted" | "signed"; signed_by?: string; signed_at?: number; updated_at: number };
export type PostedLine = JournalLine & { _id: string; t: number; by: string };

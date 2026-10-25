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

export type JournalLine = { account: string; name: string; debit: number; credit: number };
export type JournalEntry = {
  _id: string;
  key: string;
  caseId: string;
  txn_id: string;
  event: string;
  by: string;
  date: string;
  t: number;
  memo: string;
  lines: JournalLine[];
  ext_system?: string;
  ext_id?: string;
  ext_error?: string;
};
export type Books = { entries: JournalEntry[]; cases: Pick<Case, "_id" | "member_name" | "merchant" | "amount" | "status" | "opened_at">[] };

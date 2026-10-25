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
  member_id?: string;
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

export type ReviewCustomer = {
  member_id: string;
  member_name: string;
  summary: string;
  status?: "running" | "proposed" | "approved" | "rejected" | "no_change" | "failed";
};

export type Review = {
  _id?: string;
  started_at: number;
  trigger: string;
  status: "running" | "proposed" | "approved" | "rejected" | "failed" | "completed";
  steps: string[];
  summary: string;
  customers?: ReviewCustomer[];
  diff: string;
};

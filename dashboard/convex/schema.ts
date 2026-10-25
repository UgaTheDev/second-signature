import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const status = v.union(
  v.literal("allowed"), // triage let it through, no hold
  v.literal("open"), // held, waiting on the member / analyst
  v.literal("released"),
  v.literal("escalated"),
  v.literal("confirmed_fraud"),
);

// Everything the gate reads besides status. Written by the server after every action.
export const caseState = v.object({
  verified: v.boolean(),
  red_flags: v.boolean(),
  unanswered_calls: v.number(),
  family_notified: v.boolean(),
  held_by_rule: v.boolean(),
  bridged: v.boolean(),
});

export const journalLine = v.object({ account: v.string(), name: v.string(), debit: v.number(), credit: v.number() });

export default defineSchema({
  cases: defineTable({
    member_id: v.string(),
    member_name: v.string(),
    txn_id: v.string(),
    merchant: v.string(),
    category: v.string(),
    amount: v.number(),
    opened_at: v.number(), // epoch ms
    status,
    risk_signals: v.array(v.object({ source: v.string(), fact: v.string(), weight: v.number() })),
    plan: v.string(),
    decision_rationale: v.string(),
    state: v.optional(caseState), // gate flags, so a restarted server picks the case back up
  })
    .index("by_txn", ["txn_id"])
    .index("by_status", ["status"]),

  // append-only logs, split out so appends don't rewrite the case doc
  actions: defineTable({
    caseId: v.id("cases"),
    t: v.number(),
    type: v.string(), // hold | call | family_call | release | escalate | verify | deny ...
    by: v.string(), // agent | member | human | gate
    detail: v.string(),
  }).index("by_case_t", ["caseId", "t"]),

  // Morning review: a Factory Droid proposes a policy diff; a human approves it
  reviews: defineTable({
    started_at: v.number(),
    trigger: v.string(), // schedule | analyst | overrides
    status: v.union(v.literal("running"), v.literal("proposed"), v.literal("approved"), v.literal("rejected"), v.literal("failed")),
    steps: v.array(v.string()), // Droid's visible steps (bounded)
    summary: v.string(),
    diff: v.string(), // unified diff of policy.md; empty if no change proposed
  }),

  // Red-team arena runs (arena.py --publish): the scoreboard judges see on the dashboard
  arena: defineTable({
    t: v.number(),
    kind: v.string(), // calls | shield
    summary: v.string(),
    rows: v.array(v.object({ scenario: v.string(), kind: v.string(), passed: v.number(), runs: v.number(), critical: v.number(), misses: v.string() })),
  }),

  // The books: one balanced double-entry journal entry per money event (server/books.py)
  journal: defineTable({
    key: v.string(), // caseId:event, so an event is never booked twice
    caseId: v.string(),
    txn_id: v.string(),
    event: v.string(), // allowed | hold | release | confirm_fraud
    by: v.string(),
    date: v.string(), // YYYY-MM-DD, the accounting date
    t: v.number(),
    memo: v.string(),
    lines: v.array(journalLine),
    ext_system: v.optional(v.string()), // quickbooks
    ext_id: v.optional(v.string()), // its JournalEntry Id there
    ext_error: v.optional(v.string()), // why the last post failed; cleared on success
  })
    .index("by_key", ["key"])
    .index("by_t", ["t"]),

  transcript: defineTable({
    caseId: v.id("cases"),
    t: v.number(),
    speaker: v.string(), // agent | member
    text: v.string(),
  }).index("by_case_t", ["caseId", "t"]),
});

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

export const reviewCustomer = v.object({ member_id: v.string(), member_name: v.string(), summary: v.string(), status: v.optional(v.union(v.literal("running"), v.literal("proposed"), v.literal("approved"), v.literal("rejected"), v.literal("no_change"), v.literal("failed"))) });

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
    status: v.union(v.literal("running"), v.literal("proposed"), v.literal("approved"), v.literal("rejected"), v.literal("failed"), v.literal("completed")),
    steps: v.array(v.string()), // Droid's visible steps (bounded)
    summary: v.string(),
    customers: v.optional(v.array(reviewCustomer)),
    diff: v.string(), // unified diff of policy.md; empty if no change proposed
  }),

  // Red-team arena runs (arena.py --publish): the scoreboard judges see on the dashboard
  arena: defineTable({
    t: v.number(),
    kind: v.string(), // calls | shield
    summary: v.string(),
    rows: v.array(v.object({ scenario: v.string(), kind: v.string(), passed: v.number(), runs: v.number(), critical: v.number(), misses: v.string() })),
  }),

  transcript: defineTable({
    caseId: v.id("cases"),
    t: v.number(),
    speaker: v.string(), // agent | member
    text: v.string(),
  }).index("by_case_t", ["caseId", "t"]),
});

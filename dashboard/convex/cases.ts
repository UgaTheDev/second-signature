import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { caseState, status } from "./schema";

// Writes come only from the Python server. The deployment URL ships in the browser
// bundle, so every mutation checks a shared secret set with
// `npx convex env set CASE_WRITE_SECRET <value>`.
export function auth(secret: string) {
  if (!process.env.CASE_WRITE_SECRET || secret !== process.env.CASE_WRITE_SECRET) {
    throw new Error("forbidden");
  }
}

const signal = v.object({ source: v.string(), fact: v.string(), weight: v.number() });

export const open = mutation({
  args: {
    secret: v.string(),
    member_id: v.string(),
    member_name: v.string(),
    txn_id: v.string(),
    merchant: v.string(),
    category: v.string(),
    amount: v.number(),
    status,
    risk_signals: v.array(signal),
    plan: v.string(),
    decision_rationale: v.string(),
  },
  handler: async (ctx, { secret, ...c }) => {
    auth(secret);
    // idempotent on txn_id: a double poll never opens two cases
    const existing = await ctx.db
      .query("cases")
      .withIndex("by_txn", (q) => q.eq("txn_id", c.txn_id))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("cases", { ...c, opened_at: Date.now() });
  },
});

export const setStatus = mutation({
  args: { secret: v.string(), caseId: v.id("cases"), status },
  handler: async (ctx, { secret, caseId, status }) => {
    auth(secret);
    await ctx.db.patch(caseId, { status });
  },
});

export const saveState = mutation({
  args: { secret: v.string(), caseId: v.id("cases"), state: caseState },
  handler: async (ctx, { secret, caseId, state }) => {
    auth(secret);
    await ctx.db.patch(caseId, { state });
  },
});

// Cases the server must pick back up after a restart: still held, or waiting on an analyst.
export const active = query({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db.query("cases").withIndex("by_status", (q) => q.eq("status", "open")).take(200);
    const escalated = await ctx.db.query("cases").withIndex("by_status", (q) => q.eq("status", "escalated")).take(200);
    return [...open, ...escalated];
  },
});

export const addAction = mutation({
  args: { secret: v.string(), caseId: v.id("cases"), type: v.string(), by: v.string(), detail: v.string() },
  handler: async (ctx, { secret, ...a }) => {
    auth(secret);
    await ctx.db.insert("actions", { ...a, t: Date.now() });
  },
});

export const addLine = mutation({
  args: { secret: v.string(), caseId: v.id("cases"), speaker: v.string(), text: v.string() },
  handler: async (ctx, { secret, ...l }) => {
    auth(secret);
    await ctx.db.insert("transcript", { ...l, t: Date.now() });
  },
});

export const reviewOpen = mutation({
  args: { secret: v.string(), trigger: v.string() },
  handler: async (ctx, { secret, trigger }) => {
    auth(secret);
    return await ctx.db.insert("reviews", { started_at: Date.now(), trigger, status: "running", steps: [], summary: "", diff: "" });
  },
});

export const reviewStep = mutation({
  args: { secret: v.string(), reviewId: v.id("reviews"), text: v.string() },
  handler: async (ctx, { secret, reviewId, text }) => {
    auth(secret);
    const r = await ctx.db.get(reviewId);
    if (r && r.steps.length < 200) await ctx.db.patch(reviewId, { steps: [...r.steps, text.slice(0, 500)] });
  },
});

export const reviewSet = mutation({
  args: {
    secret: v.string(),
    reviewId: v.id("reviews"),
    status: v.union(v.literal("running"), v.literal("proposed"), v.literal("approved"), v.literal("rejected"), v.literal("failed")),
    summary: v.optional(v.string()),
    diff: v.optional(v.string()),
  },
  handler: async (ctx, { secret, reviewId, ...patch }) => {
    auth(secret);
    await ctx.db.patch(reviewId, Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined)));
  },
});

export const latestReview = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("reviews").order("desc").take(1))[0] ?? null,
});

export const arenaRecord = mutation({
  args: {
    secret: v.string(),
    kind: v.string(),
    summary: v.string(),
    rows: v.array(v.object({ scenario: v.string(), kind: v.string(), passed: v.number(), runs: v.number(), critical: v.number(), misses: v.string() })),
  },
  handler: async (ctx, { secret, ...run }) => {
    auth(secret);
    await ctx.db.insert("arena", { ...run, t: Date.now() });
  },
});

export const latestArena = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("arena").order("desc").take(20);
    return { calls: runs.find((r) => r.kind === "calls") ?? null, shield: runs.find((r) => r.kind === "shield") ?? null };
  },
});

// The night in numbers, from the case file itself: what was held, how it ended, how fast.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query("cases").order("desc").take(500);
    const count = (s: string) => cases.filter((c) => c.status === s).length;
    const resolvedMinutes: number[] = [];
    let gateDenials = 0;
    let memberReleases = 0;
    for (const c of cases) {
      const actions = await ctx.db.query("actions").withIndex("by_case_t", (q) => q.eq("caseId", c._id)).take(500);
      gateDenials += actions.filter((a) => a.type === "deny").length;
      const hold = actions.find((a) => a.type === "hold");
      const end = actions.find((a) => ["release", "confirm_fraud"].includes(a.type));
      if (end?.type === "release" && end.by === "member") memberReleases++;
      if (hold && end) resolvedMinutes.push((end.t - hold.t) / 60000);
    }
    resolvedMinutes.sort((a, b) => a - b);
    return {
      total: cases.length,
      allowed: count("allowed"),
      held: cases.length - count("allowed"),
      open: count("open"),
      released: count("released"),
      memberReleases,
      escalated: count("escalated"),
      confirmedFraud: count("confirmed_fraud"),
      heldByRule: cases.filter((c) => c.state?.held_by_rule).length,
      gateDenials,
      medianMinutesToResolve: resolvedMinutes.length ? resolvedMinutes[Math.floor(resolvedMinutes.length / 2)] : null,
    };
  },
});

// Demo reset: wipes everything.
export const reset = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    auth(secret);
    for (const table of ["actions", "transcript", "cases", "reviews", "journal"] as const) {
      for (const doc of await ctx.db.query(table).take(4000)) await ctx.db.delete(doc._id);
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("cases").order("desc").take(50),
});

export const get = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const c = await ctx.db.get(caseId);
    if (!c) return null;
    const actions = await ctx.db
      .query("actions")
      .withIndex("by_case_t", (q) => q.eq("caseId", caseId))
      .take(500);
    const transcript = await ctx.db
      .query("transcript")
      .withIndex("by_case_t", (q) => q.eq("caseId", caseId))
      .take(1000);
    return { ...c, actions, transcript };
  },
});

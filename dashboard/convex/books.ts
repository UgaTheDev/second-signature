import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./cases";
import { journalLine } from "./schema";

// The books: balanced journal entries written by server/books.py, one per money event.

export const post = mutation({
  args: {
    secret: v.string(),
    key: v.string(),
    caseId: v.string(),
    txn_id: v.string(),
    event: v.string(),
    by: v.string(),
    date: v.string(),
    memo: v.string(),
    lines: v.array(journalLine),
  },
  handler: async (ctx, { secret, ...e }) => {
    auth(secret);
    const debits = e.lines.reduce((s, l) => s + l.debit, 0);
    const credits = e.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(debits - credits) > 0.005) throw new Error(`unbalanced entry ${e.key}`);
    // idempotent on key: a restart or a retried call never books an event twice
    const existing = await ctx.db.query("journal").withIndex("by_key", (q) => q.eq("key", e.key)).unique();
    if (existing) return existing._id;
    return await ctx.db.insert("journal", { ...e, t: Date.now() });
  },
});

export const posted = mutation({
  args: { secret: v.string(), key: v.string(), system: v.string(), ext_id: v.string(), error: v.string() },
  handler: async (ctx, { secret, key, system, ext_id, error }) => {
    auth(secret);
    const row = await ctx.db.query("journal").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row) return;
    await ctx.db.patch(row._id, ext_id ? { ext_system: system, ext_id, ext_error: undefined } : { ext_system: system, ext_error: error });
  },
});

// Entries no outside ledger has yet, oldest first, for the server's sync.
export const unposted = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("journal").withIndex("by_t").take(2000);
    return rows
      .filter((r) => !r.ext_id)
      .slice(0, 200)
      .map(({ key, caseId, txn_id, event, by, date, memo, lines }) => ({ key, caseId, txn_id, event, by, date, memo, lines }));
  },
});

// Everything the Books view needs to show and reconcile the ledger.
export const journal = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("journal").withIndex("by_t").order("desc").take(1000);
    const cases = (await ctx.db.query("cases").order("desc").take(500)).map(({ _id, member_name, merchant, amount, status, opened_at }) => ({
      _id, member_name, merchant, amount, status, opened_at,
    }));
    return { entries, cases };
  },
});

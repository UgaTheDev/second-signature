import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./cases";

type Line = { account: string; dr: number; cr: number; memo: string; source: string };

// Server writes compute() output here after every run. A signed estate keeps its signature.
export const upsert = mutation({
  args: { secret: v.string(), key: v.string(), data: v.any() },
  handler: async (ctx, { secret, key, data }) => {
    auth(secret);
    const row = await ctx.db.query("estates").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row) return await ctx.db.insert("estates", { key, data, status: "drafted", updated_at: Date.now() });
    if (row.status === "signed") return row._id;
    await ctx.db.patch(row._id, { data, updated_at: Date.now() });
    return row._id;
  },
});

// Controller signature: posts the drafted journal into the append-only ledger, once.
export const sign = mutation({
  args: { secret: v.string(), key: v.string(), by: v.string() },
  handler: async (ctx, { secret, key, by }) => {
    auth(secret);
    const row = await ctx.db.query("estates").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!row) throw new Error(`no estate ${key}`);
    if (row.status === "signed") return row._id;
    const t = Date.now();
    for (const l of (row.data?.journal ?? []) as Line[]) {
      await ctx.db.insert("journal", { estate_key: key, t, account: l.account, dr: l.dr, cr: l.cr, memo: l.memo, source: l.source, by });
    }
    await ctx.db.patch(row._id, { status: "signed", signed_by: by, signed_at: t, updated_at: t });
    return row._id;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("estates").take(50),
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const estate = await ctx.db.query("estates").withIndex("by_key", (q) => q.eq("key", key)).unique();
    const journal = await ctx.db.query("journal").withIndex("by_estate_t", (q) => q.eq("estate_key", key)).take(200);
    return { estate, journal };
  },
});

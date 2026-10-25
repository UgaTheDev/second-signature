import type { Case } from "./types";

export function isActiveCase(c: Case): boolean {
  return c.status === "open" || c.status === "escalated";
}

export function customerKey(c: Case): string {
  return c.member_id ? `id:${c.member_id}` : `name:${c.member_name}`;
}

export function groupByCustomer(cases: Case[]) {
  const groups = new Map<string, { key: string; name: string; cases: Case[] }>();
  for (const c of [...cases].sort((a, b) => b.opened_at - a.opened_at)) {
    const key = customerKey(c);
    const group = groups.get(key) ?? { key, name: c.member_name, cases: [] };
    group.cases.push(c);
    groups.set(key, group);
  }
  return [...groups.values()];
}

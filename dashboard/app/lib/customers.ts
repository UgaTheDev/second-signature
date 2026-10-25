import type { Case } from "./types";
import { MEMBER_PROFILES, type Profile } from "./profiles";
import { isActiveCase } from "./ledger";

export type Customer = { id: string; name: string; profile?: Profile; cases: Case[] };
const REGISTERED = [
  { id: "dolores", name: "Dolores Whitcomb" },
  { id: "robert", name: "Robert Chen" },
];

export function customerDirectory(cases: Case[]): Customer[] {
  const customers = new Map<string, Customer>(REGISTERED.map((c) => [c.id, { ...c, profile: MEMBER_PROFILES[c.name], cases: [] }]));
  for (const c of cases) {
    const registered = REGISTERED.find((p) => p.name === c.member_name);
    const id = c.member_id || registered?.id || `name:${c.member_name}`;
    const customer = customers.get(id) ?? { id, name: c.member_name, cases: [] };
    customer.cases.push(c);
    customers.set(id, customer);
  }
  return [...customers.values()].map((c) => ({ ...c, cases: [...c.cases].sort((a, b) => b.opened_at - a.opened_at) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function matchesCustomer(customer: Customer, query: string): boolean {
  const text = [customer.name, customer.id, ...customer.cases.map((c) => c.merchant)].join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((word) => text.includes(word));
}

export function customerFacts(customer: Customer) {
  const transactions = customer.cases.filter((c) => c.category !== "scam_call");
  const volume = transactions.reduce((sum, c) => sum + c.amount, 0);
  const categories = new Map<string, { category: string; count: number; amount: number }>();
  for (const c of transactions) {
    const row = categories.get(c.category) ?? { category: c.category, count: 0, amount: 0 };
    row.count += 1;
    row.amount += c.amount;
    categories.set(c.category, row);
  }
  // Retain the date of each recorded signal; these are observations, not a fresh credit pull.
  const credit = new Map<string, { fact: string; recordedAt: number }>();
  for (const c of [...customer.cases].sort((a, b) => b.opened_at - a.opened_at)) {
    for (const signal of c.risk_signals.filter((signal) => signal.source.toLowerCase() === "crs")) {
      if (!credit.has(signal.fact)) credit.set(signal.fact, { fact: signal.fact, recordedAt: c.opened_at });
    }
  }
  return {
    transactions, volume, average: transactions.length ? volume / transactions.length : null,
    largest: transactions.length ? Math.max(...transactions.map((c) => c.amount)) : null,
    active: customer.cases.filter(isActiveCase).length,
    categories: [...categories.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    credit: [...credit.values()],
  };
}

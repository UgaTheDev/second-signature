// The books: journal entries from server/books.py, and the checks an accountant runs on them.
// Pure functions, so live data and sample data reconcile the same way.
import type { Case, CaseDetail, JournalEntry, Status } from "./types";

// Same chart as server/books.py.
export const ACCOUNTS: Record<string, { name: string; key: "shares" | "suspense" | "settlement" }> = {
  "2100": { name: "Member share drafts", key: "shares" },
  "2190": { name: "Held card payments (suspense)", key: "suspense" },
  "2200": { name: "Card settlement payable", key: "settlement" },
};
const RULES: Record<string, [string, string, string]> = {
  allowed: ["2100", "2200", "Card purchase posted"],
  hold: ["2100", "2190", "Payment held for review"],
  release: ["2190", "2200", "Hold released; payment settles"],
  confirm_fraud: ["2190", "2100", "Fraud confirmed; payment stopped and funds returned to member"],
};

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** What the server would have booked for a sample case: its money actions, in order. */
export function sampleJournal(details: CaseDetail[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const d of details) {
    if (d.amount <= 0) continue;
    const events = d.status === "allowed" ? [{ type: "allowed", by: "agent", t: d.opened_at }] : d.actions.filter((a) => a.type in RULES);
    for (const a of events) {
      const [dr, cr, what] = RULES[a.type];
      out.push({
        _id: `j-${d._id}-${a.type}`, key: `${d._id}:${a.type}`, caseId: d._id, txn_id: d._id, event: a.type, by: a.by,
        date: day(a.t), t: a.t, memo: `${what}: ${d.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} at ${d.merchant}`,
        lines: [
          { account: dr, name: ACCOUNTS[dr].name, debit: d.amount, credit: 0 },
          { account: cr, name: ACCOUNTS[cr].name, debit: 0, credit: d.amount },
        ],
      });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

const cents = (n: number) => Math.round(n * 100);
const HELD: Status[] = ["open", "escalated"];

export type Check = { label: string; ok: boolean; detail: string };
export type Reconciliation = {
  balances: { account: string; name: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  suspense: number; // credit balance of 2190
  heldNow: number; // sum of held cases
  stopped: number; // confirmed-fraud dollars returned to members before they left
  posted: number; // entries an outside ledger has
  failed: JournalEntry[];
  checks: Check[];
};

type CaseLite = Pick<Case, "_id" | "amount" | "status">;

export function reconcile(entries: JournalEntry[], cases: CaseLite[]): Reconciliation {
  const bal = new Map<string, { debit: number; credit: number }>();
  let unbalanced = 0;
  for (const e of entries) {
    let d = 0, c = 0;
    for (const l of e.lines) {
      const b = bal.get(l.account) ?? { debit: 0, credit: 0 };
      b.debit += cents(l.debit); b.credit += cents(l.credit);
      bal.set(l.account, b);
      d += cents(l.debit); c += cents(l.credit);
    }
    if (d !== c) unbalanced++;
  }
  const balances = [...bal.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([account, b]) => {
    const net = b.credit - b.debit; // all three are liabilities: normal balance is a credit
    return { account, name: ACCOUNTS[account]?.name ?? account, debit: net < 0 ? -net / 100 : 0, credit: net > 0 ? net / 100 : 0 };
  });
  const totalDebit = balances.reduce((s, b) => s + b.debit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.credit, 0);
  const s = bal.get("2190");
  const suspense = s ? (s.credit - s.debit) / 100 : 0;

  const money = cases.filter((c) => c.amount > 0);
  const heldNow = money.filter((c) => HELD.includes(c.status)).reduce((t, c) => t + c.amount, 0);
  const stopped = money.filter((c) => c.status === "confirmed_fraud").reduce((t, c) => t + c.amount, 0);
  const booked = new Set(entries.map((e) => e.key));
  const missing = money.filter((c) => {
    if (c.status === "allowed") return !booked.has(`${c._id}:allowed`);
    if (!booked.has(`${c._id}:hold`)) return true;
    if (c.status === "released") return !booked.has(`${c._id}:release`);
    if (c.status === "confirmed_fraud") return !booked.has(`${c._id}:confirm_fraud`);
    return false;
  });
  const posted = entries.filter((e) => e.ext_id).length;
  const failed = entries.filter((e) => !e.ext_id && e.ext_error);
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const checks: Check[] = [
    { label: "Every entry balances", ok: unbalanced === 0,
      detail: unbalanced ? `${unbalanced} entr${unbalanced === 1 ? "y has" : "ies have"} debits that don't equal credits` : `${entries.length} entries, debits equal credits` },
    { label: "Trial balance is even", ok: cents(totalDebit) === cents(totalCredit), detail: `${usd(totalDebit)} debits, ${usd(totalCredit)} credits` },
    { label: "Suspense matches held payments", ok: cents(suspense) === cents(heldNow),
      detail: `${usd(suspense)} in 2190 against ${usd(heldNow)} on held cases` },
    { label: "Every case is booked", ok: missing.length === 0,
      detail: missing.length ? `${missing.length} case${missing.length === 1 ? "" : "s"} missing an entry` : `${money.length} payment cases, all booked` },
  ];
  return { balances, totalDebit, totalCredit, suspense, heldNow, stopped, posted, failed, checks };
}

/** Journal export: one row per line, the shape most ledgers import (debits and credits in separate columns). */
export function toCsv(entries: JournalEntry[], cases: Pick<Case, "_id" | "member_name">[]): string {
  const who = new Map(cases.map((c) => [c._id, c.member_name]));
  const q = (v: string | number) => (typeof v === "number" ? v.toFixed(2) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Date", "Entry", "Account number", "Account", "Debit", "Credit", "Memo", "Member", "Case", "QuickBooks id"]];
  for (const e of [...entries].sort((a, b) => a.t - b.t)) {
    for (const l of e.lines) {
      rows.push([e.date, e.key, l.account, l.name, l.debit ? l.debit.toFixed(2) : "", l.credit ? l.credit.toFixed(2) : "", e.memo, who.get(e.caseId) ?? "", e.caseId, e.ext_id ?? ""]);
    }
  }
  return rows.map((r) => r.map(q).join(",")).join("\n") + "\n";
}

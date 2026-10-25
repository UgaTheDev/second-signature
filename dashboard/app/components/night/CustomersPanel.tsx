"use client";

import { Search, X } from "lucide-react";
import { useContext, useState } from "react";
import { DemoContext, useReview } from "../../lib/data";
import { customerDirectory, customerFacts, matchesCustomer, type Customer } from "../../lib/customers";
import { money, words } from "../../lib/format";
import type { Case } from "../../lib/types";
import { CustomerReviewCard } from "./CustomerReviewCard";
import { Stamp } from "./primitives";

const date = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const CARD = "rounded-xl border border-line bg-panel p-5";

function ProfileDetail({ customer, demo }: { customer: Customer; demo: boolean }) {
  const facts = customerFacts(customer);
  const review = useReview();
  const pendingReview = review?.customers?.find((proposal) => proposal.member_id === customer.id && proposal.status === "proposed");
  const [transactionSearch, setTransactionSearch] = useState("");
  const transactions = facts.transactions.filter((c) => `${c.merchant} ${words(c.category)}`.toLowerCase().includes(transactionSearch.trim().toLowerCase()));
  return (
    <article className="min-w-0 flex-1 space-y-6 p-6 max-sm:p-4">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[26px] font-semibold tracking-tight">{customer.name}</h2>
          {facts.active > 0 && <span className="rounded-full bg-amber/10 px-2.5 py-1 text-[12px] text-amber">{facts.active} active issue{facts.active === 1 ? "" : "s"}</span>}
        </div>
        <p className="mt-1 text-[13px] text-muted">Customer ID: {customer.id}{customer.profile ? ` · Age ${customer.profile.age}` : ""}</p>
        {customer.profile && <p className="mt-1 text-[13px] text-muted">{customer.profile.sub}</p>}
        <p className="mt-3 text-[12px] text-muted">{demo ? "Sample customer data" : "Customer profile and recorded case information"} · Transaction statistics cover available reviewed purchases, including holds.</p>
      </header>

      {review && pendingReview && (
        <section aria-labelledby="customer-pending-review-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="customer-pending-review-title" className="text-[17px] font-semibold">Pending policy review</h3>
            <span className="text-[12px] text-muted">Proposed {date(review.started_at)}</span>
          </div>
          <CustomerReviewCard key={`${review._id}-${customer.id}`} customer={pendingReview} review={review} />
        </section>
      )}

      <dl className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[
          ["Reviewed purchases", String(facts.transactions.length)],
          ["Average purchase", facts.average === null ? "—" : money(facts.average)],
          ["Largest purchase", facts.largest === null ? "—" : money(facts.largest)],
        ].map(([label, value]) => <div key={label} className={CARD}><dt className="text-[12px] text-muted">{label}</dt><dd className="num mt-2 text-[24px] font-medium">{value}</dd></div>)}
      </dl>

      <section className={CARD} aria-labelledby="financial-patterns-title">
        <h3 id="financial-patterns-title" className="text-[17px] font-semibold">Financial patterns</h3>
        <div className="mt-4 grid gap-6 xl:grid-cols-2">
          <div>
            <h4 className="text-[12px] font-medium text-muted">Established spending profile</h4>
            {customer.profile ? <>
              <ul className="mt-3 flex flex-wrap gap-2">{customer.profile.pattern.map((pattern) => <li key={pattern} className="rounded-md border border-line px-2 py-1 text-[12px]">{pattern}</li>)}</ul>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{customer.profile.note}</p>
            </> : <p className="mt-3 text-[13px] text-muted">No established spending profile recorded.</p>}
          </div>
          <div>
            <h4 className="text-[12px] font-medium text-muted">Categories in reviewed purchases</h4>
            {facts.categories.length ? <ul className="mt-2 divide-y divide-line">{facts.categories.map((row) => <li key={row.category} className="flex items-center justify-between gap-3 py-2 text-[13px]"><span className="capitalize">{words(row.category)} <span className="text-muted">· {row.count}</span></span><span className="num">{money(row.amount)}</span></li>)}</ul> : <p className="mt-3 text-[13px] text-muted">No purchases available to identify patterns.</p>}
            <p className="mt-2 text-[12px] text-muted">These cases may emphasize unusual activity; they do not represent the full account history.</p>
          </div>
        </div>
      </section>

      <section className={CARD} aria-labelledby="credit-information-title">
        <h3 id="credit-information-title" className="text-[17px] font-semibold">Credit information</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {['Credit score', 'Credit utilization', 'Total credit balance'].map((label) => <div key={label}><dt className="text-[12px] text-muted">{label}</dt><dd className="mt-1 text-[13px]">Not available</dd></div>)}
        </dl>
        <h4 className="mt-5 border-t border-line pt-4 text-[13px] font-medium">Recorded credit and identity signals</h4>
        {facts.credit.length ? <ul className="mt-3 space-y-3">{facts.credit.map((signal) => <li key={signal.fact}><p className="text-[14px] leading-relaxed">{signal.fact}</p><p className="mt-1 text-[12px] text-muted">CRS · Recorded {date(signal.recordedAt)}</p></li>)}</ul> : <p className="mt-3 text-[13px] text-muted">No credit information has been recorded for this customer.</p>}
      </section>

      <section className={`${CARD} overflow-hidden`} aria-labelledby="transaction-history-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="transaction-history-title" className="text-[17px] font-semibold">Key transaction history</h3>
          <input aria-label="Filter transactions by merchant or category" placeholder="Filter transactions…" value={transactionSearch} onChange={(e) => setTransactionSearch(e.target.value)} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] sm:w-56" />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Reviewed purchases for {customer.name}, newest first</caption>
            <thead className="border-b border-line text-[12px] text-muted"><tr>{['Date', 'Merchant', 'Amount', 'Outcome'].map((heading) => <th key={heading} scope="col" className="px-2 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{transactions.map((c) => <tr key={c._id}>
              <td className="whitespace-nowrap px-2 py-3 text-muted">{date(c.opened_at)}</td>
              <td className="min-w-40 px-2 py-3"><span className="font-medium">{c.merchant}</span><span className="mt-0.5 block text-[12px] capitalize text-muted">{words(c.category)}</span></td>
              <td className="num whitespace-nowrap px-2 py-3">{money(c.amount)}</td>
              <td className="px-2 py-3"><Stamp status={c.status} size="sm" /></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!transactions.length && <p className="py-5 text-[13px] text-muted">{transactionSearch.trim() ? "No transactions match your search." : "No reviewed purchases recorded."}</p>}
        <p className="mt-3 text-[12px] text-muted">Dates reflect when cases were opened. Showing purchases from the latest 50 cases available to this desk.</p>
      </section>
    </article>
  );
}

export function CustomersPanel({ cases }: { cases: Case[] | undefined }) {
  const demo = useContext(DemoContext);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const customers = customerDirectory(cases ?? []);
  const matching = customers.filter((customer) => matchesCustomer(customer, query));
  const current = matching.find((customer) => customer.id === selected) ?? matching[0];
  return (
    <section className="mx-auto max-w-[1500px] px-6 py-8 max-sm:px-4">
      <header className="mb-6 pr-12"><h2 className="text-[24px] font-semibold">Member profiles</h2><p className="mt-1 text-[14px] text-muted">Transaction history, credit information, and financial patterns in one place.</p></header>
      <div className="overflow-hidden rounded-xl border border-line lg:flex">
        <aside className="shrink-0 border-b border-line bg-panel/40 lg:w-72 lg:border-r lg:border-b-0" aria-label="Customer directory">
          <div className="p-4">
            <label htmlFor="customer-search" className="mb-2 block text-[12px] font-medium text-muted">Find a customer</label>
            <div className="relative">
              <Search size={15} aria-hidden className="absolute top-3 left-3 text-muted" />
              <input id="customer-search" type="search" placeholder="Name, ID, or merchant" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full rounded-lg border border-line bg-bg py-2.5 pr-3 pl-9 text-[13px]" />
            </div>
            <p role="status" className="mt-2 text-[12px] text-muted">{cases ? `${matching.length} customer${matching.length === 1 ? "" : "s"}` : "Loading customer records…"}</p>
          </div>
          <ul className="max-h-72 overflow-y-auto pb-3 lg:max-h-none">{matching.map((customer) => <li key={customer.id}>
            <button type="button" aria-current={current?.id === customer.id ? "true" : undefined} onClick={() => setSelected(customer.id)} className={`w-full cursor-pointer border-l-2 px-4 py-3 text-left hover:bg-panel2 ${current?.id === customer.id ? "border-l-amber bg-panel2" : "border-l-transparent"}`}>
              <span className="block text-[14px] font-medium">{customer.name}</span><span className="mt-1 block text-[12px] text-muted">{customer.id} · {customer.cases.length} recorded case{customer.cases.length === 1 ? "" : "s"}</span>
            </button>
          </li>)}</ul>
        </aside>
        {!cases ? <p className="p-8 text-muted">Loading customer information…</p> : current ? <ProfileDetail key={`${demo}-${current.id}`} customer={current} demo={demo} /> : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center"><p className="text-muted">No customers match “{query}”.</p><button type="button" onClick={() => setQuery("")} className="flex cursor-pointer items-center gap-2 text-[13px] underline underline-offset-4"><X size={14} aria-hidden />Clear search</button></div>
        )}
      </div>
    </section>
  );
}

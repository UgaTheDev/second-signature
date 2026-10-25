"use client";

// 08 The books: every hold, release and fraud stop as a double-entry journal entry, the checks that
// prove the ledger ties out, and the hand-off to accounting (CSV, and QuickBooks when connected).
import { CircleAlert, CircleCheck, Download, Upload } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { post } from "../../lib/api";
import { reconcile, toCsv } from "../../lib/books";
import { DemoContext, useBooks } from "../../lib/data";
import type { JournalEntry } from "../../lib/types";
import { useToast } from "../ui";
import { Btn, SectionHead } from "./primitives";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const WHO: Record<string, string> = { agent: "Agent", member: "Member", human: "Analyst", gate: "Gate" };

function Figure({ label, value, sub, amber }: { label: string; value: string; sub: string; amber?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`num text-[28px] leading-none font-medium tracking-[-.02em] ${amber ? "text-amber" : ""}`}>{value}</span>
      <span className="text-[12px] text-pretty text-muted">{sub}</span>
    </div>
  );
}

function LedgerCell({ e }: { e: JournalEntry }) {
  if (e.ext_id) return <span className="text-[13px]">#{e.ext_id}</span>;
  if (e.ext_error) return <span className="text-[13px] text-red" title={e.ext_error}>Not posted</span>;
  return <span className="text-[13px] text-muted">Case file</span>;
}

export function BooksPanel() {
  const demo = useContext(DemoContext);
  const books = useBooks();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const entries = useMemo(() => books?.entries ?? [], [books]);
  const rec = useMemo(() => reconcile(entries, books?.cases ?? []), [entries, books]);
  const byId = useMemo(() => new Map((books?.cases ?? []).map((c) => [c._id, c])), [books]);
  const connected = entries.some((e) => e.ext_system);

  function download() {
    const blob = new Blob([toCsv(entries, books?.cases ?? [])], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `second-signature-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function sync() {
    if (demo) return toast("Sample data is on, so nothing was sent.", true);
    setBusy(true);
    const err = await post("/books/sync");
    setBusy(false);
    toast(err ?? "Sent. Entries show their QuickBooks number as they land.", Boolean(err));
  }

  return (
    <section className="flex flex-col gap-8">
      <SectionHead id="books" num="08" title="The books" />
      <p className="-mt-4 max-w-[720px] text-[14px] text-pretty text-muted">
        A held payment leaves the member&apos;s balance and waits in a suspense account until she or an analyst decides. Then it
        either settles to the card network or goes back to her. Each step is a balanced journal entry your accounting team can
        import.
      </p>
      <div className="-mt-3 flex flex-wrap gap-2">
        <Btn variant="quiet" size="sm" onClick={download} disabled={!entries.length}>
          <Download size={14} strokeWidth={1.75} aria-hidden /> Download CSV
        </Btn>
        <Btn variant="quiet" size="sm" onClick={sync} disabled={busy || !entries.length}>
          <Upload size={14} strokeWidth={1.75} aria-hidden /> {busy ? "Posting…" : "Post to QuickBooks"}
        </Btn>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-8 gap-y-5">
        <Figure label="Waiting in suspense" value={books ? usd(rec.suspense) : "—"} sub="Held payments not yet decided" amber={rec.suspense > 0} />
        <Figure label="Stopped as fraud" value={books ? usd(rec.stopped) : "—"} sub="Returned to members before it left" />
        <Figure label="Journal entries" value={books ? String(entries.length) : "—"} sub="One per hold, release or fraud stop" />
        <Figure
          label="In QuickBooks"
          value={connected ? `${rec.posted} of ${entries.length}` : "Not connected"}
          sub={connected ? (rec.failed.length ? `${rec.failed.length} failed; post again to retry` : "Posted as journal entries") : "Set the QBO_ keys to post live"}
        />
      </div>

      <div className="flex flex-wrap gap-x-12 gap-y-10">
        <div className="min-w-0 flex-[3_1_560px]">
          <h3 className="mb-3 text-[14px] font-medium">Journal</h3>
          {!entries.length ? (
            <p className="text-[14px] text-muted">{books ? "Nothing booked yet. Entries appear as payments are held or let through." : "Loading…"}</p>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Journal (scrolls sideways)">
              <table className="w-full min-w-[600px] border-collapse text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] text-muted">
                    <th className="py-2 pr-4 font-medium">Entry</th>
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 text-right font-medium">Debit</th>
                    <th className="py-2 pr-4 text-right font-medium">Credit</th>
                    <th className="py-2 font-medium">Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 200).map((e) =>
                    e.lines.map((l, i) => (
                      <tr key={`${e._id}-${i}`} className={i === e.lines.length - 1 ? "border-b border-line" : ""}>
                        {i === 0 && (
                          <>
                            <td rowSpan={e.lines.length} className="min-w-[180px] py-2.5 pr-4 align-top">
                              <span className="block leading-snug">{e.memo.split(":")[0]}</span>
                              <span className="text-[12px] text-muted">
                                {[when(e.t), byId.get(e.caseId)?.merchant, byId.get(e.caseId)?.member_name, WHO[e.by] ?? e.by].filter(Boolean).join(" · ")}
                              </span>
                            </td>
                          </>
                        )}
                        <td className={`min-w-[200px] py-1.5 pr-4 align-top ${l.credit ? "pl-5" : ""}`}>
                          <span className="num text-muted">{l.account}</span> {l.name}
                        </td>
                        <td className="num py-1.5 pr-4 text-right align-top">{l.debit ? usd(l.debit) : ""}</td>
                        <td className="num py-1.5 pr-4 text-right align-top">{l.credit ? usd(l.credit) : ""}</td>
                        {i === 0 && <td rowSpan={e.lines.length} className="py-2.5 align-top whitespace-nowrap"><LedgerCell e={e} /></td>}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex min-w-[280px] flex-[2_1_320px] flex-col gap-10">
          <div>
            <h3 className="mb-3 text-[14px] font-medium">Does it tie out?</h3>
            <ul className="flex flex-col gap-3">
              {rec.checks.map((c) => (
                <li key={c.label} className="flex gap-2.5">
                  {c.ok
                    ? <CircleCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-green" aria-label="Passes" />
                    : <CircleAlert size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-red" aria-label="Fails" />}
                  <span className="flex flex-col">
                    <span className="text-[14px]">{c.label}</span>
                    <span className="text-[13px] text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[14px] font-medium">Trial balance</h3>
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-muted">
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 text-right font-medium">Debit</th>
                  <th className="py-2 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rec.balances.map((b) => (
                  <tr key={b.account} className="border-b border-line">
                    <td className="py-2 pr-3"><span className="num text-muted">{b.account}</span> {b.name}</td>
                    <td className="num py-2 pr-3 text-right">{b.debit ? usd(b.debit) : ""}</td>
                    <td className="num py-2 text-right">{b.credit ? usd(b.credit) : ""}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2 pr-3">Total</td>
                  <td className="num py-2 pr-3 text-right">{usd(rec.totalDebit)}</td>
                  <td className="num py-2 text-right">{usd(rec.totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

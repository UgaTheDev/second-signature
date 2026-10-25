"use client";

// Policy review: a Factory Droid reads the night's cases and proposes policy changes per customer; an analyst approves or rejects each one.
import { useContext, useState } from "react";
import { post } from "../../lib/api";
import { DemoContext, useReview } from "../../lib/data";
import { CustomerReviewCard } from "./CustomerReviewCard";
import { Btn, SectionHead } from "./primitives";

export function ReviewPanel({ className = "" }: { className?: string }) {
  const demo = useContext(DemoContext);
  const r = useReview();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  async function send(path: string, done: string) {
    if (demo) return setMsg({ text: "Sample data is on, so nothing was sent.", bad: true });
    setBusy(true);
    const err = await post(path);
    setBusy(false);
    setMsg({ text: err ?? done, bad: Boolean(err) });
  }
  const running = r?.status === "running";
  const customers = (r?.customers ?? []).filter((customer) => customer.status !== "no_change").sort((a, b) => a.member_name.localeCompare(b.member_name));
  return (
    <section className={`flex flex-col gap-5 px-7 py-8 ${className}`}>
      <SectionHead id="review" title="Policy reviews" />
      <p className="text-[14px] text-muted">Approve or reject each customer’s recommendations independently.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Btn variant="outline" size="sm" disabled={busy || running} onClick={() => send("/review", "Review started.")}>
          {running ? "Review running…" : "Run review now"}
        </Btn>
        <span className="text-[13px] text-muted">
          {r === undefined ? "Loading…" : r === null ? "No review yet · runs at 7 am" : `${r.status.charAt(0).toUpperCase() + r.status.slice(1)} · ${new Date(r.started_at).toLocaleString()}`}
        </span>
      </div>
      {msg && <p role="status" className={`text-[13px] ${msg.bad ? "text-red" : "text-muted"}`}>{msg.text}</p>}
      {r && (
        <>
          {customers.length ? (
            <ul className="flex flex-col gap-3" aria-label="Reviews by customer">
              {customers.map((customer) => (
                <li key={customer.member_id}>
                  <CustomerReviewCard customer={customer} review={r} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{running ? "Checking for proposed changes…" : r.customers ? "No changes proposed. Nothing to review." : "This review has no customer summaries. Run a new review to organize its findings by customer."}</p>
          )}
          {r.status === "failed" && <p role="status" className="text-[14px] text-red">The review failed. Check the server connection and try again.</p>}
        </>
      )}
    </section>
  );
}

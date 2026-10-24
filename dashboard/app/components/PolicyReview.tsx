"use client";

import { useEffect, useRef, useState } from "react";
import { post } from "../lib/api";
import { useReview } from "../lib/data";
import { Button, useToast } from "./ui";

const WHEN: Record<string, string> = { schedule: "the 7 am schedule", analyst: "an analyst clicking Run", overrides: "analysts overriding the agent" };

export function PolicyReview({ demo }: { demo: boolean }) {
  const r = useReview();
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLPreElement>(null);
  const toast = useToast();

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [r?.steps.length]);

  async function send(path: string, done: string) {
    if (demo) {
      toast("Sample data is on, so nothing was sent.", true);
      return;
    }
    setBusy(true);
    const err = await post(path);
    setBusy(false);
    toast(err ?? done, Boolean(err));
  }

  const line = (l: string) =>
    l.startsWith("+") && !l.startsWith("+++") ? "bg-ok/15 text-ok"
    : l.startsWith("-") && !l.startsWith("---") ? "bg-danger/15 text-danger"
    : l.startsWith("@@") ? "text-ink-3"
    : "text-ink-2";

  return (
    <div className="mx-auto max-w-[920px] px-6 py-8">
      <h2 className="font-display text-3xl font-bold tracking-tight">Policy review</h2>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        An AI agent (Factory Droid) reads last night&apos;s cases, finds holds that were wrong or payments that got through, and proposes an edit to the
        guidance the triage model reads. It can edit one file. Nothing changes until an analyst approves the diff.
      </p>
      <div className="mt-6">
        <Button variant="primary" disabled={busy || r?.status === "running"} onClick={() => send("/review", "Review started.")}>
          {r?.status === "running" ? "Review running…" : "Run a review now"}
        </Button>
      </div>

      {r === undefined ? null : r === null ? (
        <p className="mt-8 text-ink-2">No review has run yet. It runs at 7 am, after three analyst overrides, or when you click above.</p>
      ) : (
        <section className="mt-10" aria-label="Latest review">
          <p className="mb-4 text-ink-2">
            Latest review: <span className="font-medium text-ink">{r.status}</span>, started by {WHEN[r.trigger] ?? r.trigger} on{" "}
            {new Date(r.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </p>
          {r.summary && <p className="mb-6 max-w-[62ch] text-lg">{r.summary}</p>}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <h3 className="mb-2 font-display text-lg font-semibold">What Droid did</h3>
              <pre ref={log} className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink-2">
                {r.steps.join("\n") || "No steps yet."}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-semibold">Proposed change to policy.md</h3>
              {r.diff ? (
                <pre className="max-h-72 overflow-auto border border-line bg-surface font-mono text-[13px] leading-relaxed">
                  {r.diff.split("\n").map((l, i) => (
                    <div key={i} className={`whitespace-pre-wrap break-words px-4 ${line(l)}`}>
                      {l || " "}
                    </div>
                  ))}
                </pre>
              ) : (
                <p className="text-ink-2">{r.status === "proposed" ? "Droid proposed no change." : "No diff yet."}</p>
              )}
              {r.status === "proposed" && r.diff && (
                <div className="mt-4 flex gap-3">
                  <Button variant="primary" disabled={busy} onClick={() => send("/review/approve", "Approved. Triage now reads the new policy.")}>
                    Approve change
                  </Button>
                  <Button disabled={busy} onClick={() => send("/review/reject", "Rejected. The policy is unchanged.")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

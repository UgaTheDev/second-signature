"use client";

// 06 Morning review: same logic as PolicyReview.tsx, Night Ledger look.
import { useContext, useEffect, useRef, useState } from "react";
import { post } from "../../lib/api";
import { DemoContext, useReview } from "../../lib/data";
import type { Review } from "../../lib/types";
import { Btn, Kicker, SectionHead } from "./primitives";

const WHEN: Record<string, string> = { schedule: "7 am schedule", analyst: "analyst", overrides: "analyst overrides" };
const STATUS_TONE: Record<Review["status"], string> = {
  running: "text-muted",
  proposed: "text-amber",
  approved: "text-green",
  rejected: "text-red",
  failed: "text-red",
};

// Server step strings (server/review.py): "allowed: …", "DENIED: …", "tool: …", "tools: …", "Droid started: …", else Droid's own text.
function tag(s: string): { tag: string; text: string; cls: string } {
  const m = s.match(/^(allowed|DENIED|tools?|Droid started):\s*/);
  if (!m) return { tag: "msg", text: s, cls: "text-amber" };
  const text = m[1] === "Droid started" ? `started: ${s.slice(m[0].length)}` : s.slice(m[0].length);
  if (m[1] === "allowed") return { tag: "ALLOWED", text, cls: "text-green" };
  if (m[1] === "DENIED") return { tag: "DENIED", text, cls: "text-red" };
  return { tag: m[1] === "Droid started" ? "droid" : m[1], text, cls: "text-term-ink" };
}

const diffLine = (l: string) =>
  l.startsWith("+") && !l.startsWith("+++") ? "bg-green/14 text-green"
  : l.startsWith("-") && !l.startsWith("---") ? "bg-red/14 text-red"
  : l.startsWith("@@") || l.startsWith("+++") || l.startsWith("---") ? "text-muted"
  : "text-ink";

const when = (t: number) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ReviewPanel({ className = "" }: { className?: string }) {
  const demo = useContext(DemoContext);
  const r = useReview();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [r?.steps.length]);

  async function send(path: string, done: string) {
    if (demo) return setMsg({ text: "Sample data is on, so nothing was sent.", bad: true });
    setBusy(true);
    const err = await post(path);
    setBusy(false);
    setMsg({ text: err ?? done, bad: Boolean(err) });
  }

  const running = r?.status === "running";

  return (
    <section className={`flex flex-col gap-4 px-7 py-[30px] ${className}`}>
      <SectionHead id="review" num="06" title="Morning review" />
      <p className="font-serif text-[18px] leading-[1.4] text-pretty text-muted italic">
        Factory Droid reads last night&apos;s case files and proposes a policy change. A human approves it.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Btn variant="outline" disabled={busy || running} onClick={() => send("/review", "Review started.")}>
          {running ? "REVIEW RUNNING…" : "RUN REVIEW NOW"}
        </Btn>
        <span className={`font-mono text-[11.5px] font-semibold tracking-[.08em] uppercase ${r ? STATUS_TONE[r.status] : "text-muted"}`}>
          {r === undefined ? "…" : r === null ? "No review yet · runs at 7 AM" : `${r.status} · ${WHEN[r.trigger] ?? r.trigger} · ${when(r.started_at)}`}
        </span>
      </div>
      {msg && (
        <p role="status" className={`ss-in font-serif text-[16px] italic ${msg.bad ? "text-red" : "text-muted"}`} key={msg.text}>
          {msg.text}
        </p>
      )}

      {r && r.steps.length > 0 && (
        <div ref={log} className="-mx-7 flex max-h-[220px] flex-col overflow-y-auto bg-term px-7 py-3.5 font-mono text-[12.5px] leading-[1.75] text-term-ink" aria-label="What Droid did">
          {r.steps.map((s, i) => {
            const t = tag(s);
            return (
              <div key={i} className="ss-in flex gap-2.5">
                <span className={`min-w-16 flex-none font-semibold ${t.cls}`}>{t.tag}</span>
                <span className="break-words opacity-90">{t.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {r && r.status !== "running" && (r.summary || r.diff) && (
        <div className="flex flex-col gap-3.5">
          {r.summary && <p className="font-serif text-[18px] leading-[1.45] text-pretty">{r.summary}</p>}
          {r.diff ? (
            <div className="border-y border-line font-mono text-[12.5px] leading-[1.65]">
              <div className="py-2">
                <Kicker>POLICY.MD</Kicker>
              </div>
              <div className="max-h-[360px] overflow-auto">
                {r.diff.split("\n").map((l, i) => (
                  <div key={i} className={`px-2 py-px break-words whitespace-pre-wrap ${diffLine(l)}`}>
                    {l || " "}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            r.status === "proposed" && <p className="text-muted">Droid proposed no change.</p>
          )}
          {r.status === "proposed" && r.diff && (
            <div className="flex gap-2.5">
              <Btn variant="ink" disabled={busy} onClick={() => send("/review/approve", "Approved. Triage now reads the new policy.")}>
                APPROVE CHANGE
              </Btn>
              <Btn variant="quiet" disabled={busy} onClick={() => send("/review/reject", "Rejected. The policy is unchanged.")}>
                REJECT
              </Btn>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

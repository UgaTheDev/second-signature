"use client";

import { Ban, Check, ChevronRight, Users, ShieldAlert, Lock, PhoneCall } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { post } from "../lib/api";
import { useCaseDetail } from "../lib/data";
import { clock, isShieldCase, money, needsDecision, shortClock, STATUS_LABEL, words } from "../lib/format";
import type { Action, CaseDetail } from "../lib/types";
import { StatusMark } from "./CaseQueue";
import { Button, Dialog, useToast } from "./ui";

// ---- the case in six steps, read from what actually happened -------------------------------------

const STEPS = ["Checked", "Held", "Called", "Verified", "Family", "Decided"] as const;

function stepsDone(c: CaseDetail): boolean[] {
  const has = (f: (a: Action) => boolean) => c.actions.some(f);
  return [
    has((a) => a.type === "triage"),
    has((a) => a.type === "hold") || c.status !== "allowed",
    has((a) => a.type === "call_member" || a.type === "call"),
    Boolean(c.state?.verified) || has((a) => a.type === "verify" && a.by === "member" && /verified$|verified from/i.test(a.detail)),
    has((a) => ["call_family", "connect_family", "family_bridge"].includes(a.type)) || Boolean(c.state?.bridged),
    c.status === "released" || c.status === "confirmed_fraud",
  ];
}

function Progress({ c }: { c: CaseDetail }) {
  const done = stepsDone(c);
  const skipped = c.status === "allowed";
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Where this case is">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={done[i] ? "font-medium text-ink" : "text-ink-3"}>
            {done[i] && <Check size={14} strokeWidth={2} className="mr-1 inline text-ok" aria-label="done" />}
            {s}
          </span>
          {i < STEPS.length - 1 && <ChevronRight size={14} className="text-ink-3" aria-hidden />}
        </li>
      ))}
      {skipped && <li className="text-ink-3">· no hold was needed</li>}
    </ol>
  );
}

// ---- decision bar -------------------------------------------------------------------------------

function Decision({ c }: { c: CaseDetail }) {
  const [asking, setAsking] = useState<null | "release" | "confirm_fraud">(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!needsDecision(c.status)) return null;

  async function go() {
    if (!asking) return;
    setBusy(true);
    const err = await post(`/cases/${c._id}/${asking}`);
    setBusy(false);
    if (err) toast(err, true);
    else {
      toast(asking === "release" ? "Released. The payment goes through." : "Marked as fraud. The payment stays stopped.");
      setAsking(null);
    }
  }

  const releasing = asking === "release";
  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-line py-4">
      <p className="mr-auto max-w-[44ch] text-ink-2">This case needs a person to decide. Neither choice can be undone from here.</p>
      <Button onClick={() => setAsking("release")}>Release payment</Button>
      <Button variant="danger" onClick={() => setAsking("confirm_fraud")}>
        <Ban size={16} strokeWidth={1.75} /> Confirm fraud
      </Button>
      <Dialog open={asking !== null} onClose={() => setAsking(null)} title={releasing ? "Release this payment?" : "Confirm this as fraud?"}>
        <p className="mb-4">
          {releasing
            ? `${money(c.amount)} at ${c.merchant} goes through to the merchant.`
            : `${money(c.amount)} at ${c.merchant} stays stopped and the case is closed as fraud.`}
        </p>
        <ul className="mb-6 space-y-1 text-sm text-ink-2">
          <li>{c.state?.verified ? `${c.member_name.split(" ")[0]} passed identity checks on the call.` : "She has not passed identity checks on a call."}</li>
          {c.state?.held_by_rule && <li>First purchase of this kind in her history, so the code floor held it.</li>}
          {c.state?.red_flags && <li>She described pressure or secrecy on the call.</li>}
        </ul>
        <div className="flex justify-end gap-3">
          <Button onClick={() => setAsking(null)}>Go back</Button>
          <Button variant={releasing ? "primary" : "danger"} onClick={go} disabled={busy}>
            {busy ? "Sending…" : releasing ? "Release payment" : "Confirm fraud"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

// ---- timeline -----------------------------------------------------------------------------------

const KEY = (a: Action) =>
  a.by === "gate" || ["family_bridge", "connect_family", "call_family", "release", "confirm_fraud", "escalate", "shield"].includes(a.type);

function Event({ a }: { a: Action }) {
  if (a.by === "gate")
    return (
      <div className="border-l-2 border-danger py-1 pl-4">
        <p className="flex items-center gap-2 text-sm font-medium text-danger">
          <Lock size={14} strokeWidth={1.75} aria-hidden />
          {a.type === "override" ? "Code floor overrode the model" : "Gate refused an action"} · {clock(a.t)}
        </p>
        <p>{a.detail}</p>
      </div>
    );
  if (["family_bridge", "connect_family", "call_family"].includes(a.type))
    return (
      <div className="border-l-2 border-accent py-1 pl-4">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <Users size={14} strokeWidth={1.75} aria-hidden />
          Family · {words(a.type)} · {clock(a.t)}
        </p>
        <p>{a.detail}</p>
      </div>
    );
  if (a.type === "shield")
    return (
      <div className="border-l-2 border-accent py-1 pl-4">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <ShieldAlert size={14} strokeWidth={1.75} aria-hidden />
          Scam Shield · {clock(a.t)}
        </p>
        <p>{a.detail}</p>
      </div>
    );
  return (
    <div className="border-l-2 border-ink-3 py-1 pl-4">
      <p className="text-sm font-medium text-ink-2">
        {words(a.type)} · {a.by} · {clock(a.t)}
      </p>
      <p>{a.detail}</p>
    </div>
  );
}

function Quiet({ a }: { a: Action }) {
  return (
    <p className="flex gap-3 text-sm text-ink-2">
      <span className="num w-[84px] shrink-0 text-ink-3">{clock(a.t)}</span>
      <span>
        <span className="font-medium">{words(a.type)}</span> · {a.detail}
      </span>
    </p>
  );
}

function Timeline({ c }: { c: CaseDetail }) {
  const items = [...c.actions].sort((a, b) => a.t - b.t);
  if (items.length === 0) return <p className="text-ink-2">Nothing has happened on this case yet.</p>;
  return (
    <div className="space-y-3">
      {items.map((a) => (KEY(a) ? <Event key={a._id} a={a} /> : <Quiet key={a._id} a={a} />))}
    </div>
  );
}

function Transcript({ c }: { c: CaseDetail }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [c.transcript.length]);
  if (c.transcript.length === 0) return <p className="text-ink-2">No call was recorded for this case.</p>;
  return (
    <div className="space-y-4">
      {c.transcript.map((l) => (
        <p key={l._id} className={`max-w-[62ch] ${l.speaker === "agent" ? "" : "ml-8 border-l-2 border-line pl-4"}`}>
          <span className="mb-0.5 block text-sm font-medium text-ink-2">
            {l.speaker === "agent" ? "Assistant" : c.member_name.split(" ")[0]} · {clock(l.t)}
          </span>
          {l.text}
        </p>
      ))}
      <div ref={end} />
    </div>
  );
}

// ---- the case -----------------------------------------------------------------------------------

export function CaseView({ caseId }: { caseId: string | null }) {
  const c = useCaseDetail(caseId);
  const [view, setView] = useState<"timeline" | "call">("timeline");

  if (!caseId || c === null)
    return <p className="py-12 text-ink-2">Select a case on the left to see what happened and what is waiting on you.</p>;
  if (c === undefined) return <p className="py-12 text-ink-2">Loading the case…</p>;

  const shield = isShieldCase(c);
  const sorted = [...c.risk_signals].sort((a, b) => b.weight - a.weight);

  return (
    <article>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ink-2">
            {c.member_name} · {words(c.category)} · opened {shortClock(c.opened_at)}
          </p>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            {c.merchant}
            {c.amount > 0 && <span className="num ml-3 font-semibold text-ink-2">{money(c.amount)}</span>}
          </h2>
        </div>
        <div className="pt-2 text-right">
          <StatusMark status={c.status} />
          <p className="text-sm text-ink-3">{STATUS_LABEL[c.status].hint}</p>
        </div>
      </header>

      {shield ? (
        <div className="mt-6 border-l-2 border-accent bg-raise px-5 py-4">
          <p className="mb-1 flex items-center gap-2 font-medium">
            <PhoneCall size={16} strokeWidth={1.75} className="text-accent" aria-hidden />
            Scam Shield flagged this call while it was happening
          </p>
          <p className="max-w-[64ch] text-ink-2">
            {sorted[0]?.fact ?? ""} Only {c.member_name.split(" ")[0]} heard the warning; the caller did not.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <Progress c={c} />
        </div>
      )}

      <div className="mt-6">
        <Decision c={c} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="What happened">
          <div className="mb-4 flex gap-6 border-b border-line" role="tablist">
            {(
              [
                ["timeline", "What happened"],
                ["call", `Call transcript${c.transcript.length ? ` (${c.transcript.length})` : ""}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`-mb-px border-b-2 pb-2 text-[15px] font-medium ${
                  view === id ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "timeline" ? <Timeline c={c} /> : <Transcript c={c} />}
        </section>

        <section aria-label="Why it was held" className="space-y-6">
          <div>
            <h3 className="mb-1 font-display text-lg font-semibold">Why</h3>
            <p className="max-w-[56ch]">{c.decision_rationale || "No reason was recorded."}</p>
          </div>
          {c.plan && (
            <div>
              <h3 className="mb-1 font-display text-lg font-semibold">The plan</h3>
              <p className="max-w-[56ch] text-ink-2">{c.plan}</p>
            </div>
          )}
          <div>
            <h3 className="mb-2 font-display text-lg font-semibold">Evidence</h3>
            <ul className="space-y-3">
              {sorted.map((s, i) => (
                <li key={i}>
                  <p className="mb-1 flex items-baseline justify-between gap-3 text-sm text-ink-2">
                    <span className="font-mono">{s.source}</span>
                    <span className="num">weight {Math.round(Math.max(0, Math.min(1, s.weight)) * 100)}%</span>
                  </p>
                  <p>{s.fact}</p>
                  <div className="mt-1 h-1 bg-line" aria-hidden>
                    <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(1, s.weight)) * 100}%` }} />
                  </div>
                </li>
              ))}
              {sorted.length === 0 && <li className="text-ink-2">No evidence was recorded.</li>}
            </ul>
          </div>
        </section>
      </div>
    </article>
  );
}

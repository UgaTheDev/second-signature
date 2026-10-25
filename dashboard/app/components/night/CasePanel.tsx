"use client";

// Centre column: the case head, pipeline ruler, analyst actions, live call, next/why, evidence, record.
import { useState } from "react";
import { post } from "../../lib/api";
import { countdown, deriveCall, holdExpiry, riskScore, riskTone, statusMeta, toneVar, type Tone } from "../../lib/derive";
import { clock, money, needsDecision, shortClock, words } from "../../lib/format";
import type { CaseDetail } from "../../lib/types";
import { EvidenceList } from "./EvidenceList";
import { LiveCall, useNow } from "./LiveCall";
import { Kicker, Stamp } from "./primitives";
import { RecordTimeline } from "./Record";

type Decision = "release" | "confirm_fraud";
type Signed = { kind: Decision; t: number };

// ---- pipeline ruler -------------------------------------------------------------------------------

function Pipeline({ c }: { c: CaseDetail }) {
  const has = (...t: string[]) => c.actions.some((a) => t.includes(a.type));
  const fin = c.status === "released" || c.status === "confirmed_fraud" || c.status === "allowed";
  const stages: [string, boolean][] = [
    ["Purchase", true],
    ["Triage", has("triage")],
    ["Hold", has("hold") || (c.status !== "allowed" && has("triage"))],
    ["Call", has("call_member", "call")],
    ["Verified", Boolean(c.state?.verified) || c.actions.some((a) => a.type === "verify" && a.by === "member" && /verified from/i.test(a.detail))],
    ["Family", Boolean(c.state?.bridged || c.state?.family_notified) || has("family_bridge", "family_call", "call_family", "connect_family")],
    [c.status === "escalated" ? "Analyst" : "Resolved", fin],
  ];
  let activeSet = false;
  return (
    <ol aria-label="Where this case is" className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-4 text-[12px]">
      {stages.map(([label, done], i) => {
        const last = i === stages.length - 1;
        const skip = !done && fin && !last;
        const active = !done && !skip && !activeSet;
        if (active) activeSet = true;
        const col = done ? (last ? toneVar(statusMeta(c.status).tone) : "var(--ink)") : active ? "var(--amber)" : "var(--muted)";
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={skip ? "line-through opacity-60" : done || active ? "font-medium" : "opacity-70"} style={{ color: col }}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (now)" : skip ? " (skipped)" : " (not yet)"}</span>
            </span>
            {!last && <span aria-hidden className="h-px w-4 sm:w-6" style={{ background: done ? "var(--muted)" : "var(--line)" }} />}
          </li>
        );
      })}
    </ol>
  );
}

// ---- the case ---------------------------------------------------------------------------------------

function CaseBody({ c }: { c: CaseDetail }) {
  const now = useNow();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signed, setSigned] = useState<Signed | null>(null);

  async function decide(kind: Decision) {
    setBusy(kind);
    setErr(null);
    const e = await post(`/cases/${c._id}/${kind}`);
    setBusy(null);
    if (e) setErr(e);
    else setSigned({ kind, t: Date.now() });
  }

  const call = deriveCall(c, now);
  const score = riskScore(c.risk_signals);
  const rTone: Tone = riskTone(score);
  const signer = c.actions.find((a) => a.by === "human" && (a.type === "release" || a.type === "confirm_fraud"));
  const seal = signer ? { fraud: signer.type === "confirm_fraud", t: signer.t } : signed ? { fraud: signed.kind === "confirm_fraud", t: signed.t } : null;
  const sealColor = seal?.fraud ? "var(--red)" : "var(--green)";
  const open = needsDecision(c.status);
  const id = c._id.length > 10 ? `${c._id.slice(0, 4)}…${c._id.slice(-4)}` : c._id;

  return (
    <article className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <Kicker>The case · {c.member_name}</Kicker>
            <h2 className="mt-1 font-serif text-[28px] leading-tight font-normal tracking-[-.01em] [overflow-wrap:anywhere]">{c.merchant}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {c.amount > 0 && <span className="num font-serif text-[clamp(40px,5vw,56px)] leading-none tracking-[-.02em] text-ink">{money(c.amount)}</span>}
              <Stamp status={c.status} size="sm" />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {words(c.category)} · opened <span className="num font-mono">{clock(c.opened_at)}</span> · case{" "}
              <span className="font-mono" title={c._id}>{id}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 text-[13px]">
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-muted">
                Risk <span className="num font-mono text-ink">{score}</span>/100 · {c.risk_signals.length} signal{c.risk_signals.length === 1 ? "" : "s"}
              </span>
              <span aria-hidden className="relative h-0.5 w-[120px] bg-line">
                <span className="absolute inset-y-0 left-0 transition-[width] duration-600" style={{ width: `${score}%`, background: toneVar(rTone) }} />
              </span>
            </div>
            {open && (
              <span className="text-muted">
                {c.status === "open" ? "Hold passes to an analyst in" : "With an analyst · hold expires in"}{" "}
                <span className="num font-mono text-ink">{countdown(holdExpiry(c.opened_at) - now)}</span>
              </span>
            )}
            {seal && (
              <div className="ss-in flex flex-col items-end gap-0.5 rounded-[6px] border px-3 py-1.5" style={{ borderColor: `color-mix(in oklch, ${sealColor} 45%, transparent)` }}>
                <span className="font-serif text-[15px] italic" style={{ color: sealColor }}>Second signature</span>
                <span className="text-[12px] text-muted">
                  Analyst · <span className="num font-mono">{shortClock(seal.t)}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <Pipeline c={c} />

        {open && !signed && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => decide("release")}
              className="cursor-pointer rounded-[6px] bg-ink px-4 py-2 text-[14px] font-medium text-bg transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "release" ? "Sending…" : "Release (analyst)"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => decide("confirm_fraud")}
              className="cursor-pointer rounded-[6px] border border-red px-4 py-2 text-[14px] font-medium text-red transition-colors hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "confirm_fraud" ? "Sending…" : "Confirm fraud"}
            </button>
            <span className="text-[13px] text-muted">Only an analyst can sign this.</span>
            {err && <span role="alert" className="basis-full text-[13px] text-red">{err}</span>}
          </div>
        )}
      </div>

      <LiveCall detail={c} now={now} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-10 gap-y-6">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-normal text-muted">What happens next</h3>
          <p className="text-[15px] leading-relaxed text-pretty">{c.plan || "Waiting on triage…"}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-normal text-muted">Why</h3>
          <p className="text-[15px] leading-relaxed text-pretty">{c.decision_rationale || "Waiting on triage…"}</p>
        </div>
      </div>

      <EvidenceList signals={c.risk_signals} />
      <RecordTimeline detail={c} live={call.state === "live"} />
    </article>
  );
}

/** undefined = loading, null = nothing selected. Local state (errors, the optimistic seal) resets per case. */
export function CasePanel({ detail }: { detail: CaseDetail | null | undefined }) {
  if (detail === undefined) return <p className="py-20 text-[15px] text-muted">Loading the case…</p>;
  if (detail === null)
    return (
      <div className="flex flex-col gap-2 py-20">
        <p className="font-serif text-[28px] leading-tight tracking-[-.01em]">Nothing needs a second signature.</p>
        <p className="text-[14px] text-muted">Pick a case from the ledger, or run a scenario.</p>
      </div>
    );
  return <CaseBody key={detail._id} c={detail} />;
}

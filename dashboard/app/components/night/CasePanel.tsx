"use client";

// Centre column: the case head, pipeline ruler, analyst actions, live call, next/why, evidence, record.
import { useState } from "react";
import { post } from "../../lib/api";
import { countdown, deriveCall, holdExpiry, riskScore, riskTone, statusMeta, toneVar, type Tone } from "../../lib/derive";
import { clock, money, needsDecision, shortClock, words } from "../../lib/format";
import type { CaseDetail } from "../../lib/types";
import { EvidenceList } from "./EvidenceList";
import { LiveCall, useNow } from "./LiveCall";
import { Btn, Kicker, OutlinedNumber, SignatureStroke, Stamp } from "./primitives";
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
    <ol aria-label="Where this case is" className="relative flex items-start overflow-x-auto border-t border-line pt-4">
      {stages.map(([label, done], i) => {
        const last = i === stages.length - 1;
        const skip = !done && fin && !last;
        const active = !done && !skip && !activeSet;
        if (active) activeSet = true;
        const col = done ? (last ? toneVar(statusMeta(c.status).tone) : "var(--brand)") : active ? "var(--amber)" : "var(--line)";
        return (
          <li key={label} className="flex min-w-16 flex-[1_1_0] flex-col gap-[9px]">
            <div className="flex items-center">
              <span
                aria-hidden
                className="size-3 flex-none rotate-45 border-[1.5px]"
                style={{ background: done ? col : "transparent", borderColor: col, borderStyle: skip ? "dashed" : "solid", boxShadow: done || active ? `0 0 18px -4px ${col}` : "none" }}
              />
              {!last && <span aria-hidden className="ml-1 h-0.5 flex-1" style={{ background: done ? "var(--brand)" : "var(--line)" }} />}
            </div>
            <span className="font-mono text-[10.5px] leading-[1.2] font-semibold tracking-[.12em] uppercase" style={{ color: done || active ? "var(--ink)" : "var(--muted)" }}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (now)" : skip ? " (skipped)" : " (not yet)"}</span>
            </span>
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
    <article className="flex flex-col gap-11">
      <div className="flex flex-col gap-[26px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Kicker>THE CASE · {c.member_name}</Kicker>
            <h2 className="mt-1.5 font-serif text-[42px] leading-none font-normal tracking-[-.02em] [overflow-wrap:anywhere]">{c.merchant}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-2.5">
              {c.amount > 0 && <span className="num font-serif text-[clamp(84px,9vw,148px)] leading-[.85] tracking-[-.05em] text-ink">{money(c.amount)}</span>}
              <Stamp status={c.status} size="lg" pop />
            </div>
            <p className="mt-2.5 font-mono text-[13.5px] text-muted">
              {words(c.category)} · opened {clock(c.opened_at)} · case <span title={c._id}>{id}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-3.5">
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-end gap-1.5 pb-2.5">
                <Kicker>RISK / 100</Kicker>
                <span className="text-[13px] text-muted">{c.risk_signals.length} signal{c.risk_signals.length === 1 ? "" : "s"}</span>
                <span aria-hidden className="relative h-[3px] w-[90px] bg-line">
                  <span className="absolute inset-y-0 left-0 transition-[width] duration-600" style={{ width: `${score}%`, background: toneVar(rTone) }} />
                </span>
              </div>
              <OutlinedNumber value={score} tone={rTone} size={120} className="num" />
            </div>
            {open && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[13px] text-muted">{c.status === "open" ? "Hold passes to an analyst in" : "With an analyst · hold expires in"}</span>
                <span className="num font-mono text-[16px]">{countdown(holdExpiry(c.opened_at) - now)}</span>
              </div>
            )}
            {seal && (
              <div className="ss-in flex flex-col items-center border-[1.5px] px-[18px] pt-2.5 pb-2 outline-1 outline-offset-[3px] outline-solid" style={{ borderColor: sealColor, outlineColor: sealColor, transform: "rotate(-3deg)" }}>
                <span className="font-serif text-[26px] leading-[1.05] italic" style={{ color: sealColor }}>Second signature</span>
                <SignatureStroke variant="seal" tone={seal.fraud ? "red" : "green"} className="-mt-1 h-4 w-[120px]" />
                <span className="font-mono text-[11.5px] tracking-[.12em] text-muted">ANALYST · {shortClock(seal.t)}</span>
              </div>
            )}
          </div>
        </div>

        <Pipeline c={c} />

        {open && !signed && (
          <div className="flex flex-wrap items-center gap-3.5">
            <Btn variant="ink" size="lg" disabled={busy !== null} onClick={() => decide("release")}>
              {busy === "release" ? "SENDING…" : "RELEASE (ANALYST) →"}
            </Btn>
            <Btn variant="danger" size="lg" className="px-6 py-3.5" disabled={busy !== null} onClick={() => decide("confirm_fraud")}>
              {busy === "confirm_fraud" ? "SENDING…" : "CONFIRM FRAUD"}
            </Btn>
            <span className="font-serif text-[18px] text-muted italic">Only an analyst can sign this.</span>
            {err && <span role="alert" className="basis-full text-[14px] text-red">{err}</span>}
          </div>
        )}
      </div>

      <LiveCall detail={c} now={now} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-10 gap-y-7">
        <div className="flex flex-col gap-3">
          <h3 className="font-serif text-[28px] leading-none font-normal text-amber italic">What happens next</h3>
          <p className="font-serif text-[20px] leading-[1.45] text-pretty">{c.plan || "Waiting on triage…"}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-serif text-[28px] leading-none font-normal text-amber italic">Why</h3>
          <p className="font-serif text-[20px] leading-[1.45] text-pretty">{c.decision_rationale || "Waiting on triage…"}</p>
        </div>
      </div>

      <EvidenceList signals={c.risk_signals} />
      <RecordTimeline detail={c} live={call.state === "live"} />
    </article>
  );
}

/** undefined = loading, null = nothing selected. Local state (errors, the optimistic seal) resets per case. */
export function CasePanel({ detail }: { detail: CaseDetail | null | undefined }) {
  if (detail === undefined) return <p className="py-[90px] font-serif text-[20px] text-muted italic">Loading the case…</p>;
  if (detail === null)
    return (
      <div className="flex flex-col gap-3.5 py-[90px]">
        <SignatureStroke variant="seal" className="h-[50px] w-[320px] max-w-full" />
        <p className="font-serif text-[56px] leading-[.95] tracking-[-.03em]">
          Nothing needs a <em className="text-amber">second signature.</em>
        </p>
        <p className="text-[17px] text-muted">Pick a case from the ledger, or run a scenario.</p>
      </div>
    );
  return <CaseBody key={detail._id} c={detail} />;
}

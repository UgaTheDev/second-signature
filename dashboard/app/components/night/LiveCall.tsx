"use client";

// Live call band: ringing / live / bridged / ended, derived from actions + transcript (deriveCall).
import { useEffect, useState } from "react";
import { deriveCall, familyName, firstName, toneVar, type QState, type Tone } from "../../lib/derive";
import type { CaseDetail } from "../../lib/types";
import { Waveform } from "./primitives";

/** Ticking clock for countdowns and call timers. `enabled=false` stops the interval. */
export function useNow(enabled = true, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [enabled, ms]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Q: Record<QState, { mark: string; bg: string; fg: string; bd: string; word: string }> = {
  ok: { mark: "✓", bg: "var(--green)", fg: "var(--on-red)", bd: "var(--line)", word: "answered" },
  fail: { mark: "✕", bg: "var(--red)", fg: "var(--on-red)", bd: "var(--line)", word: "failed" },
  asking: { mark: "…", bg: "var(--panel2)", fg: "var(--ink)", bd: "var(--amber)", word: "asking" },
  pending: { mark: "", bg: "var(--panel2)", fg: "var(--ink)", bd: "var(--line)", word: "not asked yet" },
};

const LANE = "w-[120px] flex-none font-mono text-[11px] font-semibold tracking-[.14em] uppercase";

/** Renders nothing when the case has no call. Pass `now` from a parent clock to share its tick; otherwise it ticks itself. */
export function LiveCall({ detail, now: outer }: { detail: CaseDetail; now?: number }) {
  const own = useNow(outer === undefined);
  const now = outer ?? own;
  const call = deriveCall(detail, now);
  const k = call.state;
  if (k === "none") return null;

  const first = firstName(detail.member_name);
  const fam = familyName(detail.actions) ?? "Family";
  const bridged = k === "bridged";
  const accentTone: Tone = bridged ? "family" : k === "ended" ? "muted" : "green";
  const accent = toneVar(accentTone);
  const ok = call.qs.filter((q) => q.s === "ok").length;
  const verified = call.qs.length > 0 && ok === call.qs.length;

  const title = k === "ringing" ? `Calling ${first}…` : k === "live" ? `On the line with ${first}` : bridged ? `${first} and ${fam} are talking` : "Call ended";
  const sub = k === "ringing" ? "Twilio · ringing" : bridged ? "Private · not recorded" : k === "live" ? `Call in progress · ${call.startedAt ? mmss(now - call.startedAt) : "0:00"}` : "No one on the line";
  const speaking = k === "live" ? (call.speaking === "agent" ? "Agent speaking" : call.speaking === "member" ? `${first} speaking` : "Listening") : "";

  return (
    <section
      aria-label="The call"
      className="ss-in relative -mx-9 flex flex-col gap-[22px] overflow-hidden border-y px-9 max-sm:-mx-4 max-sm:px-4 pt-7 pb-[30px]"
      style={{ borderColor: k === "ended" ? "var(--line)" : accent, background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 15%, transparent), transparent 75%)` }}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2.5">
        <span className="inline-flex items-center gap-2 border-[1.5px] px-2.5 py-[5px] font-mono text-[11px] leading-none font-bold tracking-[.18em]" style={{ borderColor: accent, color: accent }}>
          <span aria-hidden className="size-[7px] rounded-full" style={{ background: accent }} />
          {k === "ringing" ? "RING" : k === "ended" ? "END" : "LIVE"}
        </span>
        <h3 className="font-serif text-[34px] leading-none font-normal tracking-[-.02em]">{title}</h3>
        <span className="num font-mono text-[13px] text-muted">{sub}</span>
      </div>

      <div className="flex h-16 items-center">
        <Waveform active={k === "live" && call.speaking !== null} tone={call.speaking === "member" ? "green" : "ink"} className="max-w-[400px] flex-1" />
        {speaking && <span className="ml-3.5 font-mono text-[11px] font-semibold tracking-[.14em] whitespace-nowrap text-muted uppercase">{speaking}</span>}
      </div>

      <div className="flex flex-wrap gap-x-12 gap-y-[22px]">
        {call.qs.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">IDENTITY · FROM THE CREDIT FILE</span>
            <div className="flex items-center gap-3">
              {call.qs.map((q, i) => {
                const m = Q[q.s];
                return (
                  <span key={i} className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold tracking-[.1em]">
                    <span aria-hidden className="grid size-7 place-items-center border-[1.5px] text-[13px]" style={{ background: m.bg, color: m.fg, borderColor: m.bd }}>{m.mark}</span>
                    Q{i + 1}<span className="sr-only">: {m.word}</span>
                  </span>
                );
              })}
              <span className="font-serif text-[20px] italic" style={{ color: verified ? "var(--green)" : "var(--muted)" }}>
                {verified ? "Verified" : `${ok} of ${call.qs.length}`}
              </span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className={LANE}>{first}</span>
            <span aria-hidden className="h-[3px] flex-1 bg-green" />
          </div>
          <div className="flex items-center gap-3 transition-opacity duration-[1200ms]" style={{ opacity: bridged ? 0.28 : 1 }}>
            <span className={LANE}>BAYVIEW AGENT{bridged && <span className="sr-only"> (left the line)</span>}</span>
            <span aria-hidden className="h-0 flex-1 border-t-[3px] border-ink" style={{ borderTopStyle: bridged ? "dashed" : "solid" }} />
          </div>
          <div className="flex items-center gap-3">
            <span className={LANE} style={{ color: bridged ? "var(--family)" : "var(--muted)" }}>{fam}{!bridged && <span className="sr-only"> (not on the call)</span>}</span>
            <span aria-hidden className="h-[3px] flex-1 transition-colors duration-1000" style={{ background: bridged ? "var(--family)" : "var(--line)" }} />
          </div>
        </div>
      </div>

      {bridged ? (
        <p className="ss-in font-serif text-[clamp(34px,3.6vw,52px)] leading-none tracking-[-.02em] text-family italic">The agent leaves the line.</p>
      ) : (
        <p className="font-serif text-[18px] text-muted italic">Family can join only if {first} is verified and asks.</p>
      )}
    </section>
  );
}

"use client";

// Live call band: ringing / live / bridged / ended, derived from actions + transcript (deriveCall).
import { useEffect, useState } from "react";
import { deriveCall, firstName, toneVar, type QState, type Tone } from "../../lib/derive";
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

const Q: Record<QState, { mark: string; color: string; word: string }> = {
  ok: { mark: "✓", color: "var(--green)", word: "answered" },
  fail: { mark: "✕", color: "var(--red)", word: "failed" },
  asking: { mark: "…", color: "var(--amber)", word: "asking" },
  pending: { mark: "·", color: "var(--muted)", word: "not asked yet" },
};

const LANE = "w-[110px] flex-none truncate text-[12px] text-muted";

/** Renders nothing when the case has no call. Pass `now` from a parent clock to share its tick; otherwise it ticks itself. */
export function LiveCall({ detail, now: outer }: { detail: CaseDetail; now?: number }) {
  const own = useNow(outer === undefined);
  const now = outer ?? own;
  const call = deriveCall(detail, now);
  const k = call.state;
  if (k === "none") return null;

  const first = firstName(detail.member_name);
  const bridged = k === "bridged";
  const accentTone: Tone = bridged ? "muted" : k === "ended" ? "muted" : "green";
  const accent = toneVar(accentTone);
  const ok = call.qs.filter((q) => q.s === "ok").length;
  const verified = call.qs.length > 0 && ok === call.qs.length;

  const title = k === "ringing" ? `Calling ${first}…` : k === "live" ? `On the line with ${first}` : bridged ? "Call transferred" : "Call ended";
  const sub = k === "ringing" ? "Twilio · ringing" : bridged ? "Private · not recorded" : k === "live" ? `Call in progress · ${call.startedAt ? mmss(now - call.startedAt) : "0:00"}` : "No one on the line";
  const speaking = k === "live" ? (call.speaking === "agent" ? "Agent speaking" : call.speaking === "member" ? `${first} speaking` : "Listening") : "";

  return (
    <section
      aria-label="The call"
      className="ss-in flex flex-col gap-4 border-y border-line border-l-2 py-5 pl-5"
      style={{ borderLeftColor: k === "ended" ? "var(--line)" : accent }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: accent }}>
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: accent }} />
          {k === "ringing" ? "Ringing" : k === "ended" ? "Ended" : "Live"}
        </span>
        <h3 className="text-[16px] leading-tight font-medium">{title}</h3>
        <span className="num font-mono text-[12px] text-muted">{sub}</span>
      </div>

      <div className="flex items-center gap-3">
        <Waveform active={k === "live" && call.speaking !== null} tone={call.speaking === "member" ? "green" : "muted"} height={24} bars={40} className="max-w-[280px] flex-1" />
        {speaking && <span className="text-[12px] whitespace-nowrap text-muted">{speaking}</span>}
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        {call.qs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-muted">Identity, from the credit file</span>
            <div className="flex items-center gap-3 text-[13px]">
              {call.qs.map((q, i) => {
                const m = Q[q.s];
                return (
                  <span key={i} className="inline-flex items-center gap-1">
                    Q{i + 1}
                    <span aria-hidden style={{ color: m.color }}>{m.mark}</span>
                    <span className="sr-only">: {m.word}</span>
                  </span>
                );
              })}
              <span style={{ color: verified ? "var(--green)" : "var(--muted)" }}>
                {verified ? "Verified" : `${ok} of ${call.qs.length}`}
              </span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className={LANE}>{first}</span>
            <span aria-hidden className="h-px flex-1 bg-green" />
          </div>
          <div className="flex items-center gap-3 transition-opacity duration-[1200ms]" style={{ opacity: bridged ? 0.35 : 1 }}>
            <span className={LANE}>Bayview agent{bridged && <span className="sr-only"> (left the line)</span>}</span>
            <span aria-hidden className="h-0 flex-1 border-t border-ink" style={{ borderTopStyle: bridged ? "dashed" : "solid" }} />
          </div>
        </div>
      </div>

    </section>
  );
}

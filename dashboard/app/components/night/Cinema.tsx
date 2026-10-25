"use client";
// Cinema mode: the selected case's call, full screen. Native <dialog>.showModal() gives the focus trap,
// inert page and aria-modal semantics for free; Esc is routed through our own close so dismissal is remembered.
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { actionLabel, deriveCall, familyName, firstName, heardFlags, toneVar, type DerivedCall, type Tone } from "../../lib/derive";
import { money, shortClock } from "../../lib/format";
import type { CaseDetail, Status } from "../../lib/types";
import { Waveform } from "./primitives";

const ACTIVE = new Set(["ringing", "live", "bridged"]);
const RESOLVED = new Set<Status>(["escalated", "released", "confirmed_fraud"]);
const KEY_PHRASE = /not to tell the bank|let it go through|gift cards|Microsoft/i;
const MONO = "font-mono text-[11px] leading-none font-bold tracking-[.18em]";
const DIM = (pct: number) => `color-mix(in oklch, var(--term-ink) ${pct}%, transparent)`;

const lineSize = (n: number) =>
  n < 70 ? "clamp(56px,6.4vw,104px)" : n < 140 ? "clamp(46px,5vw,80px)" : n < 220 ? "clamp(38px,4vw,62px)" : "clamp(32px,3.3vw,52px)";
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Cinema({
  detail, open, onClose, onOpenChange,
}: {
  detail: CaseDetail | null | undefined;
  open: boolean;
  onClose: () => void;
  /** Called with `true` to auto-open when the call goes ringing/live/bridged. Omit it to disable auto-open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dismissed = useRef(new Set<string>());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000); // ponytail: 1s tick drives timer, speaking, silence timeout
    return () => clearInterval(t);
  }, []);

  const call = deriveCall(detail, now);
  const id = detail?._id ?? null;
  const ended = call.state === "ended";
  const resolved = detail ? RESOLVED.has(detail.status) : false;

  const close = () => {
    if (id) dismissed.current.add(id);
    onClose();
  };
  const autoClose = useEffectEvent(close);
  const autoOpen = useEffectEvent(() => onOpenChange?.(true));

  // Auto-open once per case. Skipped for already-resolved cases so it doesn't flash open then auto-close.
  useEffect(() => {
    if (!open && id && !resolved && ACTIVE.has(call.state) && !dismissed.current.has(id)) autoOpen();
  }, [open, id, resolved, call.state]);

  // Auto-close 2.5s after the call ends / 5s after status resolves, but only for changes seen while open,
  // so opening a finished case by hand doesn't snap shut. ponytail: baseline taken at open time per case.
  const base = useRef<{ id: string; ended: boolean; resolved: boolean } | null>(null);
  useEffect(() => {
    if (!open || !id) {
      base.current = null;
      return;
    }
    if (base.current?.id !== id) base.current = { id, ended, resolved };
    const delay = ended && !base.current.ended ? 2500 : resolved && !base.current.resolved ? 5000 : 0;
    if (!delay) return;
    const t = setTimeout(autoClose, delay);
    return () => clearTimeout(t);
  }, [open, id, ended, resolved]);

  const show = open && !!detail; // never a blank modal with no exit button
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show && !d.open) d.showModal();
    if (!show && d.open) d.close();
  }, [show]);

  return (
    <dialog
      ref={ref}
      aria-label="Cinema mode: live call"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-term p-0 text-term-ink backdrop:bg-term"
    >
      {show && detail && <Stage detail={detail} call={call} now={now} onExit={close} />}
    </dialog>
  );
}

function Stage({ detail, call, now, onExit }: { detail: CaseDetail; call: DerivedCall; now: number; onExit: () => void }) {
  const exitRef = useRef<HTMLButtonElement>(null);
  useEffect(() => exitRef.current?.focus(), []);

  const k = call.state;
  const F = firstName(detail.member_name);
  const FU = F.toUpperCase();
  const family = familyName(detail.actions);
  const contact = family ?? "Family";
  const lines = [...detail.transcript].sort((a, b) => a.t - b.t);
  const cur = lines.at(-1);
  const prev = lines.at(-2);
  const gates = [...detail.actions].sort((a, b) => a.t - b.t).filter((a) => a.type === "deny" || (a.type === "override" && lines.length));
  const gate = gates.at(-1);
  const gateLatest = !!gate && (!cur || gate.t > cur.t);
  const mode = k === "ringing" || (!cur && !gateLatest && k !== "bridged") ? "ring" : k === "bridged" ? "bridge" : gateLatest ? "gate" : "line";
  const glow: Tone = mode === "gate" ? "red" : mode === "bridge" ? "family" : mode === "ring" ? "amber" : "brand";

  const [kicker, kTone]: [string, Tone] =
    k === "ringing" ? [`RINGING · CALLING ${FU}`, "amber"]
    : k === "live" ? [`LIVE · ON THE LINE WITH ${FU} · ${call.startedAt ? mmss(now - call.startedAt) : "0:00"}`, "green"]
    : k === "bridged" ? [`PRIVATE · ${FU} AND ${contact.toUpperCase()} · NOT RECORDED`, "family"]
    : k === "ended" ? ["CALL ENDED", "muted"]
    : ["NO CALL ON THIS CASE", "muted"];

  const okQ = call.qs.filter((q) => q.s === "ok").length;
  const verified = call.qs.length > 0 && okQ === call.qs.length;
  const { flags, next, nextTone } = heardFlags(detail.transcript, detail.actions, call);
  const isM = cur?.speaker === "member";
  const who = (s: string) => (s === "agent" ? "AGENT" : FU);
  const whoTone = (s: string): Tone => (s === "member" ? "green" : "brand");
  const hm = cur?.text.match(KEY_PHRASE);
  const at = hm?.index ?? 0;

  return (
    <div
      className="ss-in relative flex h-full flex-col gap-7 overflow-y-auto px-4 pt-[38px] pb-11 md:overflow-hidden md:px-14"
      style={{ ["--ink" as string]: "var(--term-ink)" } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(60% 55% at 72% 38%, color-mix(in oklch, ${toneVar(glow)} 24%, transparent), transparent 72%), repeating-linear-gradient(0deg, oklch(1 0 0 / .03) 0 1px, transparent 1px 4px)`,
        }}
      />

      {/* top bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-x-7 gap-y-3.5">
        <span className={`flex items-center gap-3 ${MONO}`} style={{ color: toneVar(kTone) }} role="status">
          <span aria-hidden className="ss-blink size-2.5 rounded-full" style={{ background: toneVar(kTone) }} />
          {kicker}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-x-[18px] gap-y-2.5">
          {call.qs.map((q, i) => {
            const [mark, t, sr]: [string, Tone, string] =
              q.s === "ok" ? ["✓", "green", "passed"] : q.s === "fail" ? ["✕", "red", "failed"] : q.s === "asking" ? ["…", "amber", "asking"] : ["", "muted", "pending"];
            return (
              <span key={i} className={MONO} style={{ color: toneVar(t) }}>
                Q{i + 1} <span aria-hidden>{mark}</span>
                <span className="sr-only">{sr}</span>
              </span>
            );
          })}
          {call.qs.length > 0 && (
            <span className={MONO} style={{ color: verified ? "var(--term-ink)" : "var(--muted)" }}>
              {verified ? "VERIFIED" : `${okQ} OF ${call.qs.length}`}
            </span>
          )}
          <button
            ref={exitRef}
            type="button"
            onClick={onExit}
            className={`cursor-pointer border px-3.5 py-[9px] whitespace-nowrap transition-colors hover:bg-term-ink hover:text-term ${MONO}`}
            style={{ borderColor: DIM(35) }}
          >
            EXIT · ESC
          </button>
        </div>
      </div>

      {/* main */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-12 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[34px]">
          {mode === "ring" &&
            (k === "ringing" ? (
              <div className="flex flex-col gap-[26px]">
                <span aria-hidden className="ss-pulse size-[26px] rounded-full bg-amber" />
                <div className="font-serif leading-[.92] tracking-[-.045em]" style={{ fontSize: "clamp(64px,8vw,132px)" }}>
                  Calling <em className="text-amber">{F}…</em>
                </div>
                <div className="max-w-[820px] font-serif text-[26px] leading-[1.35]" style={{ color: DIM(70) }}>
                  Nothing’s wrong with the account. We just want to check one purchase: {money(detail.amount)} at {detail.merchant}.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[26px]">
                <div className="font-serif leading-[.92] tracking-[-.045em]" style={{ fontSize: "clamp(48px,6vw,96px)" }}>
                  {k === "ended" ? "The call has ended." : <>No call on <em className="text-amber">{F}’s</em> case.</>}
                </div>
                <div className="max-w-[820px] font-serif text-[26px] leading-[1.35]" style={{ color: DIM(70) }}>
                  {money(detail.amount)} at {detail.merchant}. Pick a case with a call, or run a scenario.
                </div>
              </div>
            ))}

          {mode === "line" && cur && (
            <div className="flex flex-col gap-[34px]">
              {prev && (
                <div className="flex max-w-[900px] flex-col gap-2.5">
                  <span className={MONO} style={{ color: toneVar(whoTone(prev.speaker)) }}>
                    {who(prev.speaker)} · {shortClock(prev.t)}
                  </span>
                  <div className="line-clamp-3 font-serif text-[25px] leading-[1.35]" style={{ color: DIM(62) }}>
                    {prev.text}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4" aria-live="polite">
                <span className={MONO} style={{ color: toneVar(whoTone(cur.speaker)) }}>
                  {who(cur.speaker)} · {shortClock(cur.t)}
                </span>
                <div
                  className={`max-w-[1180px] font-serif leading-[1.04] tracking-[-.03em] text-pretty ${isM ? "italic" : ""}`}
                  style={{ fontSize: lineSize(cur.text.length) }}
                >
                  {isM && "“"}
                  {hm ? (
                    <>
                      {cur.text.slice(0, at)}
                      <span className="text-amber underline decoration-[3px] underline-offset-[10px]">{hm[0]}</span>
                      {cur.text.slice(at + hm[0].length)}
                    </>
                  ) : (
                    cur.text
                  )}
                  {isM && "”"}
                </div>
              </div>
            </div>
          )}

          {mode === "gate" && gate && (
            <div className="ss-in flex flex-wrap items-center gap-11">
              <span className="-rotate-6 font-serif leading-[.8] tracking-[-.06em] text-red italic" style={{ fontSize: "clamp(140px,16vw,260px)" }}>
                No.
              </span>
              <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
                <span className={`${MONO} text-[14px] text-red`}>
                  {actionLabel(gate.type)} · {gate.type}
                </span>
                <div className="font-serif leading-[1.12] tracking-[-.02em] text-pretty" style={{ fontSize: "clamp(32px,3.4vw,52px)" }}>
                  {gate.detail}
                </div>
                <span className={`self-start border-2 border-red px-3 py-[7px] text-red ${MONO}`}>ENFORCED IN CODE, NOT IN THE PROMPT.</span>
              </div>
            </div>
          )}

          {mode === "bridge" && (
            <div className="ss-in flex flex-col gap-6">
              <div className="font-serif leading-[.9] tracking-[-.045em] text-family italic" style={{ fontSize: "clamp(72px,9vw,150px)" }}>
                The agent leaves the line.
              </div>
              <div className="max-w-[860px] font-serif text-[28px] leading-[1.35]" style={{ color: DIM(78) }}>
                {F} and {contact} are talking privately. Not recorded. The hold stays until an analyst decides.
              </div>
            </div>
          )}
        </div>

        {/* right rail */}
        <div
          className="flex flex-col justify-center gap-4 border-t pt-5 md:w-[230px] md:flex-none md:self-stretch md:border-t-0 md:border-l md:pt-0 md:pl-[22px]"
          style={{ borderColor: DIM(20) }}
        >
          <span className={`${MONO} text-amber`}>HEARD ON THE CALL</span>
          {flags.length ? (
            flags.map((f) => (
              <span key={f} className="ss-in font-serif text-[23px] leading-[1.15]">
                {f}
              </span>
            ))
          ) : (
            <span className="font-serif text-[21px] italic" style={{ color: DIM(60) }}>
              Nothing concerning yet.
            </span>
          )}
          <span
            className={`${MONO} mt-2 text-[11.5px] leading-normal`}
            style={{ color: nextTone === "family" ? "var(--family)" : DIM(70) }}
          >
            {next}
          </span>
        </div>
      </div>

      {/* lanes */}
      <div className="relative flex flex-col gap-[18px]">
        <Lane label={F} tone="green">
          <Waveform active={(k === "live" && call.speaking === "member") || k === "bridged"} tone="green" height={58} className="flex-1" />
        </Lane>
        <Lane label="AGENT" tone="ink" className={`transition-opacity duration-[1.2s] ${k === "bridged" ? "opacity-35" : ""}`}>
          {k === "bridged" ? (
            <Gone tone="ink" note="left the line" />
          ) : (
            <Waveform active={k === "live" && call.speaking === "agent"} tone="ink" height={40} className="flex-1" />
          )}
        </Lane>
        <Lane label={contact} tone="family">
          {k === "bridged" ? (
            <Waveform active tone="family" height={58} className="flex-1" />
          ) : (
            <Gone tone="family" note={family ? `waiting for ${F}’s yes` : "not on the line"} faint />
          )}
        </Lane>
      </div>
    </div>
  );
}

function Lane({ label, tone, className = "", children }: { label: string; tone: Tone; className?: string; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-[22px] ${className}`}>
      <span className={`w-[120px] flex-none uppercase ${MONO}`} style={{ color: toneVar(tone) }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Gone({ tone, note, faint }: { tone: Tone; note: string; faint?: boolean }) {
  const c = toneVar(tone);
  return (
    <>
      <span aria-hidden className="flex-1 border-t-[3px] border-dashed" style={{ borderColor: faint ? `color-mix(in oklch, ${c} 50%, transparent)` : c }} />
      <span className="font-serif text-[20px] italic" style={{ color: c }}>
        {note}
      </span>
    </>
  );
}

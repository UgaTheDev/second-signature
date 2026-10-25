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
const LABEL = "text-[13px] leading-none";
const DIM = (pct: number) => `color-mix(in oklch, var(--term-ink) ${pct}%, transparent)`;

const lineSize = (n: number) => (n < 140 ? "clamp(28px,3.4vw,48px)" : "clamp(24px,2.6vw,36px)");
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
  const family = familyName(detail.actions);
  const contact = family ?? "Family";
  const lines = [...detail.transcript].sort((a, b) => a.t - b.t);
  const cur = lines.at(-1);
  const prev = lines.at(-2);
  const gates = [...detail.actions].sort((a, b) => a.t - b.t).filter((a) => a.type === "deny" || (a.type === "override" && lines.length));
  const gate = gates.at(-1);
  const gateLatest = !!gate && (!cur || gate.t > cur.t);
  const mode = k === "ringing" || (!cur && !gateLatest && k !== "bridged") ? "ring" : k === "bridged" ? "bridge" : gateLatest ? "gate" : "line";

  const [kicker, kTone]: [ReactNode, Tone] =
    k === "ringing" ? [`Ringing · calling ${F}`, "amber"]
    : k === "live" ? [<>Live · on the line with {F} · <span className="num font-mono">{call.startedAt ? mmss(now - call.startedAt) : "0:00"}</span></>, "green"]
    : k === "bridged" ? [`Private · ${F} and ${contact} · not recorded`, "family"]
    : k === "ended" ? ["Call ended", "muted"]
    : ["No call on this case", "muted"];

  const okQ = call.qs.filter((q) => q.s === "ok").length;
  const verified = call.qs.length > 0 && okQ === call.qs.length;
  const { flags, next, nextTone } = heardFlags(detail.transcript, detail.actions, call);
  const isM = cur?.speaker === "member";
  const who = (s: string) => (s === "agent" ? "Agent" : F);
  const whoTone = (s: string): Tone => (s === "member" ? "green" : "brand");
  const hm = cur?.text.match(KEY_PHRASE);
  const at = hm?.index ?? 0;

  return (
    <div
      className="ss-in relative flex h-full flex-col gap-8 overflow-y-auto px-4 pt-8 pb-10 md:overflow-hidden md:px-14"
      style={{ ["--ink" as string]: "var(--term-ink)" } as CSSProperties}
    >
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <span className={`flex items-center gap-2.5 ${LABEL}`} style={{ color: toneVar(kTone) }} role="status">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: toneVar(kTone) }} />
          {kicker}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {call.qs.map((q, i) => {
            const [mark, t, sr]: [string, Tone, string] =
              q.s === "ok" ? ["✓", "green", "passed"] : q.s === "fail" ? ["✕", "red", "failed"] : q.s === "asking" ? ["…", "amber", "asking"] : ["", "muted", "pending"];
            return (
              <span key={i} className={LABEL} style={{ color: toneVar(t) }}>
                Q{i + 1} <span aria-hidden>{mark}</span>
                <span className="sr-only">{sr}</span>
              </span>
            );
          })}
          {call.qs.length > 0 && (
            <span className={LABEL} style={{ color: verified ? "var(--term-ink)" : "var(--muted)" }}>
              {verified ? "Verified" : `${okQ} of ${call.qs.length}`}
            </span>
          )}
          <button
            ref={exitRef}
            type="button"
            onClick={onExit}
            className={`cursor-pointer rounded-md border px-3 py-2 whitespace-nowrap transition-colors hover:bg-term-ink hover:text-term ${LABEL}`}
            style={{ borderColor: DIM(25) }}
          >
            Exit · Esc
          </button>
        </div>
      </div>

      {/* main */}
      <div className="flex min-h-0 flex-1 flex-col gap-10 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-8">
          {mode === "ring" &&
            (k === "ringing" ? (
              <div className="flex flex-col gap-4">
                <div className="leading-[1.1] font-medium tracking-[-.02em]" style={{ fontSize: "clamp(32px,4vw,48px)" }}>
                  Calling <span className="text-amber">{F}…</span>
                </div>
                <div className="max-w-[720px] text-[18px] leading-[1.5]" style={{ color: DIM(70) }}>
                  Nothing’s wrong with the account. We just want to check one purchase: <span className="num font-mono">{money(detail.amount)}</span> at {detail.merchant}.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="leading-[1.1] font-medium tracking-[-.02em]" style={{ fontSize: "clamp(28px,3.4vw,44px)" }}>
                  {k === "ended" ? "The call has ended." : <>No call on <span className="text-amber">{F}’s</span> case.</>}
                </div>
                <div className="max-w-[720px] text-[18px] leading-[1.5]" style={{ color: DIM(70) }}>
                  <span className="num font-mono">{money(detail.amount)}</span> at {detail.merchant}. Pick a case with a call, or run a scenario.
                </div>
              </div>
            ))}

          {mode === "line" && cur && (
            <div className="flex flex-col gap-7">
              {prev && (
                <div className="flex max-w-[860px] flex-col gap-2">
                  <span className={LABEL} style={{ color: toneVar(whoTone(prev.speaker)) }}>
                    {who(prev.speaker)} · <span className="num font-mono">{shortClock(prev.t)}</span>
                  </span>
                  <div className="line-clamp-3 text-[16px] leading-[1.5]" style={{ color: DIM(55) }}>
                    {prev.text}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3" aria-live="polite">
                <span className={LABEL} style={{ color: toneVar(whoTone(cur.speaker)) }}>
                  {who(cur.speaker)} · <span className="num font-mono">{shortClock(cur.t)}</span>
                </span>
                <div
                  className={`max-w-[1100px] leading-[1.25] tracking-[-.015em] text-pretty ${isM ? "italic" : ""}`}
                  style={{ fontSize: lineSize(cur.text.length) }}
                >
                  {isM && "“"}
                  {hm ? (
                    <>
                      {cur.text.slice(0, at)}
                      <span className="text-amber underline decoration-1 underline-offset-[6px]">{hm[0]}</span>
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
            <div className="ss-in flex max-w-[1000px] flex-col gap-3">
              <span className={`${LABEL} text-red`}>
                {actionLabel(gate.type)} · {gate.type}
              </span>
              <div className="leading-[1.3] tracking-[-.01em] text-pretty" style={{ fontSize: "clamp(22px,2.4vw,32px)" }}>
                {gate.detail}
              </div>
              <span className="text-[13px]" style={{ color: DIM(60) }}>Enforced in code, not in the prompt.</span>
            </div>
          )}

          {mode === "bridge" && (
            <div className="ss-in flex flex-col gap-4">
              <div className="leading-[1.1] font-medium tracking-[-.02em] text-family" style={{ fontSize: "clamp(32px,4vw,48px)" }}>
                The agent leaves the line.
              </div>
              <div className="max-w-[760px] text-[18px] leading-[1.5]" style={{ color: DIM(75) }}>
                {F} and {contact} are talking privately. Not recorded. The hold stays until an analyst decides.
              </div>
            </div>
          )}
        </div>

        {/* right rail */}
        <div
          className="flex flex-col justify-center gap-3 border-t pt-5 md:w-[230px] md:flex-none md:self-stretch md:border-t-0 md:border-l md:pt-0 md:pl-6"
          style={{ borderColor: DIM(15) }}
        >
          <span className={LABEL} style={{ color: DIM(60) }}>Heard on the call</span>
          {flags.length ? (
            flags.map((f) => (
              <span key={f} className="ss-in text-[16px] leading-[1.35]">
                {f}
              </span>
            ))
          ) : (
            <span className="text-[15px]" style={{ color: DIM(55) }}>
              Nothing concerning yet.
            </span>
          )}
          <span className="mt-1 text-[13px] leading-normal" style={{ color: nextTone === "family" ? "var(--family)" : DIM(60) }}>
            {next}
          </span>
        </div>
      </div>

      {/* lanes */}
      <div className="flex flex-col gap-2.5">
        <Lane label={F} tone="green">
          <Waveform active={(k === "live" && call.speaking === "member") || k === "bridged"} tone="green" height={20} className="flex-1" />
        </Lane>
        <Lane label="Agent" tone="ink" className={`transition-opacity duration-700 ${k === "bridged" ? "opacity-35" : ""}`}>
          {k === "bridged" ? (
            <Gone tone="ink" note="left the line" />
          ) : (
            <Waveform active={k === "live" && call.speaking === "agent"} tone="ink" height={14} className="flex-1" />
          )}
        </Lane>
        <Lane label={contact} tone="family">
          {k === "bridged" ? (
            <Waveform active tone="family" height={20} className="flex-1" />
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
    <div className={`flex h-5 items-center gap-5 ${className}`}>
      <span className={`w-[110px] flex-none truncate ${LABEL}`} style={{ color: toneVar(tone) }}>
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
      <span aria-hidden className="flex-1 border-t border-dashed" style={{ borderColor: `color-mix(in oklch, ${c} ${faint ? 35 : 60}%, transparent)` }} />
      <span className="text-[13px]" style={{ color: c }}>
        {note}
      </span>
    </>
  );
}

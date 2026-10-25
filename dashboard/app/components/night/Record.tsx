"use client";

// 03 The record: actions + transcript merged by time. Auto-scrolls to the newest entry.
import { useEffect, useRef } from "react";
import { actionLabel, actionTone, firstName, toneVar, type Tone } from "../../lib/derive";
import { clock } from "../../lib/format";
import type { Action, CaseDetail, Line } from "../../lib/types";
import { SectionHead } from "./primitives";

const FAMILY = ["family_call", "family_bridge", "connect_family", "call_family"];
const BY: Record<string, string> = { agent: "Agent", human: "Analyst", gate: "Gate" };

type Item = { k: "a"; t: number; a: Action } | { k: "l"; t: number; l: Line };

const GUTTER = "grid grid-cols-[104px_minmax(0,1fr)] gap-[18px]";
const TIME = "font-mono text-[11.5px] text-muted";

function Said({ l, first }: { l: Line; first: string }) {
  const member = l.speaker === "member";
  return (
    <div className={`${GUTTER} py-3`}>
      <span className="flex flex-col gap-[5px] pt-1.5">
        <span className="font-mono text-[10.5px] leading-none font-bold tracking-[.18em] uppercase" style={{ color: member ? "var(--green)" : "var(--brand)" }}>
          {member ? first : l.speaker === "agent" ? "AGENT" : l.speaker}
        </span>
        <span className={TIME}>{clock(l.t)}</span>
      </span>
      {member ? (
        <p className="font-serif text-[23px] leading-[1.38] text-pretty italic" style={{ color: "color-mix(in oklch, var(--green) 40%, var(--ink))" }}>
          “{l.text}”
        </p>
      ) : (
        <p className="font-serif text-[21px] leading-[1.42] text-pretty">{l.text}</p>
      )}
    </div>
  );
}

function Logged({ a, first }: { a: Action; first: string }) {
  if (a.type === "deny" || a.type === "override")
    return (
      <div className="relative my-4 min-h-24 overflow-hidden border-y-2 border-red py-6 pr-[26px] pl-[158px]" style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--red) 20%, transparent), color-mix(in oklch, var(--red) 6%, transparent))" }}>
        <span aria-hidden className="absolute top-1/2 left-5 font-serif text-[104px] leading-none tracking-[-.05em] text-red italic" style={{ transform: "translateY(-52%) rotate(-6deg)" }}>
          No.
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span className="font-mono text-[12.5px] leading-[1.3] font-bold tracking-[.16em] text-red">{a.type === "deny" ? "PERMISSION GATE · deny" : "CODE FLOOR · override"}</span>
            <span className={TIME}>{clock(a.t)}</span>
          </div>
          <p className="font-serif text-[22px] leading-[1.3] text-pretty">{a.detail}</p>
          <p className="font-mono text-[10.5px] font-semibold tracking-[.16em] text-muted">ENFORCED IN CODE, NOT IN THE PROMPT.</p>
        </div>
      </div>
    );
  if (FAMILY.includes(a.type))
    return (
      <div className="my-2.5 flex flex-col gap-1.5 border-y border-family px-6 py-[18px]" style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--family) 16%, transparent), transparent 80%)" }}>
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
          <span className="font-mono text-[11.5px] leading-[1.3] font-bold tracking-[.16em] text-family uppercase">FAMILY · {a.type.replace(/_/g, " ")}</span>
          <span className={TIME}>{clock(a.t)}</span>
        </div>
        <p className="font-serif text-[23px] leading-[1.3] text-pretty italic">{a.detail}</p>
      </div>
    );
  const t = actionTone(a.type, a.by);
  const tone: Tone = t === "brand" ? "ink" : t; // ponytail: log rows keep brand for the speaker labels, ink otherwise (prototype)
  return (
    <div className={`${GUTTER} py-1.5`}>
      <span className={`${TIME} leading-[1.9]`}>{clock(a.t)}</span>
      <p className="text-[14.5px] text-pretty text-muted">
        <b className="mr-2.5 font-mono text-[10.5px] font-bold tracking-[.14em] uppercase" style={{ color: toneVar(tone) }}>{actionLabel(a.type)}</b>
        {a.by === "member" ? first : (BY[a.by] ?? a.by)} · <span className="text-ink">{a.detail}</span>
      </p>
    </div>
  );
}

/** `live` shows the LIVE TRANSCRIPT badge (pass deriveCall(...).state === "live"). */
export function RecordTimeline({ detail, live = false, className }: { detail: CaseDetail; live?: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const items: Item[] = [
    ...detail.actions.map((a) => ({ k: "a" as const, t: a.t, a })),
    ...detail.transcript.map((l) => ({ k: "l" as const, t: l.t, l })),
  ].sort((x, y) => x.t - y.t);
  const first = firstName(detail.member_name);
  const newest = items.length ? `${items.length}-${items[items.length - 1].t}` : "";

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [newest]);

  return (
    <section aria-label="The record" className={`flex flex-col ${className ?? ""}`}>
      <SectionHead
        num="03"
        title="The record"
        aside={live ? (
          <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[.18em] text-green">
            <span aria-hidden className="ss-blink size-[7px] rounded-full bg-green" />LIVE TRANSCRIPT
          </span>
        ) : undefined}
      />
      <div ref={box} className="flex max-h-[720px] flex-col overflow-y-auto pt-3 pb-1 motion-safe:scroll-smooth" aria-live={live ? "polite" : undefined}>
        {items.length === 0 && <p className="py-4 font-serif text-[20px] text-muted italic">Nothing has happened on this case yet.</p>}
        {items.map((it) => (
          <div key={it.k === "a" ? `a-${it.a._id}` : `l-${it.l._id}`} className="ss-in flex flex-col">
            {it.k === "l" ? <Said l={it.l} first={first} /> : <Logged a={it.a} first={first} />}
          </div>
        ))}
      </div>
    </section>
  );
}

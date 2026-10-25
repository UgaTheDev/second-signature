"use client";

// 03 The record: actions + transcript merged by time. Auto-scrolls to the newest entry.
import { useEffect, useRef } from "react";
import { actionLabel, actionTone, firstName, toneVar, type Tone } from "../../lib/derive";
import { clock } from "../../lib/format";
import type { Action, CaseDetail, Line } from "../../lib/types";
import { SectionHead } from "./primitives";

const BY: Record<string, string> = { agent: "Agent", human: "Analyst", gate: "Gate" };

type Item = { k: "a"; t: number; a: Action } | { k: "l"; t: number; l: Line };

const GUTTER = "grid grid-cols-[72px_minmax(0,1fr)] gap-4";
const TIME = "num font-mono text-[11px] text-muted";
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function Said({ l, first }: { l: Line; first: string }) {
  const member = l.speaker === "member";
  return (
    <div className={`${GUTTER} py-2.5`}>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className="text-[12px]" style={{ color: member ? "var(--green)" : "var(--muted)" }}>
          {member ? first : l.speaker === "agent" ? "Agent" : l.speaker}
        </span>
        <span className={TIME}>{clock(l.t)}</span>
      </span>
      {member ? (
        <p className="font-sans text-[15px] leading-relaxed text-pretty italic">“{l.text}”</p>
      ) : (
        <p className="text-[15px] leading-relaxed text-pretty">{l.text}</p>
      )}
    </div>
  );
}

function Logged({ a, first }: { a: Action; first: string }) {
  if (a.type === "deny" || a.type === "override")
    return (
      <div className="my-2 flex flex-col gap-1 border-l-[3px] border-red bg-red/8 py-3 pr-4 pl-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[12px] font-medium text-red">{a.type === "deny" ? "Permission gate · deny" : "Code floor · override"}</span>
          <span className={TIME}>{clock(a.t)}</span>
        </div>
        <p className="text-[14px] leading-normal text-pretty">{a.detail}</p>
        <p className="text-[11px] text-muted">Enforced in code, not in the prompt.</p>
      </div>
    );
  const t = actionTone(a.type, a.by);
  const tone: Tone = t === "brand" ? "muted" : t; // ponytail: brand reads as decoration in the calm palette; muted instead
  return (
    <div className={`${GUTTER} py-1`}>
      <span className={`${TIME} leading-[1.8]`}>{clock(a.t)}</span>
      <p className="text-[13px] text-pretty text-muted">
        <span className="mr-2 font-medium" style={{ color: toneVar(tone) }}>{sentence(actionLabel(a.type))}</span>
        {a.by === "member" ? first : (BY[a.by] ?? a.by)} · <span className="text-ink">{a.detail}</span>
      </p>
    </div>
  );
}

/** `live` shows the "Live transcript" badge (pass deriveCall(...).state === "live"). */
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
          <span className="flex items-center gap-1.5 text-[12px] text-green">
            <span aria-hidden className="size-1.5 rounded-full bg-green" />Live transcript
          </span>
        ) : undefined}
      />
      <div ref={box} className="flex max-h-[720px] flex-col overflow-y-auto pt-2 pb-1 motion-safe:scroll-smooth" aria-live={live ? "polite" : undefined}>
        {items.length === 0 && <p className="py-4 text-[14px] text-muted">Nothing has happened on this case yet.</p>}
        {items.map((it) => (
          <div key={it.k === "a" ? `a-${it.a._id}` : `l-${it.l._id}`} className="ss-in flex flex-col">
            {it.k === "l" ? <Said l={it.l} first={first} /> : <Logged a={it.a} first={first} />}
          </div>
        ))}
      </div>
    </section>
  );
}

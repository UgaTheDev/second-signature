// 4. Event ticker: the latest five tickerEvents, static, one line (overflow clipped).
import { tickerEvents, toneVar, type TickerEvent } from "../../lib/derive";
import type { Action, Case } from "../../lib/types";
import { Diamond } from "./primitives";

/** `actions` = whatever actions the page has (e.g. the selected case's detail); the case list carries none. */
export function Ticker({ cases, actions }: { cases?: Case[]; actions?: Action[] }) {
  const events = tickerEvents(cases, actions);
  const members = new Set((cases ?? []).map((c) => c.member_name)).size;
  const items: TickerEvent[] = events.length
    ? events
    : [{ id: "standby", t: 0, time: "", label: "STANDBY", tone: "brand", text: cases ? `Watching ${members} member${members === 1 ? "" : "s"}` : "Connecting…" }];

  const row = items.slice(0, 5).map((e) => (
    <span key={e.id} className="flex items-center gap-2.5 px-[22px] py-2.5 text-[14px] whitespace-nowrap">
      <Diamond tone={e.tone} />
      {e.time && <span className="font-mono text-[12px] text-muted">{e.time}</span>}
      <span className="font-mono text-[12px] font-semibold tracking-[.08em]" style={{ color: toneVar(e.tone) }}>{e.label}</span>
      <span>{e.text}</span>
    </span>
  ));

  return (
    <section
      aria-label="Recent events"
      className="relative overflow-hidden border-b border-line [mask-image:linear-gradient(90deg,#000_90%,transparent)]"
      style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--brand) 14%, var(--panel)), var(--panel), color-mix(in oklch, var(--amber) 10%, var(--panel)))" }}
    >
      <div className="flex">{row}</div>
    </section>
  );
}

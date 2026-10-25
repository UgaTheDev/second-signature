// 5. KPI band: five tiles from kpis(stats, cases). "—" while loading; MOVED BY THE AGENT is always $0.
import { kpis, toneVar } from "../../lib/derive";
import type { Case, Stats } from "../../lib/types";

export function KpiBand({ stats, cases }: { stats?: Stats; cases?: Case[] }) {
  return (
    <section aria-label="Tonight in numbers" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] border-b border-line">
      {kpis(stats, cases).map((k) => (
        <div key={k.label} className="flex flex-col gap-3 border-r border-line px-7 pt-6 pb-[26px]">
          <span className="flex items-center gap-2.5 font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">
            <span aria-hidden className="h-0.5 w-4" style={{ background: toneVar(k.tone) }} />
            {k.label}
          </span>
          <span className="num font-serif text-[clamp(34px,3.1vw,55px)] leading-[.85] tracking-[-.045em]" style={{ color: toneVar(k.valueTone) }}>{k.value}</span>
          <span className="text-[13.5px] text-pretty text-muted">{k.sub}</span>
        </div>
      ))}
    </section>
  );
}

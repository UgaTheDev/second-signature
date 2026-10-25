// 5. KPI band: five compact stats from kpis(stats, cases). "—" while loading; MOVED BY THE AGENT is always $0.
import { kpis, toneVar } from "../../lib/derive";
import type { Case, Stats } from "../../lib/types";
import { sentence } from "./primitives";

export function KpiBand({ stats, cases }: { stats?: Stats; cases?: Case[] }) {
  return (
    <section aria-label="Tonight in numbers" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-8 gap-y-5 border-b border-line px-8 py-6 max-sm:px-4">
      {kpis(stats, cases).map((k) => (
        <div key={k.label} className="flex flex-col gap-1">
          <span className="text-[12px] text-muted">{sentence(k.label)}</span>
          {/* Only holds (amber) and the $0 guarantee (green) get colour; everything else stays ink. */}
          <span className="num text-[28px] leading-none font-medium tracking-[-.02em]" style={{ color: k.valueTone === "amber" || k.valueTone === "green" ? toneVar(k.valueTone) : undefined }}>{k.value}</span>
          <span className="text-[12px] text-pretty text-muted">{k.sub}</span>
        </div>
      ))}
    </section>
  );
}

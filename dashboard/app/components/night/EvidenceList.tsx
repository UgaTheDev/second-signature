// 02 The evidence: one row per risk signal, in the order triage recorded them.
import { sourceLabel, toneVar, weightTone } from "../../lib/derive";
import type { Signal } from "../../lib/types";
import { SectionHead } from "./primitives";

export function EvidenceList({ signals, className }: { signals: Signal[]; className?: string }) {
  return (
    <section aria-label="The evidence" className={`flex flex-col ${className ?? ""}`}>
      <SectionHead num="02" title="The evidence" aside={<span className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">WEIGHT = PUSH TOWARD A HOLD</span>} />
      {signals.length === 0 && <p className="py-[18px] font-serif text-[20px] text-muted italic">Gathering signals…</p>}
      <ol>
        {signals.map((s, i) => {
          const w = Math.max(0, Math.min(1, s.weight));
          const c = toneVar(weightTone(w));
          return (
            <li key={`${s.source}-${i}`} className="ss-in grid grid-cols-[48px_minmax(0,1fr)_120px] items-start gap-[18px] border-b border-line py-[18px]">
              <span className="font-serif text-[30px] leading-none text-muted italic" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[10.5px] leading-none font-bold tracking-[.18em]" style={{ color: s.source === "shield" ? "var(--red)" : "var(--ink)" }}>
                  {sourceLabel(s.source)}
                </span>
                <span className="font-serif text-[20px] leading-[1.35] text-pretty">{s.fact}</span>
              </span>
              <span className="flex flex-col items-end gap-2">
                <span className="num font-serif text-[36px] leading-[.9] tracking-[-.03em]" style={{ color: c }}>
                  <span className="sr-only">weight </span>{w.toFixed(2)}
                </span>
                <span className="relative h-[3px] w-full bg-line" aria-hidden>
                  <span className="absolute inset-y-0 right-0" style={{ width: `${w * 100}%`, background: c }} />
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

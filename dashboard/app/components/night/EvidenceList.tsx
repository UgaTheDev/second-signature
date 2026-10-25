// 02 The evidence: one row per risk signal, in the order triage recorded them.
import { sourceLabel, toneVar, weightTone } from "../../lib/derive";
import type { Signal } from "../../lib/types";
import { SectionHead } from "./primitives";

// ponytail: sentence-case twin of SOURCE_LABEL (lib/derive is upper-case for other panels); falls back to it.
const LABEL: Record<string, string> = { shield: "Scam Shield", crs: "CRS", elastic: "History", apify: "FTC alert", nessie: "Nessie" };

export function EvidenceList({ signals, className }: { signals: Signal[]; className?: string }) {
  return (
    <section aria-label="The evidence" className={`flex flex-col ${className ?? ""}`}>
      <SectionHead title="The evidence" aside={<span className="text-[12px] text-muted">Weight = push toward a hold</span>} />
      {signals.length === 0 && <p className="py-4 text-[14px] text-muted">Gathering signals…</p>}
      <ol>
        {signals.map((s, i) => {
          const w = Math.max(0, Math.min(1, s.weight));
          const c = toneVar(weightTone(w));
          return (
            <li key={`${s.source}-${i}`} className="ss-in grid grid-cols-[minmax(0,1fr)_88px] items-start gap-5 border-b border-line py-3.5">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[12px]" style={{ color: s.source === "shield" ? "var(--red)" : "var(--muted)" }}>
                  {LABEL[s.source] ?? sourceLabel(s.source)}
                </span>
                <span className="text-[14px] leading-normal text-pretty">{s.fact}</span>
              </span>
              <span className="flex flex-col items-end gap-1.5 pt-0.5">
                <span className="num font-mono text-[12px] text-muted">
                  <span className="sr-only">weight </span>{w.toFixed(2)}
                </span>
                <span className="relative h-0.5 w-full bg-line" aria-hidden>
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

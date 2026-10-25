"use client";
// Left column, below the dossier: "01 Tonight's ledger", newest first.
import { statusMeta } from "../../lib/derive";
import { money, shortClock } from "../../lib/format";
import type { Case } from "../../lib/types";
import { Diamond, SectionHead, Stamp } from "./primitives";

export function Ledger({
  cases,
  selectedId,
  onSelect,
  fresh = null,
}: {
  cases: Case[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** id of the case that just arrived (page.tsx already tracks it); gets the ss-arrive flash. */
  fresh?: string | null;
}) {
  const open = cases?.filter((c) => c.status === "open" || c.status === "escalated").length ?? 0;
  return (
    <section aria-label="Tonight’s ledger">
      <div className="px-[26px] pt-[26px] pb-2">
        <SectionHead
          num="01"
          title="Tonight’s ledger"
          aside={
            <span className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted uppercase">
              {cases?.length ? `${cases.length} · ${open} open` : "0"}
            </span>
          }
        />
      </div>
      {!cases?.length ? (
        <div className="flex flex-col gap-1.5 px-[26px] pt-[30px] pb-10">
          <div className="font-serif text-[30px] text-muted italic">{cases ? "All quiet." : "Loading…"}</div>
          {cases && <div className="text-[15px] text-muted">No cases yet. Run a scenario.</div>}
        </div>
      ) : (
        <ol className="flex flex-col pb-[26px]">
          {cases.map((c, i) => {
            const on = c._id === selectedId;
            const m = statusMeta(c.status);
            return (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => onSelect(c._id)}
                  aria-current={on ? "true" : undefined}
                  className={`grid w-full cursor-pointer grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-l-[3px] border-b-line py-4 pr-[26px] pl-[23px] text-left transition-colors hover:bg-amber/6 ${
                    on ? "border-l-amber bg-linear-to-r from-amber/13 to-transparent" : "border-l-transparent"
                  } ${c._id === fresh ? "ss-arrive" : ""}`}
                >
                  <span className="num font-mono text-[11.5px] leading-[1.9] font-medium text-muted">
                    {String(cases.length - i).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="font-serif text-[20px] leading-[1.15]">{c.merchant}</span>
                    <span className="truncate text-[13px] text-muted">
                      {c.member_name} · {shortClock(c.opened_at)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2">
                    {c.amount > 0 && <span className="num font-mono text-[16px]">{money(c.amount)}</span>}
                    <span className="inline-flex items-center gap-1.5">
                      {m.pulse && <Diamond tone={m.tone} pulse size={6} />}
                      <Stamp status={c.status} size="sm" rotate={-4} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

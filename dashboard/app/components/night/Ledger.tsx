"use client";
// Left column, below the dossier: "01 Tonight's ledger", newest first.
import { money, shortClock } from "../../lib/format";
import type { Case } from "../../lib/types";
import { SectionHead, Stamp } from "./primitives";

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
      <div className="px-6 pt-6 pb-2">
        <SectionHead
          num="01"
          title="Tonight’s ledger"
          aside={<span className="text-[12px] text-muted">{cases?.length ? `${cases.length} · ${open} open` : "0"}</span>}
        />
      </div>
      {!cases?.length ? (
        <div className="flex flex-col gap-1 px-6 pt-6 pb-10">
          <div className="text-[15px] text-muted">{cases ? "All quiet." : "Loading…"}</div>
          {cases && <div className="text-[13px] text-muted">No cases yet. Run a scenario.</div>}
        </div>
      ) : (
        <ol className="flex flex-col pb-6">
          {cases.map((c) => {
            const on = c._id === selectedId;
            return (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => onSelect(c._id)}
                  aria-current={on ? "true" : undefined}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-l-2 border-b-line py-3 pr-6 pl-[22px] text-left transition-colors hover:bg-panel2/60 ${
                    on ? "border-l-amber bg-panel2" : "border-l-transparent"
                  } ${c._id === fresh ? "ss-arrive" : ""}`}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] leading-snug">{c.merchant}</span>
                    <span className="truncate text-[12px] text-muted">
                      {c.member_name} · <span className="num font-mono">{shortClock(c.opened_at)}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    {c.amount > 0 && <span className="num font-mono text-[13px]">{money(c.amount)}</span>}
                    <Stamp status={c.status} size="sm" />
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

"use client";

import { money, shortClock } from "../../lib/format";
import { groupByCustomer, isActiveCase } from "../../lib/ledger";
import type { Case } from "../../lib/types";
import { SectionHead, Stamp } from "./primitives";

export function Ledger({ cases, selectedId, onSelect, fresh = null, history = false }: {
  cases: Case[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  fresh?: string | null;
  history?: boolean;
}) {
  const groups = groupByCustomer(cases ?? []);
  const openHolds = cases?.filter((c) => isActiveCase(c) && c.category !== "scam_call").length;
  const title = history ? "Historical log" : "Active issues";
  return (
    <section aria-label={title}>
      <div className="px-6 pt-6 pb-4">
        <SectionHead num="01" title={title} />
        {!history && (
          <div className="mt-4 flex items-baseline gap-2" role="status">
            <span className={`num text-[28px] font-semibold leading-none ${openHolds ? "text-amber" : "text-ink"}`}>{openHolds ?? "—"}</span>
            <span className="text-[13px] text-muted">open hold{openHolds === 1 ? "" : "s"}</span>
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted">
          {cases ? `${groups.length} customer${groups.length === 1 ? "" : "s"} · ${cases.length} ${history ? "past case" : "active issue"}${cases.length === 1 ? "" : "s"}` : "Loading…"}
        </p>
      </div>
      {cases && !cases.length && (
        <p className="px-6 pt-2 pb-10 text-[14px] text-muted">
          {history ? "No historical cases yet." : "All clear. No customers need attention."}
        </p>
      )}
      <ul className="flex flex-col pb-6">
        {groups.map((group) => (
          <li key={group.key} className="border-b border-line">
            <div className="flex items-start justify-between gap-3 bg-panel/50 px-6 py-3">
              <h3 className="min-w-0 break-words text-[15px] font-semibold">{group.name}</h3>
              <span className="shrink-0 text-[12px] text-muted">{group.cases.length} {history ? "case" : "issue"}{group.cases.length === 1 ? "" : "s"}</span>
            </div>
            <ul aria-label={`${group.name} ${history ? "history" : "active issues"}`}>
              {group.cases.map((c) => {
                const on = c._id === selectedId;
                return (
                  <li key={c._id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c._id)}
                      aria-current={on ? "true" : undefined}
                      className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 py-3 pr-6 pl-8 text-left transition-colors hover:bg-panel2/60 ${on ? "border-l-amber bg-panel2" : "border-l-transparent"} ${c._id === fresh ? "ss-arrive" : ""}`}
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[14px] leading-snug">{c.merchant}</span>
                        <span className="text-[12px] text-muted">
                          {history && <>{new Date(c.opened_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · </>}
                          <span className="num">{shortClock(c.opened_at)}</span>
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {c.amount > 0 && <span className="num text-[13px]">{money(c.amount)}</span>}
                        <Stamp status={c.status} size="sm" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

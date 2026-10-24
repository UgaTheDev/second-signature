"use client";

import { PhoneIncoming } from "lucide-react";
import { isShieldCase, money, shortClock, STATUS_LABEL } from "../lib/format";
import type { Case, Status } from "../lib/types";

const DOT: Record<Status, string> = {
  allowed: "bg-ink-3",
  open: "bg-accent",
  released: "bg-ok",
  escalated: "bg-accent",
  confirmed_fraud: "bg-danger",
};

export function StatusMark({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden />
      {STATUS_LABEL[status].label}
    </span>
  );
}

export function CaseQueue({
  cases,
  selected,
  onSelect,
  fresh,
}: {
  cases: Case[] | undefined;
  selected: string | null;
  onSelect: (id: string) => void;
  fresh: string | null;
}) {
  return (
    <section aria-label="Cases">
      <h2 className="mb-2 font-display text-lg font-semibold">Cases</h2>
      {cases === undefined ? (
        <p className="text-ink-2">Loading cases…</p>
      ) : cases.length === 0 ? (
        <p className="max-w-[28ch] text-ink-2">Nothing yet. Use “Run a scenario” to send a test purchase.</p>
      ) : (
        <ul className="border-t border-line">
          {cases.map((c) => {
            const active = c._id === selected;
            return (
              <li key={c._id} className="border-b border-line">
                <button
                  onClick={() => onSelect(c._id)}
                  aria-current={active ? "true" : undefined}
                  className={`block w-full border-l-2 py-3 pl-4 pr-2 text-left hover:bg-raise ${
                    active ? "border-accent bg-raise" : "border-transparent"
                  } ${c._id === fresh ? "arrive" : ""}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      {isShieldCase(c) && <PhoneIncoming size={15} strokeWidth={1.75} className="shrink-0 text-accent" aria-label="Phone call" />}
                      <span className="truncate">{c.merchant}</span>
                    </span>
                    {c.amount > 0 && <span className="num shrink-0 font-mono text-[15px]">{money(c.amount)}</span>}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-3 text-sm text-ink-2">
                    <span className="truncate">{c.member_name.split(" ")[0]} · {shortClock(c.opened_at)}</span>
                    <StatusMark status={c.status} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useStats } from "../lib/data";

export function StatsStrip() {
  const s = useStats();
  if (!s) return <div className="h-20" aria-hidden />;
  const items: [string, string, string][] = [
    [String(s.total), "checked", `${s.allowed} let through`],
    [String(s.held), "held", `${s.heldByRule} by the code floor`],
    [String(s.released), "released", `${s.memberReleases} by the member after verifying`],
    [String(s.escalated + s.open), "waiting on a person", `${s.escalated} with an analyst`],
    [String(s.confirmedFraud), "fraud confirmed", "payments that stayed stopped"],
    [String(s.gateDenials), "refused by the gate", "things the agent or a caller wasn't allowed to do"],
    [s.medianMinutesToResolve === null ? "–" : `${s.medianMinutesToResolve.toFixed(1)} min`, "median to decide", "from hold to release or fraud"],
  ];
  return (
    <dl className="mx-auto grid max-w-[1560px] grid-cols-2 gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-4 xl:grid-cols-7">
      {items.map(([value, label, sub]) => (
        <div key={label} title={sub} className="flex flex-col">
          <dt className="order-2 text-sm text-ink-2">{label}</dt>
          <dd className="font-display num text-3xl font-semibold leading-none">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

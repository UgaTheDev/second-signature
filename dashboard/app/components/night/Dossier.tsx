// Left column, top: the member dossier for the selected case's member.
import type { Case } from "../../lib/types";
import { Kicker } from "./primitives";

import { MEMBER_PROFILES } from "../../lib/profiles";

export function Dossier({ cases, selectedId }: { cases: Case[] | undefined; selectedId: string | null }) {
  const c = cases?.find((x) => x._id === selectedId) ?? cases?.[0];
  if (!c) return null;
  const name = c.member_name;
  const p = MEMBER_PROFILES[name];
  return (
    <div className="flex flex-col gap-5 border-b border-line px-6 pt-7 pb-6">
      <div className="flex flex-col gap-1">
        <Kicker>The member</Kicker>
        <div className="mt-1 text-[20px] leading-tight font-medium">
          {name}
          {p && <span className="font-normal text-muted">, {p.age}</span>}
        </div>
        <div className="text-[13px] text-muted">{p ? p.sub : "No profile on file"}</div>
      </div>
      {p && (
        <>
          <dl className="flex flex-col text-[14px]">
            <div className="flex items-baseline justify-between gap-4 border-y border-line py-2">
              <dt className="text-[12px] text-muted">Scam Shield</dt>
              <dd className={p.shield ? "text-green" : "text-muted"}>{p.shield ? "On" : "Off"}</dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-muted">Normal spending</span>
            <ul className="flex flex-wrap gap-1.5">
              {p.pattern.map((s) => (
                <li key={s} className="rounded-[6px] border border-line px-2 py-0.5 text-[12px] text-muted">
                  {s}
                </li>
              ))}
            </ul>
            <p className="text-[13px] leading-normal text-pretty text-muted">{p.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

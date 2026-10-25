// Left column, top: the member dossier for the selected case's member.
import { initials } from "../../lib/derive";
import type { Case } from "../../lib/types";
import { DottedRow, Kicker, OutlinedNumber } from "./primitives";

type Profile = { age: number; sub: string; contact: string | null; shield: boolean; pattern: string[]; note: string };

// ponytail: copied by hand from server/members.py (age, family, shield_env, notes) and server/policy.md
// (normal spending). Keyed by member_name because Case has no member_id. Add a query if members grow past two.
const MEMBER_PROFILES: Record<string, Profile> = {
  "Dolores Whitcomb": {
    age: 74,
    sub: "Member since 1991 · Santa Barbara · lives alone",
    contact: "Susan · daughter",
    shield: true,
    pattern: ["Groceries", "Pharmacy", "Utilities", "Church", "Café"],
    note: "Never gift cards, electronics or wires. Grandson Leo’s birthday is Oct 26.",
  },
  "Robert Chen": {
    age: 71,
    sub: "Member",
    contact: null,
    shield: false,
    pattern: ["Groceries", "Gift cards for grandkids, $50–100"],
    note: "Buys gift cards every Christmas and birthday.",
  },
};

export function Dossier({ cases, selectedId }: { cases: Case[] | undefined; selectedId: string | null }) {
  const c = cases?.find((x) => x._id === selectedId) ?? cases?.[0];
  if (!c) return null;
  const name = c.member_name;
  const p = MEMBER_PROFILES[name];
  return (
    <div className="relative isolate flex flex-col gap-4 overflow-hidden border-b border-line px-[26px] pt-[30px] pb-[26px]">
      <OutlinedNumber
        value={initials(name)}
        size={200}
        stroke={1.2}
        italic
        className="pointer-events-none absolute -top-5 -right-3.5 -z-10 opacity-50 select-none"
      />
      <Kicker>The member</Kicker>
      <div className="flex flex-col gap-1.5">
        <div className="font-serif text-[36px] leading-[.95] tracking-[-.025em]">
          {name}
          {p && <span className="text-muted">, {p.age}</span>}
        </div>
        <div className="text-[14px] text-muted">{p ? p.sub : "No profile on file"}</div>
      </div>
      {p && (
        <>
          <div className="flex flex-col">
            <DottedRow
              className="border-t border-line py-2"
              label="Trusted contact"
              tone={p.contact ? "family" : "muted"}
              value={<span className="font-serif text-[18px] italic">{p.contact ?? "Not on file"}</span>}
            />
            <DottedRow
              className="border-y border-line py-2"
              label="Scam Shield"
              tone={p.shield ? "green" : "muted"}
              value={<span className="font-mono text-[12px] font-semibold tracking-[.14em]">{p.shield ? "ON" : "OFF"}</span>}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <Kicker>Normal spending</Kicker>
            <ul className="flex flex-wrap gap-1.5">
              {p.pattern.map((s) => (
                <li key={s} className="border border-line px-[9px] py-1 font-mono text-[12px] font-medium tracking-[.04em]">
                  {s}
                </li>
              ))}
            </ul>
            <p className="font-serif text-[17px] leading-[1.35] text-pretty text-muted italic">{p.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

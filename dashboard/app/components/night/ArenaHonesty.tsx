"use client";
// 08 Red-team arena (live from useArena) + 09 Honesty (REAL / SIMULATED from derive).
import { useArena } from "../../lib/data";
import { REAL, SIMULATED } from "../../lib/derive";
import { words } from "../../lib/format";
import type { ArenaRow } from "../../lib/types";
import { Kicker, OutlinedNumber } from "./primitives";

// A scenario passes only if every run passed and none was critical (server/arena.py grades each run).
const passes = (r: ArenaRow) => r.passed === r.runs && r.critical === 0;

function Num({ n, children, id }: { n: string; children: string; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-5 items-baseline gap-3.5">
      <span className="font-serif text-[40px] leading-[.8] text-amber italic" aria-hidden>{n}</span>
      <h2 className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">{children}</h2>
    </div>
  );
}

export function Arena({ id = "arena" }: { id?: string }) {
  const a = useArena();
  const run = a?.calls;
  const rows = run?.rows ?? [];
  const ok = rows.filter(passes).length;
  const critical = rows.reduce((s, r) => s + r.critical, 0);
  const tone = rows.length && ok === rows.length && !critical ? "green" : "red";

  return (
    <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[18px] border-line px-4 py-12 sm:px-9 min-[960px]:border-r">
      <Num n="08" id={id}>RED-TEAM ARENA · CLAUDE PLAYS THE SCAMMER</Num>
      {a === undefined ? (
        <Kicker>Loading arena results…</Kicker>
      ) : !run ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-[15px] text-muted">
          <span className="font-serif text-[26px] text-ink italic">No run published yet.</span>
          <span>
            Run <code className="font-mono text-[13px] text-ink">uv run python arena.py -n 3 --publish</code> in <code className="font-mono text-[13px]">server/</code>.
          </span>
          {a?.shield && <span>{a.shield.summary}</span>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-[22px]">
            <OutlinedNumber value={`${ok}/${rows.length}`} tone={tone} size="clamp(100px,10vw,170px)" className="num" />
            <span className="flex flex-col gap-1 pb-2">
              <span className="font-serif text-[26px] leading-none">passed.</span>
              <span className={`font-serif text-[22px] italic ${critical ? "text-red" : "text-green"}`}>{critical} critical.</span>
            </span>
          </div>
          <div className="text-[14px] text-muted">
            Critical = a scam released or an impostor verified. Graded deterministically. {run.summary} Run {new Date(run.t).toLocaleString()}.
          </div>
          {a.shield && <div className="text-[14px] text-muted">{a.shield.summary}</div>}
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-7 border-t border-line">
            {rows.map((r) => {
              const p = passes(r);
              return (
                <li key={r.scenario} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-[11px]" title={r.misses || undefined}>
                  <span className={`font-mono text-[10.5px] font-bold tracking-[.14em] ${p ? "text-green" : "text-red"}`}>{p ? "PASS" : "FAIL"}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-[13.5px] break-words">{r.scenario}</span>
                    <span className="font-serif text-[16px] text-muted italic">
                      {r.passed} of {r.runs} runs{r.critical ? `, ${r.critical} critical` : ""}{r.misses ? `: ${r.misses}` : ""}
                    </span>
                  </span>
                  <span className="font-mono text-[10.5px] font-medium tracking-[.12em] text-muted uppercase">{words(r.kind)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function Honesty({ id = "honesty" }: { id?: string }) {
  return (
    <div className="grid min-w-0 flex-[1_1_440px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] content-start gap-x-10 gap-y-7 px-4 py-12 sm:px-9">
      <div className="col-span-full"><Num n="09" id={id}>HONESTY · WHAT’S REAL</Num></div>
      <div className="flex flex-col">
        <span className="pb-3.5 font-serif text-[56px] leading-[.9] tracking-[-.04em]">Real.</span>
        <ul>{REAL.map((t) => <li key={t} className="border-t border-line py-3 font-serif text-[19px] leading-[1.35] text-pretty">{t}</li>)}</ul>
      </div>
      <div className="flex flex-col">
        <span className="pb-3.5 font-serif text-[56px] leading-[.9] tracking-[-.04em] text-muted italic">Simulated.</span>
        <ul>{SIMULATED.map((t) => <li key={t} className="border-t border-line py-3 font-serif text-[19px] leading-[1.35] text-pretty text-muted italic">{t}</li>)}</ul>
      </div>
    </div>
  );
}

/** 08 + 09 side by side (wraps under ~960px). */
export function ArenaHonesty() {
  return (
    <section aria-label="Red-team arena and honesty" className="flex flex-wrap border-t border-line">
      <Arena />
      <Honesty />
    </section>
  );
}

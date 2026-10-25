"use client";
// Red-team arena (live from useArena) + Honesty (REAL / SIMULATED from derive).
import { useArena } from "../../lib/data";
import { REAL, SIMULATED } from "../../lib/derive";
import { words } from "../../lib/format";
import type { ArenaRow } from "../../lib/types";

// A scenario passes only if every run passed and none was critical (server/arena.py grades each run).
const passes = (r: ArenaRow) => r.passed === r.runs && r.critical === 0;

function Num({ children, id }: { children: string; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-5 items-baseline gap-2.5">
      <h2 className="font-sans text-[20px] leading-[1.3] font-semibold">{children}</h2>
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
    <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4 border-line px-4 py-12 sm:px-9 min-[960px]:border-r">
      <Num id={id}>Red-team arena</Num>
      <span className="-mt-2 text-[13px] text-muted">Claude plays the scammer.</span>
      {a === undefined ? (
        <span className="text-[13px] text-muted">Loading arena results…</span>
      ) : !run ? (
        <div className="flex flex-col gap-2 border-t border-line pt-4 text-[14px] text-muted">
          <span className="text-[15px] text-ink">No run published yet.</span>
          <span>
            Run <code className="font-mono text-[12.5px] text-ink">uv run python arena.py -n 3 --publish</code> in <code className="font-mono text-[12.5px]">server/</code>.
          </span>
          {a?.shield && <span>{a.shield.summary}</span>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 text-[15px] text-muted">
            <span className={`num text-[28px] leading-none font-medium ${tone === "green" ? "text-green" : "text-red"}`}>
              {ok}/{rows.length}
            </span>
            passed · <span className={critical ? "text-red" : undefined}>{critical} critical</span>
          </div>
          <div className="text-[13px] leading-[1.5] text-muted">
            Critical = a scam released or an impostor verified. Graded deterministically. {run.summary} Run {new Date(run.t).toLocaleString()}.
          </div>
          {a.shield && <div className="text-[13px] leading-[1.5] text-muted">{a.shield.summary}</div>}
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-x-7 border-t border-line">
            {rows.map((r) => {
              const p = passes(r);
              return (
                <li key={r.scenario} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5" title={r.misses || undefined}>
                  <span className={`text-[12px] ${p ? "text-green" : "text-red"}`}>{p ? "Pass" : "Fail"}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-[12.5px] break-words">{r.scenario}</span>
                    <span className="text-[13px] text-muted">
                      {r.passed} of {r.runs} runs{r.critical ? `, ${r.critical} critical` : ""}{r.misses ? `: ${r.misses}` : ""}
                    </span>
                  </span>
                  <span className="text-[12px] text-muted">{words(r.kind)}</span>
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
    <div className="grid min-w-0 flex-[1_1_440px] grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] content-start gap-x-10 gap-y-5 px-4 py-12 sm:px-9">
      <div className="col-span-full"><Num id={id}>Honesty: what’s real</Num></div>
      <div className="flex flex-col">
        <span className="pb-2 text-[13px] font-medium text-ink">Real</span>
        <ul>{REAL.map((t) => <li key={t} className="border-t border-line py-2.5 text-[14px] leading-[1.45] text-pretty">{t}</li>)}</ul>
      </div>
      <div className="flex flex-col">
        <span className="pb-2 text-[13px] font-medium text-muted">Simulated</span>
        <ul>{SIMULATED.map((t) => <li key={t} className="border-t border-line py-2.5 text-[14px] leading-[1.45] text-pretty text-muted">{t}</li>)}</ul>
      </div>
    </div>
  );
}

/** Arena + Honesty side by side (wraps under ~960px). */
export function ArenaHonesty() {
  return (
    <section aria-label="Red-team arena and honesty" className="flex flex-wrap border-t border-line">
      <Arena />
      <Honesty />
    </section>
  );
}

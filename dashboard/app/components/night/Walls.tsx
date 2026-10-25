// 07 The walls: full-bleed permission matrix. Static content from derive.MATRIX (enforced in server/gate.py). No hooks.
import { MATRIX, type MatrixCell } from "../../lib/derive";

const COLS = ["Agent alone", "Needs her yes", "Needs an analyst"] as const;

function Cell({ c }: { c: MatrixCell }) {
  const note = c.note && c.kind !== "never" ? <span className="text-[13px] leading-[1.35] text-muted">{c.note}</span> : null;
  const mark =
    c.kind === "yes" ? <span className="text-green">✓<span className="sr-only">Yes</span></span>
    : c.kind === "if" ? <span className="text-amber">Only if</span>
    : c.kind === "never" ? <span className="inline-block -rotate-[4deg] bg-red px-3 py-[5px] text-on-red">NEVER</span>
    : <span className="text-muted" aria-label="No">–</span>;
  return (
    <td className="px-2 py-3.5 align-middle">
      <span className="flex flex-col items-start gap-[3px]">
        <span className="font-mono text-[15px] leading-[1.4] font-bold tracking-[.08em]">{mark}</span>
        {note}
      </span>
    </td>
  );
}

export function Walls({ id = "matrix" }: { id?: string }) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="relative isolate overflow-hidden border-t border-line px-4 pt-16 pb-14 sm:px-9"
      style={{ background: "radial-gradient(60% 80% at 100% 0%, color-mix(in oklch, var(--red) 16%, transparent), transparent 70%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[90px] -right-10 -z-10 font-serif leading-none tracking-[-.06em] text-transparent italic select-none"
        style={{ fontSize: "clamp(260px,30vw,480px)", WebkitTextStroke: "1.5px color-mix(in oklch, var(--red) 40%, transparent)" }}
      >
        never
      </div>
      <div className="flex max-w-[1400px] flex-col gap-[30px]">
        <div id={id} className="flex scroll-mt-5 flex-col gap-4">
          <span className="flex items-baseline gap-3.5">
            <span className="font-serif text-[40px] leading-[.8] text-amber italic" aria-hidden>07</span>
            <span className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">THE WALLS · PERMISSION MATRIX</span>
          </span>
          <h2 id={`${id}-title`} className="max-w-[1000px] font-serif leading-[.9] font-normal tracking-[-.04em] text-balance" style={{ fontSize: "clamp(52px,6vw,104px)" }}>
            It can <em className="text-red">never</em> move money on its own.
          </h2>
          <span className="-rotate-2 self-start border-2 border-red px-3.5 py-2 font-mono text-[12.5px] font-bold tracking-[.14em] text-red outline-1 outline-offset-[3px] outline-red outline-solid">
            ENFORCED IN CODE, NOT IN THE PROMPT.
          </span>
        </div>
        {/* ponytail: native table + overflow-x instead of the prototype's div grid; scrolls under 760px */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Permission matrix (scrolls sideways)">
          <table className="w-full min-w-[760px] border-collapse border-t-2 border-ink text-left">
            <colgroup>
              <col className="w-[38%]" />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted uppercase">
                <th scope="col" className="py-3.5 pr-2 font-semibold">Action</th>
                {COLS.map((c) => <th key={c} scope="col" className="px-2 py-3.5 font-semibold">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr
                  key={r.action}
                  className="border-t border-line"
                  style={r.money ? { background: "linear-gradient(90deg, color-mix(in oklch, var(--red) 14%, transparent), transparent)" } : undefined}
                >
                  <th scope="row" className={`py-3.5 pr-2 font-serif text-[20px] leading-[1.25] text-pretty ${r.money ? "font-semibold" : "font-normal"}`}>
                    {r.action}
                  </th>
                  <Cell c={r.agent} />
                  <Cell c={r.member} />
                  <Cell c={r.analyst} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-3.5 text-[15px] text-muted">
          <span><b className="mr-2 font-mono text-[11.5px] font-bold tracking-[.14em] text-red">PERMISSION GATE</b>refuses what someone tried: the AI, a caller, a prompt injection.</span>
          <span><b className="mr-2 font-mono text-[11.5px] font-bold tracking-[.14em] text-red">CODE FLOOR</b>holds what the AI would have allowed.</span>
          <span className="font-mono text-[12.5px]">server/gate.py</span>
        </div>
      </div>
    </section>
  );
}

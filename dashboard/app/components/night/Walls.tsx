// The walls: permission matrix. Static content from derive.MATRIX (enforced in server/gate.py). No hooks.
import { MATRIX, type MatrixCell } from "../../lib/derive";
import { Stamp } from "./primitives";

const COLS = ["Agent alone", "Needs her yes", "Needs staff"] as const;

function Cell({ c }: { c: MatrixCell }) {
  const note = c.note && c.kind !== "never" ? <span className="text-[13px] leading-[1.4] text-muted">{c.note}</span> : null;
  const mark =
    c.kind === "yes" ? <span className="text-green">✓<span className="sr-only">Yes</span></span>
    : c.kind === "if" ? <span className="text-amber">Only if</span>
    : c.kind === "never" ? <Stamp label="Never" tone="red" size="sm" rotate={0} />
    : <span className="text-muted" aria-label="No">✕</span>;
  return (
    <td className="px-3 py-3 align-top">
      <span className="flex flex-col items-start gap-1">
        <span className="text-[14px] leading-[1.4]">{mark}</span>
        {note}
      </span>
    </td>
  );
}

export function Walls({ id = "matrix" }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="border-t border-line px-4 py-12 sm:px-9">
      <div className="flex max-w-[1100px] flex-col gap-6">
        <div id={id} className="flex scroll-mt-5 flex-col gap-1.5">
          <span className="text-[13px] text-muted">The walls · permission matrix</span>
          <h2 id={`${id}-title`} className="font-sans text-[20px] leading-[1.3] font-semibold text-balance">
            It can <em className="text-red">never</em> move money on its own.
          </h2>
          <span className="text-[13px] text-muted">Enforced in code, not in the prompt.</span>
        </div>
        {/* ponytail: native table + overflow-x instead of the prototype's div grid; scrolls under 760px */}
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Permission matrix (scrolls sideways)">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <colgroup>
              <col className="w-[40%]" />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-[12px] text-muted">
                <th scope="col" className="py-2.5 pr-3 font-normal">Action</th>
                {COLS.map((c) => <th key={c} scope="col" className="px-3 py-2.5 font-normal">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr key={r.action} className="border-b border-line">
                  <th scope="row" className={`py-3 pr-3 align-top text-[14px] leading-[1.4] text-pretty ${r.money ? "font-semibold" : "font-normal"}`}>
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
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-muted">
          <span><span className="text-ink">Permission gate</span> refuses what someone tried: the AI, a caller, a prompt injection.</span>
          <span><span className="text-ink">Code floor</span> holds what the AI would have allowed.</span>
          <span className="font-mono text-[12px]">server/gate.py</span>
        </div>
      </div>
    </section>
  );
}

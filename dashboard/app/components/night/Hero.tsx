// 3. Hero banner: one static wash on --term, live headline, initials portrait in a thin ring.
import { deriveCall, familyName, heroHeadline, initials, isShield, shieldInfo, toneVar } from "../../lib/derive";
import type { Case, CaseDetail } from "../../lib/types";
import { Stamp } from "./primitives";

/**
 * `c`: the selected case from the list (instant). `detail`: its useCaseDetail result (call state, family name).
 * `now` must tick (≥ every few seconds) so "just arrived" and the call timeouts roll over.
 */
export function Hero({ c, detail, cases, now }: { c?: Case | null; detail?: CaseDetail | null; cases?: Case[]; now: number }) {
  const kase = detail ?? c ?? null;
  const call = deriveCall(detail, now);
  const h = heroHeadline(kase, call, familyName(detail?.actions ?? []), now);
  const tone = toneVar(h.tone);
  const name = kase?.member_name ?? "";
  const shieldOn = !!kase && (cases ?? []).some((x) => isShield(x) && x.member_name === name && shieldInfo(x).armedUntil > now);

  return (
    <section aria-label="Now" className="relative isolate overflow-hidden border-b border-line bg-term">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "radial-gradient(60% 90% at 85% 30%, color-mix(in oklch, var(--brand) 16%, transparent), transparent 70%)" }}
      />

      <div className="relative z-[3] flex min-h-[300px] flex-wrap items-center justify-between gap-7 px-11 py-8 text-term-ink max-sm:px-4">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-2 border px-3 py-[5px] font-mono text-[12px] leading-[1.2] font-semibold tracking-[.14em]"
              style={{ color: tone, borderColor: tone, background: `color-mix(in oklch, ${tone} 22%, transparent)` }}
            >
              <span aria-hidden className="size-[7px] rounded-full" style={{ background: tone }} />
              {h.kicker}
            </span>
            <span className="font-mono text-[12px] leading-none font-medium tracking-[.14em] text-term-ink/70">BAYVIEW COMMUNITY CU · AFTER HOURS{shieldOn && " · SCAM SHIELD ON"}</span>
          </div>
          <h1 aria-live="polite" className="font-serif text-[clamp(40px,4.6vw,72px)] leading-[.92] font-normal tracking-[-.035em] text-balance">
            {h.a} <em style={{ color: tone }}>{h.b}</em>
          </h1>
          <p className="max-w-[640px] text-[18px] leading-[1.45] text-pretty text-term-ink/85">{h.sub}</p>
        </div>

        <div className="relative size-[180px] flex-none">
          <div className="grid size-full place-items-center rounded-full border border-term-ink/30">
            <span className="font-serif text-[72px] leading-none tracking-[-.04em] text-term-ink italic" aria-hidden>
              {kase ? initials(name) : "SS"}
            </span>
          </div>
          <Stamp key={h.stamp} label={h.stamp} tone={h.tone} size="md" rotate={-10} pop className="absolute -right-6 bottom-2 bg-term/70" />
        </div>
      </div>
    </section>
  );
}

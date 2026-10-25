// 3. Hero banner: night wash on --term, glowing signature stroke, live headline, initials portrait in a conic ring.
import { deriveCall, familyName, heroHeadline, initials, isShield, shieldInfo, toneVar } from "../../lib/derive";
import type { Case, CaseDetail } from "../../lib/types";
import { SignatureStroke, Stamp } from "./primitives";

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
  const ring = (kase ? `${name} · ${shieldOn ? "SCAM SHIELD ON" : "MEMBER"} · PROTECTED · ` : "BAYVIEW COMMUNITY CU · AFTER HOURS · WATCHING · ").toUpperCase();

  return (
    <section aria-label="Now" className="relative isolate min-h-[460px] overflow-hidden border-b border-line bg-term">
      {/* No photography: a drifting night wash stands in for the image layer. */}
      <div
        aria-hidden
        className="ss-drift absolute inset-0 z-0"
        style={{ background: "radial-gradient(70% 60% at 70% 20%, color-mix(in oklch, var(--brand2) 22%, transparent), transparent 70%), radial-gradient(50% 50% at 20% 90%, color-mix(in oklch, var(--family) 14%, transparent), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: "linear-gradient(100deg, var(--term) 18%, color-mix(in oklch, var(--term) 70%, transparent) 48%, transparent 82%), radial-gradient(60% 90% at 85% 30%, color-mix(in oklch, var(--brand) 38%, transparent), transparent 70%)" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] mix-blend-color" style={{ background: "color-mix(in oklch, var(--brand) 45%, transparent)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: "repeating-linear-gradient(0deg, oklch(1 0 0 / .035) 0 1px, transparent 1px 4px)" }} />
      <SignatureStroke key={kase?._id ?? "none"} variant="hero" glow className="pointer-events-none absolute top-[46%] -left-[2%] z-[2] h-[240px] w-[104%]" />

      <div className="relative z-[3] flex min-h-[440px] flex-wrap items-center justify-between gap-7 px-11 pt-10 pb-14 text-term-ink max-sm:px-4">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-[18px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-2 border px-3 py-[5px] font-mono text-[12px] leading-[1.2] font-semibold tracking-[.14em]"
              style={{ color: tone, borderColor: tone, background: `color-mix(in oklch, ${tone} 22%, transparent)` }}
            >
              <span aria-hidden className="ss-blink size-[7px] rounded-full" style={{ background: tone }} />
              {h.kicker}
            </span>
            <span className="font-mono text-[12px] leading-none font-medium tracking-[.14em] text-term-ink/70">BAYVIEW COMMUNITY CU · AFTER HOURS</span>
          </div>
          <h1 aria-live="polite" className="font-serif text-[clamp(52px,6.4vw,104px)] leading-[.92] font-normal tracking-[-.035em] text-balance">
            {h.a} <em style={{ color: tone }}>{h.b}</em>
          </h1>
          <p className="max-w-[640px] text-[20px] leading-[1.45] text-pretty text-term-ink/85">{h.sub}</p>
        </div>

        <div className="relative size-[250px] flex-none">
          <svg viewBox="0 0 200 200" aria-hidden className="ss-spin absolute -inset-[26px] size-[302px]">
            <defs>
              <path id="ss-hero-ring" d="M100,100 m-90,0 a90,90 0 1,1 180,0 a90,90 0 1,1 -180,0" />
            </defs>
            <text fill="var(--term-ink)" fillOpacity={0.8} className="font-mono" style={{ fontSize: 8.4, fontWeight: 600, letterSpacing: 3.1 }}>
              <textPath href="#ss-hero-ring" textLength={560} lengthAdjust="spacing">{ring}</textPath>
            </text>
          </svg>
          <div
            className="absolute inset-0 rounded-full p-1.5"
            style={{ background: "conic-gradient(from 200deg, var(--amber), var(--family), var(--brand), var(--brand2), var(--amber))" }}
          >
            <div className="grid size-full place-items-center overflow-hidden rounded-full bg-term">
              <span className="font-serif text-[104px] leading-none tracking-[-.04em] text-term-ink italic" aria-hidden>
                {kase ? initials(name) : "SS"}
              </span>
            </div>
          </div>
          <Stamp key={h.stamp} label={h.stamp} tone={h.tone} size="md" rotate={-10} pop className="absolute -right-3.5 bottom-[18px] bg-term/70" />
        </div>
      </div>
    </section>
  );
}

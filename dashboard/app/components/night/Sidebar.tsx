// 1. Sidebar: wordmark + signature stroke, anchor nav with real counts, the promise, analyst chip.
import { MATRIX, PRESETS, isShield, shieldInfo, toneVar, type Tone } from "../../lib/derive";
import type { Arena, Case, Review } from "../../lib/types";
import { SignatureStroke } from "./primitives";

type NavRow = { label: string; href: string; count: string; tone: Tone; hot?: boolean };

/** Anchors expected on the page: #cases #shield #scenario #review #matrix #arena. */
export function Sidebar({
  cases, review, arena, now, active = "#cases",
}: { cases?: Case[]; review?: Review | null; arena?: Arena; now: number; active?: string }) {
  const armed = (cases ?? []).some((c) => isShield(c) && shieldInfo(c).armedUntil > now);
  const rows = arena?.calls?.rows ?? [];
  const nav = ([
    { label: "Cases", href: "#cases", count: cases ? String(cases.length) : "—", tone: "brand" },
    { label: "Scam Shield", href: "#shield", count: armed ? "ARMED" : "—", tone: "red" },
    { label: "Judge scenario", href: "#scenario", count: String(PRESETS.length), tone: "muted" },
    { label: "Morning review", href: "#review", count: review?.status === "proposed" ? "1" : "—", tone: "green" },
    { label: "Permission matrix", href: "#matrix", count: String(MATRIX.length), tone: "red" },
    { label: "Red-team arena", href: "#arena", count: rows.length ? `${rows.filter((r) => r.passed === r.runs).length}/${rows.length}` : "—", tone: "family" },
  ] satisfies NavRow[]).map((r) => ({ ...r, hot: r.href === active }));

  return (
    <nav
      aria-label="Sections"
      className="sticky top-0 flex h-screen flex-[0_0_220px] flex-col gap-[30px] border-r border-line px-[22px] py-7 max-lg:hidden"
      style={{ background: "color-mix(in oklch, var(--bg) 88%, transparent)" }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-serif text-[32px] leading-[.92] tracking-[-.02em] italic">Second<br />Signature</span>
        <SignatureStroke variant="mark" className="mt-0.5 mb-2 h-4 w-[150px]" />
        <span className="font-mono text-[11px] leading-none font-semibold tracking-[.18em] text-muted">BAYVIEW COMMUNITY CU</span>
      </div>
      <ul className="flex flex-col">
        {nav.map((n, i) => (
          <li key={n.href}>
            <a
              href={n.href}
              aria-current={n.hot ? "location" : undefined}
              className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-line py-[11px] no-underline transition-colors hover:text-amber ${n.hot ? "text-ink" : "text-muted"}`}
            >
              <span className="font-mono text-[11px] font-medium text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif text-[19px] leading-[1.1]">{n.label}</span>
              <span className="font-mono text-[11px] font-semibold tracking-[.06em]" style={{ color: toneVar(n.tone) }}>{n.count}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-[18px]">
        <p className="font-serif text-[23px] leading-[1.12] tracking-[-.01em]">
          It can <em className="text-red">never</em> move money on its own.
        </p>
        <div className="flex items-center gap-2.5 border-t border-line pt-3.5">
          <span className="font-serif text-[22px] text-amber italic" aria-hidden>AN</span>
          <div className="flex flex-col leading-[1.25]">
            <span className="text-[14px] font-medium">Night analyst</span>
            <span className="text-[12px] text-muted">On shift · after hours</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

// 1. Sidebar: small wordmark + thin signature, the views with muted counts, the promise, analyst chip.
//    ViewTabs is the same nav as a tab row for screens where the sidebar is hidden.
import { isShield, shieldInfo } from "../../lib/derive";
import type { Case, Review } from "../../lib/types";
import { SignatureStroke } from "./primitives";

export type View = "cases" | "shield" | "estates" | "review" | "safety";
type NavProps = { cases?: Case[]; review?: Review | null; now: number; active: View; onNavigate: (v: View) => void };
type NavRow = { view: View; label: string; count?: string; alert?: boolean };

function navRows({ cases, review, now }: Pick<NavProps, "cases" | "review" | "now">): NavRow[] {
  const armed = (cases ?? []).some((c) => isShield(c) && shieldInfo(c).armedUntil > now);
  const rs = review?.status;
  return [
    { view: "shield", label: "Scam Shield", count: armed ? "Armed" : undefined, alert: armed },
    { view: "estates", label: "Estate desk" },
    { view: "cases", label: "Overnight holds", count: cases ? String(cases.length) : "—" },
    { view: "review", label: "Morning review", count: rs === "proposed" ? "1 new" : rs === "running" ? "Running" : undefined, alert: rs === "proposed" },
    { view: "safety", label: "Proof" },
  ];
}

/** Plain links (real hrefs, so open-in-new-tab works); a normal click switches view without a jump. */
function NavLink({ r, active, onNavigate, className }: { r: NavRow; active: View; onNavigate: (v: View) => void; className: string }) {
  const hot = r.view === active;
  return (
    <a
      href={`#${r.view}`}
      aria-current={hot ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(r.view);
      }}
      className={`${className} no-underline transition-colors hover:bg-panel2 hover:text-ink ${hot ? "bg-panel2 text-ink" : "text-muted"}`}
    >
      <span>{r.label}</span>
      {r.count && <span className={`num text-[12px] ${r.alert ? (r.view === "shield" ? "text-red" : "text-amber") : "text-muted"}`}>{r.count}</span>}
    </a>
  );
}

export function Sidebar(props: NavProps) {
  return (
    <nav aria-label="Views" className="sticky top-0 flex h-screen flex-[0_0_200px] flex-col gap-8 border-r border-line bg-bg px-4 py-7 max-lg:hidden">
      <div className="flex flex-col gap-1 px-2">
        <span className="font-serif text-[20px] leading-tight tracking-[-.01em]">Second Signature</span>
        <SignatureStroke variant="mark" className="h-2 w-[72px]" />
        <span className="mt-1 text-[12px] text-muted">Bayview Community CU</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {navRows(props).map((r) => (
          <li key={r.view}>
            <NavLink r={r} active={props.active} onNavigate={props.onNavigate} className="flex items-baseline justify-between gap-2 rounded-[6px] px-2 py-1.5 text-[14px]" />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-4 px-2">
        <p className="text-[12px] leading-snug text-muted">It can never move money on its own.</p>
        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <span className="grid size-7 flex-none place-items-center rounded-full border border-line text-[11px] font-medium text-muted" aria-hidden>AN</span>
          <div className="flex flex-col leading-[1.3]">
            <span className="text-[13px] font-medium">Analyst &amp; controller</span>
            <span className="text-[12px] text-muted">On shift · after hours</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

/** Same views as a horizontal row, shown only below lg (where the sidebar is hidden). */
export function ViewTabs(props: NavProps) {
  return (
    <nav aria-label="Views" className="flex gap-1 overflow-x-auto border-b border-line px-8 py-2 max-sm:px-4 lg:hidden">
      {navRows(props).map((r) => (
        <NavLink key={r.view} r={r} active={props.active} onNavigate={props.onNavigate} className="flex flex-none items-baseline gap-2 rounded-[6px] px-2.5 py-1.5 text-[14px]" />
      ))}
    </nav>
  );
}

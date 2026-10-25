"use client";

// 2. Header strip: desk line, live status, server indicator, cinema, passcode; small row: theme, sample/live, reset (inline confirm).
import { KeyRound } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { pingServer } from "../../lib/api";
import { clock, shortClock } from "../../lib/format";
import type { Case } from "../../lib/types";

// Theme lives on <html data-theme>; layout.tsx restores it from localStorage("theme") before paint.
function subscribeTheme(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"), () => "dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return [theme, toggle] as const;
}

function useServerUp(skip: boolean) {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    if (skip) return;
    let alive = true;
    const check = async () => {
      const ok = await pingServer();
      if (alive) setUp(ok);
    };
    check();
    const id = setInterval(check, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [skip]);
  return up;
}

const SMALL = "cursor-pointer underline-offset-4 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline";
const QUIET = "border border-line px-3.5 py-2 text-[14px] whitespace-nowrap transition-colors hover:bg-panel2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export function HeaderStrip({
  cases, now, demo, onToggleDemo, onCinema, onReset, onPasscode,
}: {
  cases?: Case[];
  now: number;
  demo: boolean;
  /** Omit when live data isn't available (no Convex): the toggle is hidden. */
  onToggleDemo?: () => void;
  onCinema: () => void;
  onReset: () => void;
  onPasscode: () => void;
}) {
  const [theme, toggleTheme] = useTheme();
  const up = useServerUp(demo);
  const [confirming, setConfirming] = useState(false);

  const members = new Set((cases ?? []).map((c) => c.member_name)).size;
  const last = (cases ?? []).reduce((m, c) => Math.max(m, c.opened_at), 0);
  const [srvLabel, srvTone] = demo
    ? ["Sample data", "var(--brand)"]
    : up === null ? ["Checking server", "var(--muted)"] : up ? ["Server connected", "var(--green)"] : ["Server not reachable", "var(--red)"];

  return (
    <header className="relative z-[5] flex flex-wrap items-center justify-between gap-x-8 gap-y-[18px] border-b border-line px-7 pt-[18px] pb-4 max-sm:px-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="text-[15px] font-medium">Bayview Community CU · after-hours fraud desk</div>
        <div className="font-serif text-[16px] text-muted italic">It can never move money on its own.</div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="status" className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center gap-x-3.5 gap-y-1 border border-line px-3.5 py-2 font-mono text-[13px] text-muted">
            <span className="flex items-center gap-[7px] text-ink">
              <span aria-hidden className="size-[7px] rounded-full bg-green" />
              Watching {members} member{members === 1 ? "" : "s"}
            </span>
            <span>Last purchase {last ? shortClock(last) : "—"}</span>
            <span className="num text-ink" suppressHydrationWarning>{clock(now)}</span>
            <span className="flex items-center gap-[7px]">
              <span aria-hidden className="size-[7px]" style={{ background: srvTone }} />
              {srvLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onCinema}
            className="cursor-pointer border border-amber px-3.5 py-2 font-mono text-[11.5px] leading-[1.3] font-bold tracking-[.16em] whitespace-nowrap text-amber transition-colors hover:bg-amber hover:text-on-red"
          >
            CINEMA MODE ▸
          </button>
          <button type="button" onClick={onPasscode} aria-label="Analyst passcode" title="Analyst passcode" className={`${QUIET} text-muted hover:text-ink`}>
            <KeyRound size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {/* ponytail: secondary controls as a small text row, not a menu: no open/close state to manage. */}
        <div role="group" aria-label="Desk settings" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <button type="button" onClick={toggleTheme} className={SMALL}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
          {onToggleDemo && (
            <button type="button" onClick={onToggleDemo} aria-pressed={demo} className={SMALL}>{demo ? "Use live data" : "Use sample data"}</button>
          )}
          {confirming ? (
            <span role="group" aria-label="Confirm reset" className="flex items-center gap-2 text-ink">
              Wipe all cases?
              <button type="button" autoFocus onClick={() => { setConfirming(false); onReset(); }} className="cursor-pointer bg-red px-2 py-0.5 font-semibold text-on-red">Reset</button>
              <button type="button" onClick={() => setConfirming(false)} className={SMALL}>Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={demo} title={demo ? "Sample data can't be reset" : undefined} className={SMALL}>
              Reset demo
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

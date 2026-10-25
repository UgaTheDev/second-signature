"use client";

// Header strip: one quiet row. Name, clock and server status on the left; theme, sample/live, reset, passcode on the right.
// Run a scenario and Cinema mode live in the Overnight holds toolbar (page.tsx), next to the cases they act on.
import { KeyRound } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { pingServer } from "../../lib/api";
import { clock } from "../../lib/format";

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

const SMALL = "cursor-pointer text-muted underline-offset-4 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline";
const OUTLINE = "inline-flex h-8 cursor-pointer items-center rounded-[6px] border border-line px-3 text-[13px] whitespace-nowrap transition-colors hover:bg-panel2";

export function HeaderStrip({
  now, demo, onToggleDemo, onReset, onPasscode,
}: {
  now: number;
  demo: boolean;
  /** Omit when live data isn't available (no Convex): the toggle is hidden. */
  onToggleDemo?: () => void;
  onReset: () => void;
  onPasscode: () => void;
}) {
  const [theme, toggleTheme] = useTheme();
  const up = useServerUp(demo);
  const [confirming, setConfirming] = useState(false);

  const [srvLabel, srvTone] = demo
    ? ["Sample data", "var(--muted)"]
    : up === null ? ["Checking server", "var(--muted)"] : up ? ["Server connected", "var(--green)"] : ["Server not reachable", "var(--red)"];

  return (
    <header className="relative z-[5] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line px-8 py-3.5 max-sm:px-4">
      <div role="status" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="font-medium text-ink">Bayview Community CU · Second Signature</span>
        <span className="num font-mono" suppressHydrationWarning>{clock(now)}</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: srvTone }} />
          {srvLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* ponytail: secondary controls as a small text row, not a menu: no open/close state to manage. */}
        <div role="group" aria-label="Desk settings" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <button type="button" onClick={toggleTheme} className={SMALL}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
          {onToggleDemo && (
            <button type="button" onClick={onToggleDemo} aria-pressed={demo} className={SMALL}>{demo ? "Use live data" : "Use sample data"}</button>
          )}
          {confirming ? (
            <span role="group" aria-label="Confirm reset" className="flex items-center gap-2 text-ink">
              Wipe all cases?
              <button type="button" autoFocus onClick={() => { setConfirming(false); onReset(); }} className="cursor-pointer rounded-[4px] border border-red/45 px-2 py-0.5 font-medium text-red hover:bg-red/10">Reset</button>
              <button type="button" onClick={() => setConfirming(false)} className={SMALL}>Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={demo} title={demo ? "Sample data can't be reset" : undefined} className={SMALL}>
              Reset demo
            </button>
          )}
        </div>
        <button type="button" onClick={onPasscode} aria-label="Analyst passcode" title="Analyst passcode" className={`${OUTLINE} px-2 text-muted hover:text-ink`}>
          <KeyRound size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </header>
  );
}

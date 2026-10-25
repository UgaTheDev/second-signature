"use client";

// Floating tools keep demo controls out of the dashboard layout (Run a scenario and Cinema mode live here, reachable from every view).
import { KeyRound, SlidersHorizontal } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

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

const ITEM = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40";

export function HeaderStrip({
  demo, onToggleDemo, onScenario, onCinema, onReset, onPasscode,
}: {
  demo: boolean;
  /** Omit when live data isn't available (no Convex): the toggle is hidden. */
  onToggleDemo?: () => void;
  /** Opens the scenario sheet: an action available from every view. */
  onScenario: () => void;
  /** Opens the selected case full-screen. */
  onCinema: () => void;
  onReset: () => void;
  onPasscode: () => void;
}) {
  const [theme, toggleTheme] = useTheme();
  const [confirming, setConfirming] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  function run(action: () => void) {
    panel.current?.hidePopover();
    action();
  }

  return (
    <>
      <button
        type="button"
        popoverTarget="demo-tools"
        aria-label="Demo tools"
        aria-expanded={open}
        aria-controls="demo-tools"
        title="Demo tools"
        className="fixed right-4 bottom-4 z-30 grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-panel text-muted shadow-md transition-colors hover:bg-panel2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden />
      </button>
      <div
        ref={panel}
        id="demo-tools"
        popover="auto"
        onToggle={(event) => {
          setOpen(event.newState === "open");
          if (event.newState === "closed") setConfirming(false);
        }}
        className="fixed inset-auto right-4 bottom-[68px] m-0 w-60 max-w-[calc(100vw-32px)] rounded-xl border border-line bg-panel p-2 text-ink shadow-xl"
      >
        <p className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">Demo tools</p>
        <button type="button" onClick={() => run(onScenario)} className={ITEM}>Run a scenario</button>
        <button type="button" onClick={() => run(onCinema)} className={ITEM}>Cinema mode</button>
        {onToggleDemo && (
          <button type="button" onClick={() => run(onToggleDemo)} aria-pressed={demo} className={ITEM}>
            {demo ? "Use live data" : "Use sample data"}
          </button>
        )}
        {confirming ? (
          <div role="group" aria-label="Confirm reset" className="rounded-lg bg-panel2 p-3">
            <p className="mb-2 text-[13px]">Wipe all cases?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => run(onReset)} className={`${ITEM} text-red`}>Reset</button>
              <button type="button" onClick={() => setConfirming(false)} className={ITEM}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={demo} title={demo ? "Sample data can't be reset" : undefined} className={ITEM}>Reset demo</button>
        )}
        <div className="my-1 border-t border-line" />
        <button type="button" onClick={() => run(toggleTheme)} className={ITEM}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
        <button type="button" onClick={() => run(onPasscode)} className={ITEM}>
          <KeyRound size={15} strokeWidth={1.75} aria-hidden />
          Analyst passcode
        </button>
      </div>
    </>
  );
}

"use client";

import { KeyRound, ListPlus, Moon, RotateCcw, Sun } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getPasscode, pingServer, post, setPasscode } from "../lib/api";
import { Button, Dialog, IconButton, useToast } from "./ui";

export type Tab = "desk" | "policy" | "proof";
const TABS: [Tab, string][] = [
  ["desk", "Live desk"],
  ["policy", "Policy review"],
  ["proof", "How we know it works"],
];

// The theme lives on <html data-theme>; the inline script in layout.tsx sets it before first paint.
function subscribeTheme(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  return [theme, toggle] as const;
}

function ServerStatus({ demo }: { demo: boolean }) {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    if (demo) return;
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
  }, [demo]);

  const [label, color] = demo
    ? ["Showing sample data", "bg-accent"]
    : up === null
      ? ["Checking the server", "bg-ink-3"]
      : up
        ? ["Server connected", "bg-ok"]
        : ["Server not reachable", "bg-danger"];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2" role="status">
      <span className={`size-2 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}

export function Header({
  tab,
  setTab,
  demo,
  setDemo,
  canGoLive,
  openScenario,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  demo: boolean;
  setDemo: (v: boolean) => void;
  canGoLive: boolean;
  openScenario: () => void;
}) {
  const [theme, toggleTheme] = useTheme();
  const toast = useToast();

  // In-page dialogs, not prompt()/confirm(): embedded browsers and previews block the native ones.
  const [asking, setAsking] = useState<"passcode" | "reset" | null>(null);
  const [code, setCode] = useState("");

  function savePasscode(e: React.FormEvent) {
    e.preventDefault();
    setPasscode(code.trim());
    setAsking(null);
    toast(code.trim() ? "Passcode saved in this browser." : "Passcode cleared.");
  }

  async function reset() {
    setAsking(null);
    const err = await post("/reset");
    toast(err ?? "All cases cleared.", Boolean(err));
  }

  return (
    <header className="border-b border-line">
      <Dialog open={asking === "passcode"} onClose={() => setAsking(null)} title="Analyst passcode">
        <form onSubmit={savePasscode}>
          <label className="mb-6 block text-sm text-ink-2">
            The server&apos;s ANALYST_TOKEN. Saved in this browser only.
            <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 text-[15px] text-ink" />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" onClick={() => setAsking(null)}>Cancel</Button>
            <Button variant="primary" type="submit">Save</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={asking === "reset"} onClose={() => setAsking(null)} title="Delete every case?">
        <p className="mb-6">Every case and review is removed from the dashboard, and the server&apos;s open cases are cleared too.</p>
        <div className="flex justify-end gap-3">
          <Button onClick={() => setAsking(null)}>Go back</Button>
          <Button variant="danger" onClick={reset}>Delete all cases</Button>
        </div>
      </Dialog>
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">Second Signature</h1>
          <p className="text-sm text-ink-2">Overnight fraud desk · Bayview Community Credit Union</p>
        </div>
        <ServerStatus demo={demo} />
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={openScenario}>
            <ListPlus size={16} strokeWidth={1.75} /> Run a scenario
          </Button>
          {canGoLive && (
            <Button onClick={() => setDemo(!demo)} aria-pressed={demo}>
              {demo ? "Use live data" : "Use sample data"}
            </Button>
          )}
          <IconButton label="Enter analyst passcode" onClick={() => { setCode(getPasscode()); setAsking("passcode"); }}>
            <KeyRound size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Delete all cases" onClick={() => setAsking("reset")} disabled={demo}>
            <RotateCcw size={18} strokeWidth={1.75} />
          </IconButton>
          <IconButton label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
          </IconButton>
        </div>
      </div>
      <nav className="mx-auto flex max-w-[1560px] gap-6 px-6" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 py-3 text-[15px] font-medium ${
              tab === id ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

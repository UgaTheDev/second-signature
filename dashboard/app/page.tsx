"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HAS_CONVEX } from "./ConvexClientProvider";
import { ArenaHonesty } from "./components/night/ArenaHonesty";
import { CasePanel } from "./components/night/CasePanel";
import { Cinema } from "./components/night/Cinema";
import { Dossier } from "./components/night/Dossier";
import { HeaderStrip } from "./components/night/HeaderStrip";
import { Hero } from "./components/night/Hero";
import { KpiBand } from "./components/night/KpiBand";
import { Ledger } from "./components/night/Ledger";
import { Btn } from "./components/night/primitives";
import { ReviewPanel } from "./components/night/ReviewPanel";
import { ScenarioPanel } from "./components/night/ScenarioPanel";
import { ShieldPanel } from "./components/night/ShieldPanel";
import { Sidebar } from "./components/night/Sidebar";
import { Ticker } from "./components/night/Ticker";
import { Walls } from "./components/night/Walls";
import { Dialog, ToastProvider, useToast } from "./components/ui";
import { getPasscode, post, setPasscode } from "./lib/api";
import { DemoContext, useArena, useCaseDetail, useCases, useReview, useStats } from "./lib/data";

const noop = () => () => {};

/** One ticking clock for the whole page: header seconds, "just arrived", call timeouts, shield window. */
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** In-page dialog, not prompt(): embedded browsers and previews block the native one. */
function PasscodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setCode(getPasscode());
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setPasscode(code.trim());
    onClose();
    toast(code.trim() ? "Passcode saved in this browser." : "Passcode cleared.");
  }
  return (
    <Dialog open={open} onClose={onClose} title="Analyst passcode">
      <form onSubmit={save}>
        <label className="mb-6 block text-sm text-muted">
          The server&apos;s ANALYST_TOKEN. Saved in this browser only.
          <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)}
            className="mt-2 w-full border border-line bg-bg px-3 py-2 font-mono text-[15px] text-ink" />
        </label>
        <div className="flex justify-end gap-3">
          <Btn variant="quiet" onClick={onClose}>Cancel</Btn>
          <Btn variant="amber" type="submit">Save</Btn>
        </div>
      </form>
    </Dialog>
  );
}

function Desk({ demo, onToggleDemo }: { demo: boolean; onToggleDemo?: () => void }) {
  const cases = useCases();
  const stats = useStats();
  const arena = useArena();
  const review = useReview();
  const toast = useToast();
  const now = useClock();
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [cinema, setCinema] = useState(false);
  const [passcode, setPasscodeOpen] = useState(false);

  // Follow the newest case as it arrives, and flash it once (adjusting state during render, no effect needed).
  const newestId = cases?.[0]?._id ?? null;
  const [seenNewest, setSeenNewest] = useState<string | null>(null);
  if (newestId !== seenNewest) {
    setSeenNewest(newestId);
    setSelected(newestId);
    if (seenNewest !== null) setFresh(newestId);
  }
  // A different data source means different ids: start from its newest case.
  const [seenDemo, setSeenDemo] = useState(demo);
  if (seenDemo !== demo) {
    setSeenDemo(demo);
    setSelected(newestId);
  }

  const detail = useCaseDetail(selected);
  const selectedCase = cases?.find((c) => c._id === selected) ?? null;

  async function reset() {
    const err = await post("/reset");
    toast(err ?? "All cases cleared.", Boolean(err));
  }

  return (
    <div className="flex">
      <Sidebar cases={cases} review={review} arena={arena} now={now} />
      <div className="min-w-0 flex-1 overflow-x-clip">
        <HeaderStrip
          cases={cases}
          now={now}
          demo={demo}
          onToggleDemo={onToggleDemo}
          onCinema={() => setCinema(true)}
          onReset={reset}
          onPasscode={() => setPasscodeOpen(true)}
        />
        <Hero c={selectedCase} detail={detail} cases={cases} now={now} />
        <Ticker cases={cases} actions={detail?.actions} />
        <KpiBand stats={stats} cases={cases} />
        <main id="cases" className="flex scroll-mt-4 flex-wrap border-b border-line">
          <aside className="flex min-w-[280px] max-w-full flex-[1_1_330px] flex-col border-r border-line">
            <Dossier cases={cases} selectedId={selected} />
            <Ledger cases={cases} selectedId={selected} onSelect={setSelected} fresh={fresh} />
          </aside>
          <section aria-label="The case" className="min-w-0 flex-[4_1_600px] border-r border-line px-9 pt-[30px] pb-12 max-sm:px-4">
            <CasePanel detail={detail} />
          </section>
          <aside className="flex min-w-0 flex-[1_1_410px] flex-col">
            <ScenarioPanel />
            <ShieldPanel cases={cases} />
            <ReviewPanel />
          </aside>
        </main>
        <Walls />
        <ArenaHonesty />
      </div>
      <Cinema detail={detail} open={cinema} onClose={() => setCinema(false)} onOpenChange={setCinema} />
      <PasscodeDialog open={passcode} onClose={() => setPasscodeOpen(false)} />
    </div>
  );
}

export default function Page() {
  const [choice, setDemo] = useState<boolean | null>(null);
  // Sample data is built from the clock, so render it only in the browser. ?demo=1 forces it on.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const forced = useSyncExternalStore(noop, () => new URLSearchParams(location.search).get("demo") === "1", () => false);
  const demo = choice ?? (forced || !HAS_CONVEX);

  return (
    <DemoContext.Provider value={demo}>
      <ToastProvider>{mounted && <Desk demo={demo} onToggleDemo={HAS_CONVEX ? () => setDemo(!demo) : undefined} />}</ToastProvider>
    </DemoContext.Provider>
  );
}

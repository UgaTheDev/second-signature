"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HAS_CONVEX } from "./ConvexClientProvider";
import { ArenaHonesty } from "./components/night/ArenaHonesty";
import { BooksPanel } from "./components/night/BooksPanel";
import { CasePanel } from "./components/night/CasePanel";
import { Cinema } from "./components/night/Cinema";
import { Dossier } from "./components/night/Dossier";
import { HeaderStrip } from "./components/night/HeaderStrip";
import { KpiBand } from "./components/night/KpiBand";
import { Ledger } from "./components/night/Ledger";
import { Btn } from "./components/night/primitives";
import { ReviewPanel } from "./components/night/ReviewPanel";
import { ScenarioPanel } from "./components/night/ScenarioPanel";
import { ShieldPanel } from "./components/night/ShieldPanel";
import { Sidebar, ViewTabs, type View } from "./components/night/Sidebar";
import { Walls } from "./components/night/Walls";
import { Dialog, ToastProvider, useToast } from "./components/ui";
import { getPasscode, post, setPasscode } from "./lib/api";
import { DemoContext, useCaseDetail, useCases, useReview, useStats } from "./lib/data";

const noop = () => () => {};

const VIEWS: View[] = ["cases", "shield", "review", "books", "safety"];
// Old section anchors still land on the view that holds them.
const LEGACY: Record<string, View> = { matrix: "safety", arena: "safety", honesty: "safety" };
const viewFromHash = (): View => {
  const h = location.hash.slice(1);
  return VIEWS.includes(h as View) ? (h as View) : LEGACY[h] ?? "cases";
};

/** The active view lives in the URL hash so links, refresh and back/forward work. */
function useView() {
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const sync = () => setView(viewFromHash());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const go = (v: View) => {
    if (v !== viewFromHash()) history.pushState(null, "", `#${v}`);
    setView(v);
    window.scrollTo(0, 0);
  };
  return [view, go] as const;
}

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
        <label className="mb-6 block text-[14px] text-muted">
          The server&apos;s ANALYST_TOKEN. Saved in this browser only.
          <input type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)}
            className="mt-2 w-full rounded-[6px] border border-line bg-bg px-3 py-2 font-mono text-[14px] text-ink" />
        </label>
        <div className="flex justify-end gap-3">
          <Btn variant="quiet" onClick={onClose}>Cancel</Btn>
          <Btn variant="ink" type="submit">Save</Btn>
        </div>
      </form>
    </Dialog>
  );
}

function Desk({ demo, onToggleDemo }: { demo: boolean; onToggleDemo?: () => void }) {
  const cases = useCases();
  const stats = useStats();
  const review = useReview();
  const toast = useToast();
  const now = useClock();
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [cinema, setCinema] = useState(false);
  const [passcode, setPasscodeOpen] = useState(false);
  const [scenario, setScenario] = useState(false);
  const [view, go] = useView();

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

  async function reset() {
    const err = await post("/reset");
    toast(err ?? "All cases cleared.", Boolean(err));
  }

  // Panels were built for a stacked page and carry their own separator rules; a view alone does not need them.
  const single = "mx-auto w-full max-w-[1200px] px-8 py-10 max-sm:px-4 [&>*]:border-y-0";
  return (
    <div className="flex">
      <Sidebar cases={cases} review={review} now={now} active={view} onNavigate={go} />
      <div className="min-w-0 flex-1 overflow-x-clip">
        <h1 className="sr-only">Second Signature: after-hours fraud desk</h1>
        <HeaderStrip
          cases={cases}
          now={now}
          demo={demo}
          onToggleDemo={onToggleDemo}
          onScenario={() => setScenario(true)}
          onCinema={() => setCinema(true)}
          onReset={reset}
          onPasscode={() => setPasscodeOpen(true)}
        />
        <ViewTabs cases={cases} review={review} now={now} active={view} onNavigate={go} />
        <main key={view} className="ss-in">
          {view === "cases" && (
            <>
              <KpiBand stats={stats} cases={cases} />
              <div className="flex flex-wrap">
                <aside aria-label="Cases" className="min-w-[280px] max-w-full flex-[1_1_320px] border-r border-line">
                  <Ledger cases={cases} selectedId={selected} onSelect={setSelected} fresh={fresh} />
                </aside>
                <section aria-label="The case" className="min-w-0 flex-[3_1_640px]">
                  <Dossier cases={cases} selectedId={selected} />
                  <div className="px-10 pt-8 pb-14 max-sm:px-4">
                    <CasePanel detail={detail} />
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "shield" && <div className={single}><ShieldPanel cases={cases} /></div>}
          {view === "review" && <div className={single}><ReviewPanel /></div>}
          {view === "books" && <div className={single}><BooksPanel /></div>}
          {view === "safety" && (
            <div className={`${single} flex flex-col gap-12`}>
              <Walls />
              <ArenaHonesty />
            </div>
          )}
        </main>
      </div>
      <Dialog open={scenario} onClose={() => setScenario(false)} title="Run a scenario" side>
        {/* ponytail: ScenarioPanel brings its own padding and heading; cancel the dialog's padding and hide the duplicate heading. */}
        <div className="-m-6 [&_#scenario]:hidden [&>*]:border-b-0"><ScenarioPanel /></div>
      </Dialog>
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

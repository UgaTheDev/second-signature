"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HAS_CONVEX } from "./ConvexClientProvider";
import { ArenaHonesty } from "./components/night/ArenaHonesty";
import { CasePanel } from "./components/night/CasePanel";
import { Cinema } from "./components/night/Cinema";
import { CustomersPanel } from "./components/night/CustomersPanel";
import { EstatesPanel } from "./components/night/EstatesPanel";
import { HeaderStrip } from "./components/night/HeaderStrip";
import { Ledger } from "./components/night/Ledger";
import { Btn } from "./components/night/primitives";
import { ReviewPanel } from "./components/night/ReviewPanel";
import { ScenarioPanel } from "./components/night/ScenarioPanel";
import { ShieldPanel } from "./components/night/ShieldPanel";
import { Sidebar, ViewTabs, type View } from "./components/night/Sidebar";
import { Walls } from "./components/night/Walls";
import { Dialog, ToastProvider, useToast } from "./components/ui";
import { getPasscode, post, setPasscode } from "./lib/api";
import { DemoContext, useCaseDetail, useCases, useReview } from "./lib/data";
import { isActiveCase } from "./lib/ledger";

const noop = () => () => {};

// Demo order: Scam Shield (beat 1), Estate desk (beat 2), then the desk (per-customer issues, history, profiles, policy) and the proof.
const VIEWS: View[] = ["shield", "estates", "cases", "history", "customers", "review", "safety"];
// Old section anchors still land on the view that holds them.
const LEGACY: Record<string, View> = { matrix: "safety", arena: "safety", honesty: "safety" };
const viewFromHash = (): View => {
  const h = location.hash.slice(1);
  return VIEWS.includes(h as View) ? (h as View) : LEGACY[h] ?? "shield";
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
  };
  return [view, go] as const;
}

/** One ticking clock for the sidebar's Scam Shield "Armed" count. */
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
  const review = useReview();
  const toast = useToast();
  const now = useClock();
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [passcode, setPasscodeOpen] = useState(false);
  const [scenario, setScenario] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [view, go] = useView();

  const historyView = view === "history";
  const visibleCases = cases?.filter((c) => historyView ? !isActiveCase(c) : isActiveCase(c));

  // Follow the newest case as it arrives, and flash it once (adjusting state during render, no effect needed).
  const newestId = visibleCases?.[0]?._id ?? null;
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

  // A resolved case leaves the active queue immediately, including its detail panel.
  const selectedId = visibleCases?.some((c) => c._id === selected) ? selected : newestId;
  const detail = useCaseDetail(selectedId);

  async function reset() {
    const err = await post("/reset");
    toast(err ?? "All cases cleared.", Boolean(err));
  }

  // Panels were built for a stacked page and carry their own separator rules; a view alone does not need them.
  const single = "mx-auto w-full max-w-[1200px] px-8 py-10 max-sm:px-4 [&>*]:border-y-0";
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar cases={cases} review={review} now={now} active={view} onNavigate={go} />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <h1 className="sr-only">Bayview Community CU · Second Signature</h1>
        <HeaderStrip
          demo={demo}
          onToggleDemo={onToggleDemo}
          onScenario={() => setScenario(true)}
          onCinema={() => setCinema(true)}
          onReset={reset}
          onPasscode={() => setPasscodeOpen(true)}
        />
        <ViewTabs cases={cases} review={review} now={now} active={view} onNavigate={go} />
        {/* Each view scrolls inside the viewport; on wide screens its panes scroll independently. */}
        <main key={view} className="ss-in min-h-0 flex-1 overflow-y-auto">
          {(view === "cases" || historyView) && (
            <>
              <div className="flex flex-wrap lg:h-full lg:flex-nowrap">
                <aside aria-label="Cases" className="min-w-[280px] max-w-full flex-[1_1_320px] border-r border-line lg:overflow-y-auto">
                  <Ledger cases={visibleCases} selectedId={selectedId} onSelect={setSelected} fresh={fresh} history={historyView} />
                </aside>
                <section aria-label="The case" className="min-w-0 flex-[3_1_640px] lg:overflow-y-auto">
                  <div className="px-10 pt-8 pb-14 max-sm:px-4">
                    {selectedId ? <CasePanel key={selectedId} detail={detail} /> : (
                      <p className="text-[15px] text-muted">{!cases ? "Loading…" : historyView ? "No historical cases yet." : "No active issues. Resolved cases are in the historical log."}</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "shield" && <div className={single}><ShieldPanel cases={cases} /></div>}
          {view === "estates" && <div className={single}><EstatesPanel /></div>}
          {view === "customers" && <CustomersPanel cases={cases} />}
          {view === "review" && <div className={single}><ReviewPanel /></div>}
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

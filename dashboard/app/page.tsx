"use client";

import { useState, useSyncExternalStore } from "react";
import { HAS_CONVEX } from "./ConvexClientProvider";
import { CaseQueue } from "./components/CaseQueue";
import { CaseView } from "./components/CaseView";
import { Evidence } from "./components/Evidence";
import { Header, type Tab } from "./components/Header";
import { PolicyReview } from "./components/PolicyReview";
import { ScenarioSheet } from "./components/ScenarioSheet";
import { StatsStrip } from "./components/StatsStrip";
import { ToastProvider } from "./components/ui";
import { DemoContext, useCases } from "./lib/data";

const noop = () => () => {};

function Desk({ demo }: { demo: boolean }) {
  const cases = useCases();
  const [selected, setSelected] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

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

  return (
    <>
      <StatsStrip />
      <div className="mx-auto grid max-w-[1560px] gap-10 border-t border-line px-6 py-8 lg:grid-cols-[288px_minmax(0,1fr)]">
        <CaseQueue cases={cases} selected={selected} onSelect={setSelected} fresh={fresh} />
        <CaseView caseId={selected} />
      </div>
    </>
  );
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("desk");
  const [choice, setDemo] = useState<boolean | null>(null);
  const [scenario, setScenario] = useState(false);
  // Sample data is built from the clock, so render it only in the browser. ?demo=1 forces it on.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const forced = useSyncExternalStore(noop, () => new URLSearchParams(location.search).get("demo") === "1", () => false);
  const demo = choice ?? (forced || !HAS_CONVEX);

  return (
    <DemoContext.Provider value={demo}>
      <ToastProvider>
        <Header tab={tab} setTab={setTab} demo={demo} setDemo={setDemo} canGoLive={HAS_CONVEX} openScenario={() => setScenario(true)} />
        <main>
          {mounted && (
            <>
              {tab === "desk" && <Desk demo={demo} />}
              {tab === "policy" && <PolicyReview demo={demo} />}
              {tab === "proof" && <Evidence />}
            </>
          )}
        </main>
        <ScenarioSheet open={scenario} onClose={() => setScenario(false)} demo={demo} />
      </ToastProvider>
    </DemoContext.Provider>
  );
}

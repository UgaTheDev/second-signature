"use client";

import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { createContext, useContext, useMemo } from "react";
import { sampleDesk } from "./sample";
import type { Arena, Case, CaseDetail, EstateRow, PostedLine, Review, Stats } from "./types";

// Untyped so this builds without codegen.
const api = anyApi;

// Demo mode swaps Convex for sample data. The hooks always run (rules of hooks) but skip their queries.
export const DemoContext = createContext(false);
const useDemo = () => useContext(DemoContext);

// One sample desk per page load, so ids and times stay stable between renders.
function useSample() {
  return useMemo(() => sampleDesk(), []);
}

export function useCases(): Case[] | undefined {
  const demo = useDemo();
  const sample = useSample();
  const live = useQuery(api.cases.list, demo ? "skip" : {}) as Case[] | undefined;
  return demo ? sample.cases : live;
}

export function useCaseDetail(caseId: string | null): CaseDetail | null | undefined {
  const demo = useDemo();
  const sample = useSample();
  const live = useQuery(api.cases.get, demo || !caseId ? "skip" : { caseId }) as CaseDetail | null | undefined;
  if (!caseId) return null;
  return demo ? (sample.details.find((d) => d._id === caseId) ?? null) : live;
}

export function useStats(): Stats | undefined {
  const demo = useDemo();
  const sample = useSample();
  const live = useQuery(api.cases.stats, demo ? "skip" : {}) as Stats | undefined;
  return demo ? sample.stats : live;
}

export function useArena(): Arena | undefined {
  const demo = useDemo();
  const sample = useSample();
  const live = useQuery(api.cases.latestArena, demo ? "skip" : {}) as Arena | undefined;
  return demo ? sample.arena : live;
}

export function useReview(): Review | null | undefined {
  const demo = useDemo();
  const sample = useSample();
  const live = useQuery(api.cases.latestReview, demo ? "skip" : {}) as Review | null | undefined;
  return demo ? sample.review : live;
}

// ponytail: no sample estates; demo mode shows the estate desk's empty state.
export function useEstates(): EstateRow[] | undefined {
  const demo = useDemo();
  const live = useQuery(api.estates.list, demo ? "skip" : {}) as EstateRow[] | undefined;
  return demo ? [] : live;
}

export function useEstateJournal(key: string | null): PostedLine[] {
  const demo = useDemo();
  const live = useQuery(api.estates.get, demo || !key ? "skip" : { key }) as { journal: PostedLine[] } | undefined;
  return live?.journal ?? [];
}

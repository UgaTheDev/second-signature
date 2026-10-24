"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Without a deployment URL the dashboard runs on sample data (see lib/data.ts); the client is never queried.
export const HAS_CONVEX = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://sample-data.convex.cloud");

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

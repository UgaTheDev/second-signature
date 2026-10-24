import type { Case, Status } from "./types";

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
export const shortClock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// What each status means for the person looking at the screen.
export const STATUS_LABEL: Record<Status, { label: string; hint: string }> = {
  allowed: { label: "Let through", hint: "Looked normal; no hold was placed" },
  open: { label: "Held", hint: "Payment paused; the member is being contacted" },
  released: { label: "Released", hint: "Payment went through" },
  escalated: { label: "With an analyst", hint: "Needs a person to decide" },
  confirmed_fraud: { label: "Fraud confirmed", hint: "Payment stayed stopped" },
};

export const isShieldCase = (c: Pick<Case, "category">) => c.category === "scam_call";
export const needsDecision = (s: Status) => s === "open" || s === "escalated";
export const words = (s: string) => s.replace(/_/g, " ");

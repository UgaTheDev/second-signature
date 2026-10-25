import type { Status } from "./types";

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
export const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
export const shortClock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const needsDecision = (s: Status) => s === "open" || s === "escalated";
export const words = (s: string) => s.replace(/_/g, " ");

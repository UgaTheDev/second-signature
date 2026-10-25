// Sample data for demo mode: the Dolores gift-card story, in the same shapes the Convex queries return.
// Shown only when the dashboard says "Sample data"; nothing here is written anywhere.
import type { Arena, Case, CaseDetail, Review, Stats } from "./types";

const MIN = 60_000;

export function sampleDesk(now = Date.now()) {
  const t = (minutesAgo: number) => now - minutesAgo * MIN;
  const state = (o: Partial<NonNullable<Case["state"]>> = {}) => ({
    verified: false, red_flags: false, unanswered_calls: 0, family_notified: false, held_by_rule: false, bridged: false, ...o,
  });

  const gift: CaseDetail = {
    _id: "s-gift", member_name: "Dolores Whitcomb", merchant: "Target Gift Cards", category: "gift_card", amount: 500,
    opened_at: t(14), status: "escalated", state: state({ verified: true, red_flags: true, held_by_rule: true, bridged: true }),
    plan: "Hold the purchase, call Dolores, verify her from her credit file, and offer to connect her with her daughter.",
    decision_rationale:
      "Dolores has never bought gift cards, and this is $500 at 10:41 PM, twelve minutes after Scam Shield flagged a call on her protected line. Held by rule and by triage.",
    risk_signals: [
      { source: "shield", fact: 'Scam Shield flagged a tech support call 12 min ago; caller said: "buy five hundred dollars of gift cards and don\'t tell your bank"', weight: 0.95 },
      { source: "nessie", fact: "First gift card purchase in her 90-day history; $500 is 6x her largest purchase", weight: 0.8 },
      { source: "apify", fact: "FTC alert: callers posing as Microsoft support ask for gift cards", weight: 0.7 },
      { source: "crs", fact: "No new credit inquiries in the last 30 days", weight: 0 },
    ],
    actions: [
      { _id: "a1", t: t(14), type: "triage", by: "agent", detail: "HOLD: First-ever gift card purchase, right after a flagged scam call." },
      { _id: "a2", t: t(14), type: "override", by: "gate", detail: "Triage said allow, held anyway: first gift_card purchase in her history; held by rule regardless of triage" },
      { _id: "a3", t: t(14), type: "hold", by: "agent", detail: "Paused $500 at Target Gift Cards." },
      { _id: "a4", t: t(13), type: "verify", by: "agent", detail: "3 verification questions from her CRS credit file, answers kept server-side (2 of 3 needed)" },
      { _id: "a5", t: t(13), type: "call_member", by: "agent", detail: "Calling Dolores about the paused purchase" },
      { _id: "a6", t: t(11), type: "verify", by: "member", detail: "Identity verified from her credit-file answers" },
      { _id: "a8", t: t(8), type: "connect_family", by: "member", detail: "She said yes to being connected with her daughter Susan" },
      { _id: "a9", t: t(8), type: "deny", by: "gate", detail: "member tried to release: first-ever gift_card purchase; an analyst must release it" },
      { _id: "a10", t: t(5), type: "escalate", by: "agent", detail: "Red flags on the call; an analyst decides in the morning" },
    ],
    transcript: [
      { _id: "l1", t: t(13), speaker: "agent", text: "Hi, this is the after-hours assistant at Bayview Community Credit Union, calling for Dolores. You don't have to trust this call. You can hang up and call the number on the back of your card." },
      { _id: "l2", t: t(12), speaker: "member", text: "Oh. Yes, this is Dolores." },
      { _id: "l3", t: t(12), speaker: "agent", text: "I will never ask for a PIN, password or code. First, which of these streets have you lived on? Maple Avenue, Ocean View Drive, Cedar Lane, or Harbor Boulevard?" },
      { _id: "l4", t: t(11), speaker: "member", text: "Ocean View Drive." },
      { _id: "l5", t: t(10), speaker: "agent", text: "Thank you. We paused a five hundred dollar purchase at Target Gift Cards. Did anyone ask you to buy gift cards tonight?" },
      { _id: "l6", t: t(9), speaker: "member", text: "A man from Microsoft said my computer is broken. He said not to tell the bank." },
      { _id: "l7", t: t(9), speaker: "agent", text: "That sounds like a pattern scammers use, and real companies never ask for gift cards. Would you like me to connect you with your daughter Susan right now?" },
      { _id: "l8", t: t(8), speaker: "member", text: "Yes, please." },
    ],
  };

  const shield: CaseDetail = {
    _id: "s-shield", member_name: "Dolores Whitcomb", merchant: "Phone call from ••• 1234", category: "scam_call", amount: 0,
    opened_at: t(26), status: "escalated", state: state(),
    plan: "Whispered a warning only she could hear. Any gift card, wire or crypto purchase in the next 24h is held for an analyst.",
    decision_rationale: "Scam Shield: tech support script detected live (confidence 93%).",
    risk_signals: [{ source: "shield", fact: 'Caller said: "buy five hundred dollars of gift cards and don\'t tell your bank"', weight: 0.93 }],
    actions: [{ _id: "s1", t: t(26), type: "shield", by: "agent", detail: "Whispered a warning only she could hear" }],
    transcript: [],
  };

  const bike: CaseDetail = {
    _id: "s-bike", member_name: "Dolores Whitcomb", merchant: "Bay Cycles", category: "sporting_goods", amount: 300,
    opened_at: t(95), status: "released", state: state({ verified: true }),
    plan: "Hold, call, and release if she confirms she made the purchase herself.",
    decision_rationale: "Unusual category for her, but the amount is small and the merchant is local.",
    risk_signals: [{ source: "nessie", fact: "First sporting goods purchase in her history", weight: 0.4 }],
    actions: [
      { _id: "b1", t: t(95), type: "triage", by: "agent", detail: "HOLD: Out of pattern, small amount." },
      { _id: "b2", t: t(95), type: "hold", by: "agent", detail: "Paused $300 at Bay Cycles." },
      { _id: "b3", t: t(93), type: "verify", by: "member", detail: "Identity verified from her credit-file answers" },
      { _id: "b4", t: t(92), type: "release", by: "member", detail: "She is buying a bike for her grandson Leo's birthday" },
    ],
    transcript: [],
  };

  const robert: CaseDetail = {
    _id: "s-robert", member_name: "Robert Chen", merchant: "Target Gift Cards", category: "gift_card", amount: 100,
    opened_at: t(130), status: "allowed", state: state(),
    plan: "", decision_rationale: "He buys $50-100 gift cards for grandchildren every year; this matches that pattern.",
    risk_signals: [{ source: "nessie", fact: "Gift cards at $50-100 appear in each of the last 3 years", weight: 0.1 }],
    actions: [{ _id: "r1", t: t(130), type: "triage", by: "agent", detail: "ALLOW: Matches his yearly gift card pattern." }],
    transcript: [],
  };

  const big: CaseDetail = {
    _id: "s-big", member_name: "Dolores Whitcomb", merchant: "Bay Cycles", category: "sporting_goods", amount: 1500,
    opened_at: t(210), status: "open", state: state({ verified: true }),
    plan: "Hold, call, verify. Over $1,000, so an analyst releases it.",
    decision_rationale: "Five times her largest purchase.",
    risk_signals: [{ source: "nessie", fact: "$1,500 is 5x her largest purchase in 90 days", weight: 0.6 }],
    actions: [
      { _id: "g1", t: t(210), type: "hold", by: "agent", detail: "Paused $1,500 at Bay Cycles." },
      { _id: "g2", t: t(205), type: "verify", by: "member", detail: "Identity verified from her credit-file answers" },
      { _id: "g3", t: t(204), type: "deny", by: "gate", detail: "member tried to release: $1,500 is at or over $1,000; an analyst must release it" },
    ],
    transcript: [],
  };

  const details = [gift, shield, bike, robert, big];
  const cases: Case[] = details.map((d) => ({ ...d, actions: undefined, transcript: undefined }));

  const stats: Stats = {
    total: 5, allowed: 1, held: 4, open: 1, released: 1, memberReleases: 1, escalated: 2, confirmedFraud: 0,
    heldByRule: 1, gateDenials: 2, medianMinutesToResolve: 3,
  };

  const arena: Arena = {
    calls: {
      t: now - 40 * MIN,
      summary: "30 calls, 30 passed. Scams or attacks released or verified: 0 of 20. Real members with the wrong outcome: 0 of 10.",
      rows: [
        { scenario: "coached_victim", kind: "scam", passed: 3, runs: 3, critical: 0, misses: "" },
        { scenario: "grandparent_scam", kind: "scam", passed: 3, runs: 3, critical: 0, misses: "" },
        { scenario: "impostor_callback", kind: "attack", passed: 3, runs: 3, critical: 0, misses: "" },
        { scenario: "prompt_injection", kind: "attack", passed: 3, runs: 3, critical: 0, misses: "" },
        { scenario: "legit_bike", kind: "legit", passed: 3, runs: 3, critical: 0, misses: "" },
        { scenario: "legit_over_limit", kind: "legit", passed: 3, runs: 3, critical: 0, misses: "" },
      ],
    },
    shield: { t: now - 38 * MIN, summary: "Scam Shield: caught 5/5 scam calls, false alarms 0/5 (threshold 0.8)", rows: [] },
  };

  const review: Review = {
    _id: "sample-review",
    started_at: now - 3 * 60 * MIN, trigger: "overrides", status: "proposed",
    steps: [
      "Droid started: 5 cases, policy.md (14 lines)",
      "tools: Edit",
      "allowed: EditAction",
      "I changed one line: Dolores has now bought a bike for a grandchild's birthday, so small sporting goods purchases are weaker evidence.",
    ],
    summary: "Changed one member note: a $300 bike for her grandson's birthday was a false positive. Gift card guidance is unchanged.",
    customers: [
      { member_id: "dolores", member_name: "Dolores Whitcomb", status: "proposed", summary: "Treat small sporting-goods gifts around her grandson’s birthday as weaker risk signals. Her verified $300 bicycle purchase was a false positive. Gift-card safeguards remain unchanged." },
      { member_id: "robert", member_name: "Robert Chen", status: "no_change", summary: "No change proposed. Small gift-card purchases remain consistent with his established spending history." },
    ],
    diff:
      "--- policy.md\n+++ policy.md (proposed)\n@@ -11,2 +11,3 @@\n ## Member notes\n - Dolores Whitcomb: groceries, pharmacy, utilities, church and the occasional cafe. No gift cards, electronics or wires ever.\n+  Her grandson Leo's birthday is Oct 26, so a small gift such as a bike is expected (case Bay Cycles $300, released by her).\n",
  };

  return { details, cases, stats, arena, review };
}

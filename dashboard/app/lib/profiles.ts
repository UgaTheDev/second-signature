export type Profile = { age: number; sub: string; contact: string | null; shield: boolean; pattern: string[]; note: string };

// Baseline profiles from server/members.py and server/policy.md.
export const MEMBER_PROFILES: Record<string, Profile> = {
  "Dolores Whitcomb": {
    age: 74,
    sub: "Member since 1991 · Santa Barbara · lives alone",
    contact: "Susan · daughter",
    shield: true,
    pattern: ["Groceries", "Pharmacy", "Utilities", "Church", "Café"],
    note: "Never gift cards, electronics or wires. Grandson Leo’s birthday is Oct 26.",
  },
  "Robert Chen": {
    age: 71,
    sub: "Member",
    contact: null,
    shield: false,
    pattern: ["Groceries", "Gift cards for grandkids, $50–100"],
    note: "Buys gift cards every Christmas and birthday.",
  },
};


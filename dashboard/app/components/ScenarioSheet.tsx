"use client";

import { useState } from "react";
import { post } from "../lib/api";
import { Button, Dialog, useToast } from "./ui";

const CATEGORIES = ["gift_card", "electronics", "wire_transfer", "crypto", "groceries", "pharmacy", "sporting_goods", "restaurant", "other"];
type Scenario = { member_id: string; merchant: string; category: string; amount: string; note: string };
const PRESETS: [string, string, Scenario][] = [
  ["$500 gift cards", "Dolores has never bought gift cards: held by rule", { member_id: "dolores", merchant: "Target Gift Cards", category: "gift_card", amount: "500", note: "" }],
  ["$300 bike", "Out of pattern but ordinary: the agent calls and she can release it", { member_id: "dolores", merchant: "Bay Cycles", category: "sporting_goods", amount: "300", note: "" }],
  ["$100 gift card for Robert", "He buys these every year: let through", { member_id: "robert", merchant: "Target Gift Cards", category: "gift_card", amount: "100", note: "" }],
];

const FIELD = "mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-[15px] text-ink";

export function ScenarioSheet({ open, onClose, demo }: { open: boolean; onClose: () => void; demo: boolean }) {
  const [f, setF] = useState<Scenario>(PRESETS[0][2]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: keyof Scenario) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      toast("Sample data is on, so nothing was sent. Switch to live data to run a real scenario.", true);
      return;
    }
    setBusy(true);
    const err = await post("/scenario", { ...f, amount: parseInt(f.amount, 10) });
    setBusy(false);
    if (err) toast(err, true);
    else {
      toast("Purchase sent to the bank sandbox. The case appears in a few seconds.");
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Run a scenario" side>
      <p className="mb-4 text-ink-2">Posts a real purchase to the bank sandbox. The agent picks it up within two seconds.</p>
      <fieldset className="mb-6">
        <legend className="mb-2 font-medium">Start from an example</legend>
        <ul className="divide-y divide-line border-y border-line">
          {PRESETS.map(([label, why, s]) => (
            <li key={label}>
              <button type="button" onClick={() => setF(s)} className="block w-full py-3 text-left hover:bg-raise">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-ink-2">{why}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-ink-2">
          Member
          <select value={f.member_id} onChange={set("member_id")} className={FIELD}>
            <option value="dolores">Dolores Whitcomb, 74</option>
            <option value="robert">Robert Chen, 71</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-ink-2">
          Merchant
          <input required value={f.merchant} onChange={set("merchant")} className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-ink-2">
            Category
            <select value={f.category} onChange={set("category")} className={FIELD}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink-2">
            Amount (dollars)
            <input required type="number" min={1} step={1} value={f.amount} onChange={set("amount")} className={FIELD} />
          </label>
        </div>
        <label className="block text-sm font-medium text-ink-2">
          Note <span className="font-normal text-ink-3">(optional)</span>
          <input value={f.note} onChange={set("note")} className={FIELD} />
        </label>
        <Button variant="primary" type="submit" disabled={busy} className="w-full">
          {busy ? "Sending…" : "Send purchase"}
        </Button>
      </form>
    </Dialog>
  );
}

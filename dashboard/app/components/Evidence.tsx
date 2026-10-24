"use client";

import { Check, X } from "lucide-react";
import { useArena } from "../lib/data";
import { words } from "../lib/format";

// Cell text: "+ note" allowed (note optional), "- note" never allowed, "" not part of this role.
const MATRIX: [string, string, string, string][] = [
  ["Read transactions and identity signals", "+", "", ""],
  ["Place a hold on a pending purchase", "+ for at most 1 business day", "", ""],
  ["Call the member, after verifying who she is", "+", "", ""],
  ["Listen to calls on her protected line", "+ she opted in; callers are told; kept in memory only", "", ""],
  ["Whisper a scam warning only she can hear", "+", "", ""],
  ["Call her trusted family contact", "+ only on red flags or 2 unanswered calls", "", ""],
  ["Connect her live to that contact (the agent then leaves the call)", "", "+ once verified, and only if she asks", ""],
  ["Release a hold under $1,000 (not a first-ever gift card, wire or crypto)", "", "+ after verification", ""],
  ["Release any other hold", "", "", "+"],
  ["Move, refund or send money", "- never", "- never", "+ only outside this system"],
  ["Close or freeze the account", "- never", "", "+ only outside this system"],
];

function Cell({ v }: { v: string }) {
  if (!v) return <span className="text-ink-3">–</span>;
  const yes = v.startsWith("+");
  const note = v.slice(1).trim();
  return (
    <span className="flex items-start gap-2">
      {yes ? (
        <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-ok" aria-label="Allowed" />
      ) : (
        <X size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" aria-label="Never allowed" />
      )}
      <span className={yes ? "text-ink-2" : "text-danger"}>{note}</span>
    </span>
  );
}

function PermissionMatrix() {
  return (
    <section aria-label="Permission matrix">
      <h2 className="font-display text-2xl font-semibold">What the agent is allowed to do</h2>
      <p className="mt-1 mb-4 max-w-[62ch] text-ink-2">
        Enforced in code (<code className="font-mono text-sm">server/gate.py</code>), not in the prompt. A refusal is written to the case file.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line text-sm text-ink-2">
              <th className="py-2 pr-6 font-medium">Action</th>
              <th className="py-2 pr-6 font-medium">The agent alone</th>
              <th className="py-2 pr-6 font-medium">With the member&apos;s yes</th>
              <th className="py-2 font-medium">A human analyst</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row[0]} className="border-b border-line align-top">
                <th scope="row" className="py-3 pr-6 font-medium">{row[0]}</th>
                {row.slice(1).map((cell, i) => (
                  <td key={i} className="py-3 pr-6">
                    <Cell v={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Arena() {
  const a = useArena();
  return (
    <section aria-label="Red-team arena">
      <h2 className="font-display text-2xl font-semibold">Tested against scammers</h2>
      <p className="mt-1 mb-4 text-ink-2">Claude plays scammers, impostors and real members against the same call brain that answers real calls.</p>
      {!a || (!a.calls && !a.shield) ? (
        <p className="text-ink-2">
          No run has been published. Run <code className="font-mono text-sm">uv run python arena.py -n 3 --publish</code> in <code className="font-mono text-sm">server/</code>.
        </p>
      ) : (
        <div className="space-y-4">
          {a.calls && (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-2">
                    <th className="py-2 pr-4 font-medium">Scenario</th>
                    <th className="py-2 pr-4 font-medium">Passed</th>
                    <th className="py-2 font-medium">Got through</th>
                  </tr>
                </thead>
                <tbody>
                  {a.calls.rows.map((r) => (
                    <tr key={r.scenario} className="border-b border-line" title={r.misses}>
                      <th scope="row" className="py-2 pr-4 font-normal">{words(r.scenario)}</th>
                      <td className="num py-2 pr-4">{r.passed} of {r.runs}</td>
                      <td className={`num py-2 ${r.critical ? "font-semibold text-danger" : "text-ink-2"}`}>{r.critical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-ink-2">
                {a.calls.summary} Run {new Date(a.calls.t).toLocaleString()}.
              </p>
            </>
          )}
          {a.shield && <p className="text-sm text-ink-2">{a.shield.summary}</p>}
        </div>
      )}
    </section>
  );
}

function RealVsSimulated() {
  const real = [
    "Phone calls (Twilio), voice and speech recognition (Cartesia), reasoning (Claude)",
    "CRS credit-bureau sandbox calls on test identities",
    "Holds and the permission gate, enforced in our code",
  ];
  const sim = [
    "The credit union, and Dolores (a CRS test identity)",
    "The bank: Nessie is Capital One's sandbox, not a real core system",
    "The scammer (a teammate)",
    "Holds don't reach a card network",
  ];
  return (
    <section aria-label="What is real">
      <h2 className="font-display text-2xl font-semibold">What is real, what is simulated</h2>
      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        {(
          [
            ["Real", real],
            ["Simulated", sim],
          ] as const
        ).map(([title, items]) => (
          <div key={title}>
            <h3 className="mb-2 font-medium">{title}</h3>
            <ul className="space-y-2 text-ink-2">
              {items.map((t) => (
                <li key={t} className="border-l-2 border-line pl-4">{t}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Evidence() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-14 px-6 py-8">
      <PermissionMatrix />
      <div className="grid gap-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Arena />
        <RealVsSimulated />
      </div>
    </div>
  );
}

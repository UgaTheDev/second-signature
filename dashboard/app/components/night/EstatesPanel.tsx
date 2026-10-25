"use client";

// Estate desk: closes a deceased member's books against Treasury's FS-133 (server/estate.py writes compute() output).
import { useContext, useState } from "react";
import { post, postJson } from "../../lib/api";
import { DemoContext, useEstateJournal, useEstates } from "../../lib/data";
import { toneVar } from "../../lib/derive";
import { cents, shortClock } from "../../lib/format";
import type { Estate, EstateRow } from "../../lib/types";
import { Dialog, useToast } from "../ui";
import { Btn, SectionHead, Stamp, type Tone } from "./primitives";

const DECISION: Record<Estate["decision"], { label: string; tone: Tone }> = {
  return_and_protest: { label: "Return and protest", tone: "amber" },
  return_in_full: { label: "Return in full", tone: "ink" },
  recipient_alive: { label: "Recipient alive", tone: "green" },
};
const BASIS: Record<Estate["liability_basis"], string> = {
  knowledge: "knew of the death before the payments posted",
  limited_45_day: "no prior knowledge, capped at the 45-day amount",
  none: "nothing owed",
};
const TH = "py-2.5 pr-4 font-normal";
const TD = "py-2.5 pr-4 align-top";
const r2 = (n: number) => Math.round(n * 100) / 100;
const ids = (xs: ({ id: string } | string)[]) => xs.map((x) => (typeof x === "string" ? x : x.id)).join(", ");

export function EstatesPanel() {
  const demo = useContext(DemoContext);
  const rows = useEstates();
  const toast = useToast();
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [why, setWhy] = useState<Record<string, Why>>({});
  const [confirm, setConfirm] = useState(false);

  const row = rows?.find((r) => r.key === sel) ?? rows?.find((r) => r.key === "harold") ?? rows?.[0];
  const score = rows?.map((r) => r.data?.score).find(Boolean);

  async function act(name: string, fn: () => Promise<string | null>, ok: string) {
    if (demo) return toast("Sample data is on, so nothing was sent.", true);
    setBusy(name);
    const err = await fn();
    setBusy(null);
    toast(err ?? ok, Boolean(err));
  }
  const run = () => act("run", () => post("/estates/run"), "Estate desk ran. Drafts are below.");

  // Same two panes as the cases view: estates on the left, the selected one on the right, each scrolling on its own.
  return (
    <div className="flex flex-wrap lg:h-full lg:flex-nowrap">
      <aside aria-label="Estates" className="min-w-[280px] max-w-full flex-[1_1_320px] border-r border-line lg:overflow-y-auto">
        <EstateList rows={rows} active={row?.key} onSelect={setSel} score={score} busy={busy} onRun={run} />
      </aside>
      <section aria-label="The estate" className="min-w-0 flex-[3_1_640px] lg:overflow-y-auto">
        <div className="px-10 pt-8 pb-14 max-sm:px-4">
          {rows === undefined ? (
            <p className="text-[14px] text-muted">Loading…</p>
          ) : !row ? (
            <div className="flex flex-col items-start gap-3 border-y border-line py-10">
              <span className="text-[15px]">No estates yet.</span>
              <span className="text-[13px] text-muted">Run the estate desk to reconcile Harold Whitcomb&apos;s death, his Social Security deposits and Treasury&apos;s reclamation notice.</span>
              <Btn size="sm" disabled={busy !== null} onClick={run}>{busy === "run" ? "Running…" : "Run estate desk"}</Btn>
            </div>
          ) : (
            <>
              <EstateView
                row={row}
                why={why[row.key]}
                busy={busy}
                onWhy={() =>
                  act("why", async () => {
                    const r = await postJson<Why>(`/estates/${row.key}/why`);
                    if (typeof r === "string") return r;
                    setWhy((w) => ({ ...w, [row.key]: r }));
                    return null;
                  }, "Explanation ready.")
                }
                onSign={() => setConfirm(true)}
                onCall={() => act("call", () => post(`/estates/${row.key}/call`), "Calling Dolores.")}
              />
              <Dialog open={confirm} onClose={() => setConfirm(false)} title="Sign as controller">
                <p className="mb-6 text-[14px] text-muted">
                  Posts {row.data.journal.length} journal lines to the ledger
                  {row.data.cu_liability > 0 && <> and signs a <span className="num font-mono text-ink">{cents(row.data.cu_liability)}</span> reclamation loss</>}. This can&apos;t be undone here.
                </p>
                <div className="flex justify-end gap-3">
                  <Btn variant="quiet" onClick={() => setConfirm(false)}>Cancel</Btn>
                  <Btn
                    variant="ink"
                    onClick={() => {
                      setConfirm(false);
                      act("sign", () => post(`/estates/${row.key}/sign`, { by: "Controller" }), "Signed and posted.");
                    }}
                  >
                    Sign and post
                  </Btn>
                </div>
              </Dialog>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Left pane: the run button, the planted-error score and one row per estate (selected row styled like the Ledger's). */
function EstateList({ rows, active, onSelect, score, busy, onRun }: {
  rows: EstateRow[] | undefined; active?: string; onSelect: (k: string) => void;
  score?: Estate["score"]; busy: string | null; onRun: () => void;
}) {
  return (
    <div>
      <div className="px-6 pt-6 pb-4">
        <SectionHead
          title="Estate desk"
          aside={<Btn size="sm" variant="quiet" disabled={busy !== null} onClick={onRun}>{busy === "run" ? "Running…" : "Run estate desk"}</Btn>}
        />
        {score && (
          <div className="mt-4">
            <Stamp label={`${score.correct}/${score.total} planted errors caught`} tone={score.correct === score.total ? "green" : "red"} size="sm" />
          </div>
        )}
        <p className="mt-3 text-[13px] text-pretty text-muted">
          Two people want Harold&apos;s money: a scammer and the US Treasury. Only one of them is owed it. The desk drafts; only the controller posts.
        </p>
      </div>
      {rows === undefined ? (
        <p className="px-6 pt-2 pb-10 text-[14px] text-muted">Loading…</p>
      ) : !rows.length ? (
        <p className="px-6 pt-2 pb-10 text-[14px] text-muted">No estates yet.</p>
      ) : (
        <ul aria-label="Estates" className="flex flex-col border-t border-line pb-6">
          {rows.map((r) => {
            const d = DECISION[r.data.decision] ?? DECISION.return_in_full;
            const on = r.key === active;
            return (
              <li key={r.key} className="border-b border-line">
                <button
                  type="button"
                  onClick={() => onSelect(r.key)}
                  aria-current={on ? "true" : undefined}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 py-3 pr-6 pl-6 text-left transition-colors hover:bg-panel2/60 ${on ? "border-l-amber bg-panel2" : "border-l-transparent"}`}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-[14px] leading-snug">{r.data.name}</span>
                    <span className="text-[12px]" style={{ color: toneVar(d.tone) }}>{d.label}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`num font-mono text-[13px] ${r.data.cu_liability > 0 ? "" : "text-muted"}`}>{cents(r.data.cu_liability)}</span>
                    {r.status === "signed" && <Stamp label="Signed" tone="green" size="sm" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Why = { text: string; checked?: boolean };

function EstateView({ row, why, busy, onWhy, onSign, onCall }: {
  row: EstateRow; why?: Why; busy: string | null; onWhy: () => void; onSign: () => void; onCall: () => void;
}) {
  const e = row.data;
  const d = DECISION[e.decision] ?? DECISION.return_in_full;
  const signed = row.status === "signed";
  const posted = useEstateJournal(signed ? row.key : null);
  const notDue = r2(e.not_due.reduce((s, x) => s + x.amount, 0));
  const returned = r2(e.claimed - notDue - e.valid_claim);
  const dr = r2(e.journal.reduce((s, l) => s + l.dr, 0));
  const cr = r2(e.journal.reduce((s, l) => s + l.cr, 0));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-serif text-[20px] font-normal">{e.name}</h3>
        <Stamp label={d.label} tone={d.tone} size="md" />
        {signed && <span className="text-[13px] text-muted">Signed by {row.signed_by} · <span className="num font-mono">{row.signed_at ? shortClock(row.signed_at) : ""}</span></span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn size="sm" variant="quiet" disabled={busy !== null} onClick={onWhy}>{busy === "why" ? "Asking…" : "Why?"}</Btn>
          <Btn size="sm" variant={e.needs_controller ? "amber" : "ink"} disabled={busy !== null || signed} onClick={onSign}>
            {signed ? "Signed" : busy === "sign" ? "Signing…" : "Sign as controller"}
          </Btn>
          {e.decision !== "recipient_alive" && (
            <Btn size="sm" variant="quiet" disabled={busy !== null} onClick={onCall}>{busy === "call" ? "Dialing…" : "Call Dolores"}</Btn>
          )}
        </div>
      </div>

      {why && (
        <div className="ss-in max-w-[760px] border-l border-line pl-4">
          <p className="text-[14px] leading-[1.6] text-pretty whitespace-pre-line">{why.text}</p>
          <p className="mt-2 text-[12px] text-muted">
            {why.checked
              ? "Claude Opus · every citation and dollar amount checked against this estate's record before it reached you"
              : "From the rules engine's findings · Claude's answer was unavailable or cited something not in the record"}
          </p>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Block title="Reclamation">
          <dl className="flex flex-col text-[14px]">
            <Money label="Treasury claimed (FS-133)" n={e.claimed} />
            <Money label={`Not due${e.not_due.length ? ` · ${ids(e.not_due)}` : ""}`} n={-notDue || 0} />
            <Money label={`Already returned (R15)${e.already_returned.length ? ` · ${ids(e.already_returned)}` : ""}`} n={-returned || 0} />
            <Money label="Valid claim" n={e.valid_claim} strong />
            <Money label={`Returned now (on hand at notice ${cents(e.on_hand)})`} n={e.return_now} />
            <Money label="Shortfall" n={e.shortfall} />
            <Money label="Credit union liability" n={e.cu_liability} strong tone={e.cu_liability > 0 ? "text-red" : undefined} />
          </dl>
          <p className="text-[13px] text-muted">
            Basis: {BASIS[e.liability_basis] ?? e.liability_basis}.
            {e.needs_controller && " Over the $250 materiality line, so only the controller can sign it."}
          </p>
          {e.liability_without_note != null && e.liability_without_note !== e.cu_liability && (
            <p className="text-[13px] text-muted">
              Without {e.knowledge_source ?? "the earlier record"}, it would be capped at <span className="num font-mono text-ink">{cents(e.liability_without_note)}</span>.
            </p>
          )}
          {e.withdrawers.length > 0 && <p className="text-[13px] text-muted">Withdrawn by {e.withdrawers.join(", ")} (named on the FS-133 response).</p>}
        </Block>

        <Block title="Timeline">
          <Timeline e={e} />
        </Block>
      </div>

      <Block title="Sources">
        <Table head={["Source", "Says", "Trusted"]}>
          {e.sources.map((s) => (
            <tr key={s.id} className="border-b border-line">
              <td className={TD}><span className="block">{s.kind.replace(/_/g, " ")}</span><span className="font-mono text-[12px] text-muted">{s.id}</span></td>
              <td className={`${TD} text-pretty`}>{s.says}</td>
              <td className={TD}>
                <span className={s.trusted ? "text-green" : "text-red"}>{s.trusted ? "✓ Trusted" : "Not trusted"}</span>
                {s.why && <span className="block text-[12px] text-muted">{s.why}</span>}
              </td>
            </tr>
          ))}
        </Table>
      </Block>

      <Block title="Findings">
        <ol className="flex flex-col">
          {e.findings.map((f, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-b border-line py-2.5 text-[14px]">
              <span className="text-pretty">{f.text}</span>
              <span className="font-mono text-[12px] text-muted">{f.rule}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block title="Journal" aside={
        <span className={`text-[13px] ${dr === cr ? "text-green" : "text-red"}`}>
          {dr === cr ? "✓ Balanced" : "Not balanced"} · <span className="num font-mono">{cents(dr)} / {cents(cr)}</span>
        </span>
      }>
        {e.journal.length === 0 ? (
          <p className="text-[14px] text-muted">No entries: nothing to return.</p>
        ) : (
          <Table head={["Account", "Dr", "Cr", "Memo", "Source"]} min="min-w-[820px]">
            {e.journal.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className={`${TD} ${l.cr ? "pl-6" : ""}`}>{l.account}</td>
                <td className={`${TD} num text-right font-mono`}>{l.dr ? cents(l.dr) : ""}</td>
                <td className={`${TD} num text-right font-mono`}>{l.cr ? cents(l.cr) : ""}</td>
                <td className={`${TD} text-muted text-pretty`}>{l.memo}</td>
                <td className={`${TD} font-mono text-[12px] text-muted`}>{l.source}</td>
              </tr>
            ))}
          </Table>
        )}
        <p className="text-[13px] text-muted">
          {signed
            ? `Posted to the ledger: ${posted.length} lines by ${row.signed_by ?? "the controller"}.`
            : "Drafted by the agent. Nothing is posted until the controller signs."}
        </p>
      </Block>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h4 className="text-[14px] font-medium">{title}</h4>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Money({ label, n, strong, tone }: { label: string; n: number; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "border-t border-line font-medium" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className={`num font-mono ${tone ?? ""}`}>{n < 0 ? `− ${cents(-n)}` : cents(n)}</dd>
    </div>
  );
}

function Table({ head, min = "min-w-[640px]", children }: { head: string[]; min?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${head.join(", ")} (scrolls sideways)`}>
      <table className={`w-full ${min} border-collapse text-left text-[14px]`}>
        <thead>
          <tr className="border-b border-line text-[12px] text-muted">
            {head.map((h) => <th key={h} scope="col" className={`${TH} ${h === "Dr" || h === "Cr" ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Dated events on one line, with the date of death (red) and the date the CU knew (amber) drawn across it. */
function Timeline({ e }: { e: Estate }) {
  const ms = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const dates = [...e.timeline.map((t) => t.date), e.date_of_death, e.knowledge_date].filter((x): x is string => Boolean(x)).map(ms);
  if (!dates.length) return <p className="text-[14px] text-muted">No dated events.</p>;
  const lo = Math.min(...dates);
  const span = Math.max(...dates) - lo || 1;
  const x = (s: string) => `${((ms(s) - lo) / span) * 100}%`;
  const events = e.timeline.filter((t) => t.kind !== "death" && t.kind !== "knowledge").sort((a, b) => a.date.localeCompare(b.date)); // those two are pinned above
  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-1 h-14" aria-hidden>
        <div className="absolute inset-x-0 top-7 h-px bg-line" />
        {events.map((t, i) => (
          <span key={i} title={`${t.date} · ${t.label}`} className="absolute top-[25px] size-[5px] -translate-x-1/2 rounded-full bg-muted" style={{ left: x(t.date) }} />
        ))}
        {e.date_of_death && <Mark at={x(e.date_of_death)} label="Death" tone="red" top />}
        {e.knowledge_date && <Mark at={x(e.knowledge_date)} label="CU knew" tone="amber" />}
      </div>
      <ol className="flex flex-col text-[13px]">
        {e.date_of_death && <Event date={e.date_of_death} label={`Date of death${e.dod_source ? ` · per ${e.dod_source}` : ""}`} cls="text-red" />}
        {e.knowledge_date && <Event date={e.knowledge_date} label={`Credit union knew${e.knowledge_source ? ` · ${e.knowledge_source}` : ""}`} cls="text-amber" />}
        {events.map((t, i) => <Event key={i} date={t.date} label={t.label} />)}
      </ol>
    </div>
  );
}

function Mark({ at, label, tone, top }: { at: string; label: string; tone: Tone; top?: boolean }) {
  return (
    <span className="absolute inset-y-0" style={{ left: at, color: toneVar(tone) }}>
      <span className="absolute inset-y-0 w-px bg-current" />
      <span className={`absolute -translate-x-1/2 bg-bg px-1 text-[11px] whitespace-nowrap ${top ? "-top-1" : "-bottom-1"}`}>{label}</span>
    </span>
  );
}

function Event({ date, label, cls = "" }: { date: string; label: string; cls?: string }) {
  return (
    <li className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-line py-1.5">
      <span className={`num font-mono text-muted ${cls}`}>{date}</span>
      <span className={`text-pretty ${cls}`}>{label}</span>
    </li>
  );
}

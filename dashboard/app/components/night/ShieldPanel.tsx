"use client";

// Scam Shield: the most recent scam_call case. Armed for 24h from when the call was flagged (server/shield.py).
import { useEffect, useState } from "react";
import { countdown, firstName, isShield, SHIELD_THRESHOLD, shieldInfo, whisperText } from "../../lib/derive";
import { shortClock } from "../../lib/format";
import type { Case } from "../../lib/types";
import { SectionHead, Stamp } from "./primitives";

export function ShieldPanel({ cases, className = "" }: { cases: Case[] | undefined; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = (cases ?? []).filter(isShield).reduce<Case | null>((a, x) => (!a || x.opened_at > a.opened_at ? x : a), null);
  const info = c && shieldInfo(c);
  const armed = !!info && now < info.armedUntil;
  const conf = info?.confidence ?? null;

  const hot = conf != null && conf >= SHIELD_THRESHOLD;

  return (
    <section className={`flex flex-col gap-5 border-b border-line px-7 py-8 ${className}`}>
      <SectionHead
        id="shield"
        title="Scam Shield"
        aside={c && info ? <Stamp label={armed ? "Armed" : "Stood down"} tone={armed ? "amber" : "muted"} size="sm" rotate={0} /> : undefined}
      />

      {cases === undefined ? null : !c || !info ? (
        <p className="text-[14px] leading-[1.5] text-muted">
          No call has been flagged. When a scam script is heard on a member&apos;s protected line, it shows here.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted">
              Caller said · <span className="num font-mono">{shortClock(c.opened_at)}</span>
              {info.scamType ? ` · ${info.scamType}` : ""}
            </span>
            {info.quote ? (
              <blockquote className="border-l border-line pl-3.5 text-[15px] leading-[1.5] text-pretty italic">{info.quote}</blockquote>
            ) : (
              <p className="border-l border-line pl-3.5 text-[15px] leading-[1.5] italic">{c.decision_rationale}</p>
            )}
            <p className="text-[12.5px] text-muted">The only words kept. Caller audio is analysed in memory.</p>
          </div>

          {conf != null && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-muted">Detection · Claude Haiku</span>
                <span className={hot ? "text-red" : "text-amber"}>{conf}% confident</span>
              </div>
              <div
                className="relative h-2"
                role="meter"
                aria-label="Detection confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={conf}
                aria-valuetext={`${conf}%, threshold ${SHIELD_THRESHOLD}%`}
              >
                <div className="absolute inset-x-0 top-[3px] h-0.5 rounded-full bg-line" />
                <div className={`absolute top-[3px] left-0 h-0.5 rounded-full ${hot ? "bg-red" : "bg-amber"}`} style={{ width: `${Math.min(100, conf)}%` }} />
                <div className="absolute inset-y-0 w-px bg-muted" style={{ left: `${SHIELD_THRESHOLD}%` }} title={`${SHIELD_THRESHOLD}% threshold`} />
              </div>
              <span className="text-[12px] text-muted">Threshold {SHIELD_THRESHOLD}%</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 rounded-md bg-amber/8 px-4 py-3">
            <span className="text-[12px] text-muted">Whispered in her ear · the caller can&rsquo;t hear</span>
            <p className="text-[14px] leading-[1.5] text-pretty">{whisperText(firstName(c.member_name))}</p>
          </div>

          <p className="text-[13px] text-muted">
            {armed ? (
              <>
                Gift card, wire and crypto held by rule for <span className="num font-mono text-ink">{countdown(info.armedUntil - now)}</span>
              </>
            ) : (
              <>The 24-hour window closed at <span className="num font-mono">{shortClock(info.armedUntil)}</span>.</>
            )}
          </p>
        </>
      )}
    </section>
  );
}

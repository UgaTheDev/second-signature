"use client";

// 05 Scam Shield: the most recent scam_call case. Armed for 24h from when the call was flagged (server/shield.py).
import { useEffect, useState } from "react";
import { countdown, firstName, SHIELD_THRESHOLD, shieldInfo, whisperText } from "../../lib/derive";
import { isShieldCase, shortClock } from "../../lib/format";
import type { Case } from "../../lib/types";
import { Kicker, SectionHead, Stamp } from "./primitives";

export function ShieldPanel({ cases, className = "" }: { cases: Case[] | undefined; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const c = (cases ?? []).filter(isShieldCase).reduce<Case | null>((a, x) => (!a || x.opened_at > a.opened_at ? x : a), null);
  const info = c && shieldInfo(c);
  const armed = !!info && now < info.armedUntil;
  const conf = info?.confidence ?? null;

  return (
    <section className={`relative isolate flex flex-col gap-[22px] overflow-hidden border-b border-line px-7 py-[30px] ${className}`}>
      <SectionHead id="shield" num="05" title="Scam Shield" />
      {c && info && (
        <Stamp
          label={armed ? "ARMED" : "STOOD DOWN"}
          tone={armed ? "amber" : "muted"}
          size="sm"
          rotate={-8}
          pop={armed}
          className="absolute top-[30px] right-[26px]"
        />
      )}

      {cases === undefined ? null : !c || !info ? (
        <p className="font-serif text-[18px] leading-[1.4] text-muted italic">
          No call has been flagged. When a scam script is heard on a member&apos;s protected line, it shows here.
        </p>
      ) : (
        <>
          <div className="relative pt-6">
            <span aria-hidden className="absolute -top-[34px] -left-2.5 -z-10 font-serif text-[190px] leading-none text-amber/35">
              &ldquo;
            </span>
            <Kicker>
              CALLER SAID · {shortClock(c.opened_at)}
              {info.scamType ? ` · ${info.scamType.toUpperCase()}` : ""}
            </Kicker>
            {info.quote ? (
              <blockquote className="mt-2.5 font-serif text-[27px] leading-[1.2] tracking-[-.01em] text-pretty italic">{info.quote}</blockquote>
            ) : (
              <p className="mt-2.5 font-serif text-[22px] leading-[1.25] italic">{c.decision_rationale}</p>
            )}
            <p className="mt-2 text-[12.5px] text-muted">The only words kept. Caller audio is analysed in memory.</p>
          </div>

          {conf != null && (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <Kicker>DETECTION · CLAUDE HAIKU</Kicker>
                <span className={`num font-serif text-[44px] leading-[.85] tracking-[-.04em] ${conf >= SHIELD_THRESHOLD ? "text-red" : "text-amber"}`}>{conf}%</span>
              </div>
              <div
                className="relative h-4"
                role="meter"
                aria-label="Detection confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={conf}
                aria-valuetext={`${conf}%, threshold ${SHIELD_THRESHOLD}%`}
              >
                <div className="absolute inset-x-0 top-[7px] h-0.5 bg-line" />
                <div className={`absolute top-[5px] left-0 h-1.5 ${conf >= SHIELD_THRESHOLD ? "bg-red" : "bg-amber"}`} style={{ width: `${Math.min(100, conf)}%` }} />
                <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${SHIELD_THRESHOLD}%` }} />
              </div>
              <div className="font-mono text-[10.5px] font-medium tracking-[.12em] text-muted" style={{ paddingLeft: `calc(${SHIELD_THRESHOLD}% - 44px)` }}>
                {SHIELD_THRESHOLD}% THRESHOLD
              </div>
            </div>
          )}

          <div className="-mx-7 flex flex-col gap-2.5 bg-term px-7 py-5 text-term-ink">
            <span className="font-mono text-[10.5px] font-bold tracking-[.18em] text-amber">WHISPERED IN HER EAR · CALLER CAN&rsquo;T HEAR</span>
            <p className="font-serif text-[19px] leading-[1.45] text-pretty">{whisperText(firstName(c.member_name))}</p>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            {armed ? (
              <>
                <span className="text-[13.5px] text-muted">Gift card, wire and crypto held by rule for</span>
                <span className="num font-mono text-[16px] text-amber">{countdown(info.armedUntil - now)}</span>
              </>
            ) : (
              <span className="text-[13.5px] text-muted">The 24-hour window closed at {shortClock(info.armedUntil)}.</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

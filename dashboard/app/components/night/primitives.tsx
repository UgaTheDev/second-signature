// Night Ledger primitives. Server-safe (no hooks); Btn is a plain <button>, so it works in client trees.
import type { CSSProperties, ReactNode } from "react";
import { statusMeta, toneVar, type Tone } from "../../lib/derive";
import type { Status } from "../../lib/types";

export type { Tone };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---- Stamp: rotated rubber stamp, always label + colour ---------------------------------------------

const STAMP_SIZE = { sm: "px-2 py-1 text-[11px] border-2 outline-1 outline-offset-2", md: "px-3 py-1.5 text-[17px] border-[2.5px] outline-1 outline-offset-[3px]", lg: "px-4 py-2 text-[24px] border-[3px] outline-[1.5px] outline-offset-4" };

export function Stamp({
  status, label, tone, solid, size = "lg", rotate = -9, pop = false, className,
}: {
  status?: Status | "pending"; label?: string; tone?: Tone; solid?: boolean;
  size?: keyof typeof STAMP_SIZE; rotate?: number; pop?: boolean; className?: string;
}) {
  const m = status ? statusMeta(status) : null;
  const t = tone ?? m?.tone ?? "muted";
  const fill = solid ?? m?.solid ?? false;
  const c = toneVar(t);
  return (
    <span
      className={cx("inline-block font-mono font-bold leading-none tracking-[.18em] whitespace-nowrap outline-solid", STAMP_SIZE[size], pop && "ss-pop", className)}
      style={{ transform: `rotate(${rotate}deg)`, ["--ss-rot" as string]: `${rotate}deg`, borderColor: c, outlineColor: c, color: fill ? "var(--on-red)" : c, background: fill ? c : undefined, opacity: 0.92 } as CSSProperties}
    >
      {label ?? m?.label}
    </span>
  );
}

// ---- type ----------------------------------------------------------------------------------------------

/** Mono 11px uppercase, .18em tracking. */
export function Kicker({ children, tone = "muted", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("font-mono text-[11px] leading-none font-semibold tracking-[.18em] uppercase", className)} style={{ color: toneVar(tone) }}>
      {children}
    </span>
  );
}

/** "01 Tonight's ledger": amber italic serif numeral + serif title + hairline. `id` is the nav anchor. */
export function SectionHead({ num, title, aside, id, className }: { num: string; title: ReactNode; aside?: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={cx("flex scroll-mt-5 items-baseline gap-3.5 border-b border-line pb-3.5", className)}>
      <span className="font-serif text-[40px] leading-[.8] text-amber italic" aria-hidden>{num}</span>
      <h2 className="font-serif text-[28px] leading-none font-normal tracking-[-.015em]">{title}</h2>
      {aside != null && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

/** Huge outlined serif number (risk score, 10/10, initials). `size` in px or any CSS length. */
export function OutlinedNumber({
  value, tone = "amber", size = 120, stroke = 1.6, italic = false, className,
}: { value: ReactNode; tone?: Tone; size?: number | string; stroke?: number; italic?: boolean; className?: string }) {
  return (
    <span
      className={cx("font-serif leading-[.8] font-normal tracking-[-.06em] text-transparent", italic && "italic", className)}
      style={{ fontSize: typeof size === "number" ? `${size}px` : size, WebkitTextStroke: `${stroke}px ${toneVar(tone)}` }}
    >
      {value}
    </span>
  );
}

/** Label .......... value (dotted leader). */
export function DottedRow({ label, value, tone = "ink", className }: { label: ReactNode; value: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cx("flex items-baseline gap-2 text-[14px]", className)}>
      <span className="font-mono text-[11px] font-semibold tracking-[.18em] text-muted uppercase">{label}</span>
      <span className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-line" aria-hidden />
      <span style={{ color: toneVar(tone) }}>{value}</span>
    </div>
  );
}

// ---- marks -----------------------------------------------------------------------------------------------

/** CSS diamond dot. `pulse` = HELD heartbeat (ss-pulse). Decorative: pair it with a text label. */
export function Diamond({ tone = "amber", pulse = false, size = 7, className }: { tone?: Tone; pulse?: boolean; size?: number; className?: string }) {
  const c = toneVar(tone);
  return (
    <span
      aria-hidden
      className={cx("inline-block shrink-0 rotate-45", pulse && "ss-pulse", className)}
      style={{ width: size, height: size, background: c, ["--ss-pulse" as string]: c } as CSSProperties}
    />
  );
}

// Same deterministic bar set as the prototype (heights 10–33, staggered durations).
const BAR = Array.from({ length: 64 }, (_, i) => ({ h: (10 + ((i * 37) % 24)) / 34, dur: 0.7 + ((i * 13) % 7) / 10, delay: -((i * 0.17) % 1) }));

/** Speech waveform. Bars move only while `active`; static (and reduced-motion safe) otherwise. */
export function Waveform({ active, tone = "ink", bars = 28, height = 64, dashed = false, className }: { active: boolean; tone?: Tone; bars?: number; height?: number; dashed?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("flex items-center gap-1", className)} style={{ height }}>
      {BAR.slice(0, Math.min(bars, BAR.length)).map((b, i) => (
        <span
          key={i}
          className="flex-1 origin-center"
          style={{
            height: `${b.h * 100}%`,
            background: dashed ? "transparent" : toneVar(tone),
            border: dashed ? `1px dashed ${toneVar(tone)}` : undefined,
            animation: `ss-wave ${b.dur}s ease-in-out ${b.delay}s infinite`,
            animationPlayState: active ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}

const STROKE = {
  mark: { box: "0 0 150 16", d: ["M2 11 C 20 2, 34 15, 54 8 S 92 2, 110 10 S 140 11, 148 4"], w: 1.8, dur: 1.8 },
  seal: { box: "0 0 240 40", d: ["M6 28 C 30 6, 48 34, 70 20 S 110 6, 128 24 S 170 30, 190 14 S 226 18, 234 10"], w: 1.6, dur: 2 },
} as const;

/** Hand-drawn signature. `draw` animates it in (ss-draw). Size it with className. */
export function SignatureStroke({ variant = "mark", draw = true, tone = "amber", className }: { variant?: keyof typeof STROKE; draw?: boolean; tone?: Tone; className?: string }) {
  const s = STROKE[variant];
  return (
    <svg viewBox={s.box} aria-hidden className={cx("overflow-visible", className)}>
      {s.d.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          fill="none"
          stroke={i ? "var(--term-ink)" : toneVar(tone)}
          strokeOpacity={i ? 0.35 : 1}
          strokeWidth={i ? 1.2 : s.w}
          strokeLinecap="round"
          strokeDasharray={1}
          style={{ animation: draw ? `ss-draw ${s.dur}s ease-out ${i * 0.6}s both` : undefined }}
        />
      ))}
    </svg>
  );
}

// ---- buttons -----------------------------------------------------------------------------------------------

const BTN = {
  ink: "bg-ink text-bg hover:bg-amber hover:text-on-red",
  amber: "bg-amber text-on-red hover:bg-ink hover:text-bg",
  outline: "border border-amber text-amber hover:bg-amber hover:text-on-red",
  danger: "border-2 border-red text-red hover:bg-red hover:text-on-red",
  quiet: "border border-line text-ink hover:bg-panel2",
} as const;
const BTN_SIZE = { sm: "px-3.5 py-2 text-[11.5px]", md: "px-[22px] py-[15px] text-[12.5px]", lg: "px-[26px] py-4 text-[13px]" } as const;

/** Square mono-uppercase button. Defaults type="button". */
export function Btn({
  variant = "ink", size = "md", className, type = "button", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: keyof typeof BTN_SIZE }) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 font-mono leading-none font-bold tracking-[.16em] whitespace-nowrap uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant], BTN_SIZE[size], className,
      )}
    />
  );
}

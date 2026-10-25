// Minimal ledger primitives. Server-safe (no hooks); Btn is a plain <button>, so it works in client trees.
import type { ReactNode } from "react";
import { statusMeta, toneVar, type Tone } from "../../lib/derive";
import type { Status } from "../../lib/types";

export type { Tone };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** "HELD · LIVE" -> "Held · live". Leaves mixed-case strings and non-strings alone. */
export function sentence<T>(n: T): T {
  if (typeof n !== "string" || n !== n.toUpperCase() || n === n.toLowerCase()) return n;
  return (n.charAt(0) + n.slice(1).toLowerCase()) as T;
}

// ---- Stamp: flat status badge, always label + colour ----------------------------------------------------

const STAMP_SIZE = { sm: "px-1.5 py-[3px] text-[12px]", md: "px-2 py-1 text-[12px]", lg: "px-2.5 py-1 text-[13px]" };

/** Flat badge. `rotate` is accepted for API compatibility and ignored; `pop` fades in. HELD gets a static amber dot. */
export function Stamp({
  status, label, tone, solid, size = "lg", pop = false, className,
}: {
  status?: Status | "pending"; label?: string; tone?: Tone; solid?: boolean;
  size?: keyof typeof STAMP_SIZE; rotate?: number; pop?: boolean; className?: string;
}) {
  const m = status ? statusMeta(status) : null;
  const t = tone ?? m?.tone ?? "muted";
  const fill = solid ?? m?.solid ?? false;
  const c = toneVar(t);
  const text = label ?? m?.label ?? "";
  const dot = m?.pulse || text.toUpperCase() === "HELD";
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-[4px] border leading-none font-medium whitespace-nowrap", STAMP_SIZE[size], pop && "ss-pop", className)}
      style={{
        color: c,
        borderColor: `color-mix(in oklch, ${c} 40%, transparent)`,
        background: `color-mix(in oklch, ${c} ${fill ? 16 : 8}%, transparent)`,
      }}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full" style={{ background: c }} />}
      {sentence(text)}
    </span>
  );
}

// ---- type ----------------------------------------------------------------------------------------------

/** Sentence-case 12px label, muted by default. */
export function Kicker({ children, tone = "muted", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("text-[12px] leading-none font-medium", className)} style={{ color: toneVar(tone) }}>
      {sentence(children)}
    </span>
  );
}

/** "01  Tonight's ledger": small muted number + 20px serif title + hairline. `id` is the nav anchor. */
export function SectionHead({ title, aside, id, className }: { title: ReactNode; aside?: ReactNode; id?: string; className?: string }) {
  return (
    <div id={id} className={cx("flex scroll-mt-5 items-baseline gap-3 border-b border-line pb-3", className)}>
      <h2 className="font-sans text-[20px] leading-tight font-semibold tracking-[-.01em]">{title}</h2>
      {aside != null && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

/** Plain solid number (risk score, 10/10, initials) at half the requested size. `stroke` kept for API compatibility. */
export function OutlinedNumber({
  value, tone = "amber", size = 120, italic = false, className,
}: { value: ReactNode; tone?: Tone; size?: number | string; stroke?: number; italic?: boolean; className?: string }) {
  return (
    <span
      className={cx("num leading-none font-normal tracking-[-.02em]", italic && "italic", className)}
      style={{ fontSize: typeof size === "number" ? `${Math.round(size * 0.5)}px` : `calc(${size} * 0.5)`, color: toneVar(tone) }}
    >
      {value}
    </span>
  );
}

/** Label ... value, spaced apart. */
export function DottedRow({ label, value, tone = "ink", className }: { label: ReactNode; value: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 text-[14px]", className)}>
      <span className="text-[13px] text-muted">{sentence(label)}</span>
      <span style={{ color: toneVar(tone) }}>{value}</span>
    </div>
  );
}

// ---- marks -----------------------------------------------------------------------------------------------

/** Small static dot. `pulse` is accepted and ignored (no animation). Decorative: pair it with a text label. */
export function Diamond({ tone = "amber", size = 6, className }: { tone?: Tone; pulse?: boolean; size?: number; className?: string }) {
  return <span aria-hidden className={cx("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size, background: toneVar(tone) }} />;
}

// Same deterministic bar set as the prototype (heights 10–33, staggered durations).
const BAR = Array.from({ length: 64 }, (_, i) => ({ h: (10 + ((i * 37) % 24)) / 34, dur: 0.7 + ((i * 13) % 7) / 10, delay: -((i * 0.17) % 1) }));

/** Speech waveform. Bars move only while `active`; static (and reduced-motion safe) otherwise. */
export function Waveform({ active, tone = "ink", bars = 28, height = 64, dashed = false, className }: { active: boolean; tone?: Tone; bars?: number; height?: number; dashed?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("flex items-center gap-1 opacity-70", className)} style={{ height }}>
      {BAR.slice(0, Math.min(bars, BAR.length)).map((b, i) => (
        <span
          key={i}
          className="flex-1 origin-center rounded-full"
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
  mark: { box: "0 0 150 16", d: ["M2 11 C 20 2, 34 15, 54 8 S 92 2, 110 10 S 140 11, 148 4"], w: 1.1, dur: 1.2 },
  seal: { box: "0 0 240 40", d: ["M6 28 C 30 6, 48 34, 70 20 S 110 6, 128 24 S 170 30, 190 14 S 226 18, 234 10"], w: 1.1, dur: 1.2 },
} as const;

/** Thin hand-drawn signature (sidebar mark). `draw` animates it in once. Size it with className. */
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
          stroke={toneVar(tone)}
          strokeWidth={s.w}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeDasharray={1}
          style={{ animation: draw ? `ss-draw ${s.dur}s ease-out both` : undefined }}
        />
      ))}
    </svg>
  );
}

// ---- buttons -----------------------------------------------------------------------------------------------

const BTN = {
  ink: "bg-ink text-bg hover:opacity-85",
  amber: "bg-amber text-on-red hover:opacity-85",
  outline: "border border-amber/45 text-amber hover:bg-amber/10",
  danger: "border border-red/45 text-red hover:bg-red/10",
  quiet: "border border-line text-ink hover:bg-panel2",
} as const;
const BTN_SIZE = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-[14px]", lg: "h-10 px-5 text-[14px]" } as const;

/** Sentence-case button, 6px corners. Defaults type="button". */
export function Btn({
  variant = "ink", size = "md", className, type = "button", children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; size?: keyof typeof BTN_SIZE }) {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] leading-none font-medium whitespace-nowrap transition-[background-color,opacity] disabled:cursor-not-allowed disabled:opacity-50",
        BTN[variant], BTN_SIZE[size], className,
      )}
    >
      {sentence(children)}
    </button>
  );
}

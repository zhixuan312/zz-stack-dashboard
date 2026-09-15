import { type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { CHIP, type ChipTint } from '@/lib/tints';

/**
 * MetricCard — one cell of the status row, and usually the dominant object on
 * the page.
 *
 * ── THE TILE LAW ────────────────────────────────────────────────────────
 *   1. The VALUE is the tile. It is set in the display register, tabular, and
 *      is the largest thing on the screen. Everything else annotates it.
 *   2. The tile SAYS WHAT IT IS on its face: a title in sentence case and one
 *      line defining it. This was an uppercase mono label alone for a while, on
 *      the argument that a label is a column header rather than a title — and
 *      the reader then had to hover an `i` to learn what "Knowledge from work"
 *      counted. A definition behind a tooltip is a definition most people never
 *      read. The `help` string keeps the caveats; the face keeps the meaning.
 *   3. The unit lives in the note, never in the value. `412` + "milliseconds,
 *      p95" reads; `412ms p95` in 44px display type does not.
 *   4. **Each tile carries its own quiet tint**, on the icon chip and nowhere
 *      else. This was one accent per row for a while, because a previous design
 *      let every page pick a different colour for each of its four tiles and
 *      nothing stood out. The failure there was SATURATION, not variety: the
 *      chip is a soft `--*-tint` ground behind a `--*-deep` glyph, at 32px in
 *      the corner, which identifies the tile without competing with a 44px
 *      number. Use `emphasis` when one tile really does carry the finding.
 *   5. `tone="attention"` is for a metric that needs ACTION, and is orthogonal
 *      to tint. It is the status register, not the identity register.
 *   6. A mark earns its place only when the single number lies — a median with
 *      a long tail, a count that is really four categories. A mark that merely
 *      repeats the value is decoration. **A mark with parts carries its legend**:
 *      a six-colour bar with nothing naming the colours is not a chart.
 *   7. The FOOTER is the comparison, and it is absent rather than dashed when
 *      there is no comparable window. "was 33% · vs previous 24 hours" is what
 *      makes the delta above it checkable.
 *
 * THE STATUS TRIO STAYS RESERVED. `sage`/`amber`/`rose` mean good/warn/bad
 * everywhere in this system, so a tile takes one as its identity tint only when
 * it genuinely means that — Refusal rate is rose because refusals are bad. A
 * tile that is merely neutral takes a kit hue.
 */
const metricVariants = cva(
  'ds-spotlight relative flex flex-col gap-2 rounded-[var(--r-md)] border px-4 py-3.5',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface',
        // A left rail, not a filled block. A fully tinted tile is as loud as
        // the emphasised one, so a row with both has two things shouting and
        // the eye has to choose — which is the failure this whole ladder
        // exists to prevent.
        //
        // THE RAIL TAKES THE TILE'S OWN HUE, set inline below, because it used to be
        // amber always: a rose tile in attention had a rose chip, an amber rail, an
        // amber title and a red delta pill — three signals in two colours, on the one
        // tile whose job is to be unambiguous. A tile speaks in one colour.
        attention: 'border-line border-l-[3px] bg-surface',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

/** Which way the number moved, and whether that is good news HERE. */
interface MetricDelta {
  /** Pre-formatted, e.g. `+11.2%` or `−43ms`. */
  value: ReactNode;
  direction: 'up' | 'down' | 'flat';
  /**
   * Whether this movement is good. Domain-specific and NOT derivable from
   * direction: requests up is usually good, error rate up never is. Defaults to
   * `neutral`, which renders in the ink ladder and asserts nothing — the honest
   * default when the caller has not said.
   */
  sentiment?: 'good' | 'bad' | 'neutral';
}

export interface MetricCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof metricVariants> {
  label: ReactNode;
  value: ReactNode;
  /** A lucide icon, shown in a soft tinted chip beside the title. */
  icon?: ReactNode;
  /**
   * The tile's identity colour, on the icon chip only. A kit hue for a neutral
   * tile; a status hue ONLY where it genuinely means good / warn / bad.
   */
  tint?: ChipTint;
  /** One line defining the metric, on the face. Rule 2 — not everything fits in `help`. */
  description?: ReactNode;
  /** The unit and the comparison basis, e.g. "milliseconds, p95". */
  sublabel?: ReactNode;
  /** Movement against the previous period. */
  delta?: MetricDelta;
  /** The one tile in the row that carries the finding. At most one. */
  emphasis?: boolean;
  /** Zero / idle state — dims the value. "0 failures is good news, don't shout it." */
  muted?: boolean;
  /**
   * A small distribution under the value — a composition bar, a dot strip.
   *
   * RULE 6 OF THE TILE LAW: a mark earns its place only when the single number lies. A
   * median with a long tail, a count that is really four categories — those need the
   * shape shown, and the tile has room for it below the note. A mark that merely repeats
   * the value is decoration and belongs nowhere.
   */
  mark?: ReactNode;
  /**
   * RULE 7: the comparison, last in the tile — "was 33% · vs previous 24 hours".
   *
   * OMITTED, NEVER DASHED, when there is no comparable window. A row of four "was —"
   * lines reads as a broken page rather than as an absent comparison.
   */
  footer?: ReactNode;
  /**
   * The caveats, the definitions behind the definition, and which way is good.
   *
   * NOT the one-line meaning of the tile — that is `description`, on the face, because a
   * metric whose meaning is only inside a tooltip is a metric most readers never learn.
   * What belongs here is everything too long for the face: how the figure is derived,
   * what it excludes, and why a number that looks wrong is not.
   */
  help?: string;
}

const ARROW = { up: '↑', down: '↓', flat: '→' } as const;

/** The delta is a PILL, not loose text: it is the one thing read against the value. */
const SENTIMENT = {
  good: 'bg-[var(--sage-tint)] text-[var(--sage-deep)]',
  bad: 'bg-[var(--rose-tint)] text-[var(--rose-deep)]',
  neutral: 'bg-surface-2 text-ink-soft',
} as const;

export function MetricCard({
  label,
  value,
  icon,
  tint = 'accent',
  description,
  sublabel,
  delta,
  mark,
  footer,
  help,
  emphasis,
  tone,
  muted,
  className,
  ...rest
}: MetricCardProps) {
  const attention = tone === 'attention';
  // Soft ground, strong glyph — the house pattern for a tinted object, and quiet enough
  // at 32px that the number stays the loudest thing in the tile.
  const { bg, fg } = CHIP[tint];

  return (
    <div
      className={cn(metricVariants({ tone }), className)}
      style={attention ? { borderLeftColor: fg } : undefined}
      {...rest}
    >
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span
            aria-hidden
            style={{ background: bg, color: fg }}
            className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] [&_svg]:size-[1.125rem]"
          >
            {icon}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3
            className={cn('truncate text-[0.9375rem] font-semibold leading-tight', !attention && 'text-ink')}
            style={attention ? { color: fg } : undefined}
          >
            {label}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">{description}</p>
          ) : null}
        </div>

        {help ? (
          <span
            tabIndex={0}
            role="note"
            aria-label={help}
            title={help}
            className="grid size-[1.375rem] shrink-0 cursor-help place-items-center rounded-full border border-line text-[0.625rem] font-medium text-ink-faint hover:border-accent hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            i
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            't-stat',
            attention ? '' : muted ? '!text-ink-faint' : emphasis ? '!text-accent-deep' : '!text-ink',
          )}
          style={attention ? { color: fg } : undefined}
        >
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-[var(--r-pill)] px-2 py-0.5 text-[0.75rem] font-semibold tabular-nums',
              SENTIMENT[delta.sentiment ?? 'neutral'],
            )}
          >
            <span aria-hidden className="text-[0.6875rem]">{ARROW[delta.direction]}</span>
            {delta.value}
          </span>
        ) : null}
      </div>

      {sublabel ? <p className="text-[0.8125rem] leading-snug text-ink-soft">{sublabel}</p> : null}

      {mark ? <div className="mt-0.5">{mark}</div> : null}

      {footer ? (
        <p className="mt-auto border-t border-line pt-2 t-micro text-ink-faint">{footer}</p>
      ) : null}
    </div>
  );
}

/**
 * MetricRow — the status-section container. Auto-fits as many `min`-wide cells
 * as the row allows, wrapping down on narrow screens.
 */
export function MetricRow({
  min = '200px',
  className,
  children,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { min?: string }) {
  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

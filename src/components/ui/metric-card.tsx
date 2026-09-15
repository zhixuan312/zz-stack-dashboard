import { type HTMLAttributes, type ReactNode } from 'react';
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
 *   5. Every tile in a row is the SAME OBJECT. One silhouette, one frame, one
 *      rhythm; what varies is the tint on the chip and what the numbers say.
 *      A tile that needs singling out gets `emphasis`, which is one per row.
 *   6. A mark earns its place only when the single number lies — a median with
 *      a long tail, a count that is really four categories. A mark that merely
 *      repeats the value is decoration. **A mark with parts carries its legend**:
 *      a six-colour bar with nothing naming the colours is not a chart. And a
 *      ROW of tiles draws its marks in ONE shape — a distribution rendered as a
 *      cloud of dots beside three bars is a different species of object, and the
 *      row reads as untidy before anybody has read a number. Bands say a tail as
 *      well as dots do, in the grammar the rest of the row already speaks.
 *   7. The FOOTER is the comparison, and it is absent rather than dashed when
 *      there is no comparable window. "was 33% · vs previous 24 hours" is what
 *      makes the delta above it checkable.
 *
 * THE STATUS TRIO STAYS RESERVED. `sage`/`amber`/`rose` mean good/warn/bad
 * everywhere in this system, so a tile takes one as its identity tint only when
 * it genuinely means that — Refusal rate is rose because refusals are bad. A
 * tile that is merely neutral takes a kit hue.
 */
// THE HOUSE LIFT, which these tiles were not wearing. The signature here is the flat
// offset shadow — `3px 3px 0`, drawn rather than blurred, the same gesture as the
// rounded display face and the cream ground. The tiles had a hairline on white and no
// lift at all, which is what a dashboard looks like when nobody decided anything.
//
// A WARM EDGE, NOT AN INK ONE. `Card weight="hard"` puts a 2px ink ring under this
// shadow, and that is right for the ONE card that has to stop you. Four of them in a
// row read as a wireframe: the black competes with the display numerals, and on a
// cream ground it is the least warm thing on the page. `line-strong` plus the offset
// gives the same separation from the ground with none of the shouting.
/* THERE IS NO `tone`. There was: `attention` drew a 4px rail in the tile's own hue, and
 * recoloured the title and the number with it, when a metric crossed a threshold.
 *
 * It went because a tile wearing it stopped being this component and became a different
 * one — a fifth silhouette in a row of four, which a reader resolves by asking what is
 * wrong with THAT CARD before they have read its number. Four tiles have to read as four
 * of one thing.
 *
 * BE CLEAR ABOUT WHAT THAT COST, because the two survivors are not substitutes for it:
 * the tinted chip is IDENTITY (Refusal rate is rose at 0.1% too) and the delta pill is
 * DIRECTION (a 9.3% rate falling from 12% wears a sage pill). So the threshold itself no
 * longer has a visual anywhere — the number and the direction beside it carry the tile.
 * That is the deliberate trade, not an oversight. If a metric ever needs singling out
 * again, `emphasis` is the lever and it is one per row by construction. */
const metricFrame =
  'ds-spotlight relative flex flex-col gap-3 rounded-[var(--r-lg)] border border-line-strong '
  + 'bg-surface px-5 py-4 shadow-[var(--shadow-lg)]';

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

export interface MetricCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
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
  muted,
  className,
  ...rest
}: MetricCardProps) {
  // Soft ground, strong glyph — the house pattern for a tinted object, and quiet enough
  // at 32px that the number stays the loudest thing in the tile.
  const { bg, fg } = CHIP[tint];

  return (
    <div className={cn(metricFrame, className)} {...rest}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            aria-hidden
            style={{ background: bg, color: fg }}
            className="grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] [&_svg]:size-5"
          >
            {icon}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.9375rem] font-semibold leading-tight text-ink">
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

      {/* THE DELTA SITS BESIDE THE NUMBER, not at the far edge. `justify-between` pinned it
          to the right margin, so at a wide column the movement was separated from the value
          it describes by an inch of empty tile and the two stopped reading as one statement.
          They are one statement: "22%, and that is 7.1 points worse than last time." */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className={cn('t-stat', muted ? '!text-ink-faint' : emphasis ? '!text-accent-deep' : '!text-ink')}
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
        <p className="mt-auto t-micro text-ink-faint">{footer}</p>
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

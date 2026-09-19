import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CHIP, type ChipTint } from '@/lib/tints';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
 *      repeats the value is decoration. A mark's parts name themselves on hover
 *      and focus; a tile carries no legend row, because one that wraps in some
 *      tiles and not others makes the row ragged. And a
 *      ROW of tiles draws its marks in ONE shape — a distribution rendered as a
 *      cloud of dots beside three bars is a different species of object, and the
 *      row reads as untidy before anybody has read a number. Bands say a tail as
 *      well as dots do, in the grammar the rest of the row already speaks.
 *   7. The comparison lives ON the delta pill: hovering or focusing it gives
 *      the previous figure. It was a footer row for a while, and a row present
 *      in three tiles and absent in the fourth put the row out of alignment.
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
  /** The previous figure, e.g. `was 4.0%` — shown when the pill is hovered or focused. */
  was?: string;
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
   * The caveats, the definitions behind the definition, and which way is good.
   *
   * NOT the one-line meaning of the tile — that is `description`, on the face, because a
   * metric whose meaning is only inside a tooltip is a metric most readers never learn.
   * What belongs here is everything too long for the face: how the figure is derived,
   * what it excludes, and why a number that looks wrong is not.
   *
   * AN ARRAY IS PARAGRAPHS, and long help should use one. These run to well over a
   * thousand characters — how the median is taken, what it excludes, why a figure that
   * looks wrong is not — and a wall of that length is skipped rather than read. Each
   * entry becomes its own paragraph; a bare string is one paragraph.
   */
  help?: string | string[];
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
  help,
  emphasis,
  muted,
  className,
  ...rest
}: MetricCardProps) {
  // Soft ground, strong glyph — the house pattern for a tinted object, and quiet enough
  // at 32px that the number stays the loudest thing in the tile.
  const { bg, fg } = CHIP[tint];

  // A BUTTON IN A POPOVER, NOT A `title`. The native attribute renders an operating-system
  // box that the page cannot style and the browser TRUNCATES — the longest of these was cut
  // mid-word, so the sentence naming what the figure excludes was the one nobody could read.
  // It also only ever appeared on hover, which no touch device has.
  const paragraphs = help ? (Array.isArray(help) ? help : [help]) : [];
  const helpDot = paragraphs.length ? (
    <Popover>
      <PopoverTrigger
        aria-label={`How "${typeof label === 'string' ? label : 'this metric'}" is measured`}
        className="ml-auto grid size-[1.375rem] shrink-0 cursor-help place-items-center self-center rounded-full border border-line text-[0.625rem] font-medium text-ink-faint hover:border-accent hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent data-[state=open]:border-accent data-[state=open]:bg-accent data-[state=open]:text-white"
      >
        i
      </PopoverTrigger>
      <PopoverContent>
        {typeof label === 'string' ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
            How this is measured
          </p>
        ) : null}
        {/* THE FIRST PARAGRAPH CARRIES THE QUESTION AND WHICH WAY IS GOOD, so it is set as
            the lede: a reader who stops after one paragraph should still have the answer
            they opened this for. */}
        {paragraphs.map((p, i) => (
          <p key={i} className={cn(i === 0 && 'font-medium text-ink', i > 0 && 'mt-3')}>
            {p}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  ) : null;

  const pill = delta ? (
    <span
      tabIndex={delta.was ? 0 : undefined}
      aria-label={delta.was ? `${delta.value}, ${delta.was}` : undefined}
      className={cn(
        'inline-flex cursor-default items-center gap-0.5 rounded-[var(--r-pill)] px-2 py-0.5 text-[0.75rem] font-semibold tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-ink',
        SENTIMENT[delta.sentiment ?? 'neutral'],
      )}
    >
      <span aria-hidden className="text-[0.6875rem]">{ARROW[delta.direction]}</span>
      {delta.value}
    </span>
  ) : null;

  /* FIXED SLOTS. Every tile in a row has the same lines in the same places whatever its
     copy says: a one-line title, a one-line description, the number, a one-line detail,
     the mark. A slot is reserved even when it is empty, and text never wraps past its
     slot — the copy is written to fit the narrowest tile the row allows (see `Row`'s
     `1/4`), so the clip is a guard, not a layout. A line that wraps in one tile and
     not its neighbour is what makes a row look untidy. */
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
          <h3 className="overflow-hidden whitespace-nowrap text-[0.9375rem] font-semibold leading-tight text-ink">
            {label}
          </h3>
          <p className="mt-0.5 min-h-[1lh] overflow-hidden whitespace-nowrap text-[0.8125rem] leading-snug text-ink-soft">
            {description}
          </p>
        </div>
      </div>

      {/* THE DELTA SITS BESIDE THE NUMBER, not at the far edge — "22%, and that is 7.1
          points worse than last time" is one statement. The `i` takes the far edge
          instead: it used to sit in the title row, where it cost the title the width it
          needed to stay on one line. */}
      <div className="flex items-baseline gap-x-2.5">
        <span
          className={cn('t-stat', muted ? '!text-ink-faint' : emphasis ? '!text-accent-deep' : '!text-ink')}
        >
          {value}
        </span>
        {delta && delta.was ? (
          <Tooltip>
            <TooltipTrigger asChild>{pill}</TooltipTrigger>
            <TooltipContent>{delta.was}</TooltipContent>
          </Tooltip>
        ) : pill}
        {helpDot}
      </div>

      <p className="min-h-[1lh] overflow-hidden whitespace-nowrap text-[0.8125rem] leading-snug text-ink-soft">{sublabel}</p>

      {mark ? <div className="mt-auto">{mark}</div> : null}

    </div>
  );
}

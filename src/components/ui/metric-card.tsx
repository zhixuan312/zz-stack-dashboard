import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CHIP, type ChipTint } from '@/lib/tints';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * MetricCard — one cell of the status row, and usually the dominant object on
 * the page.
 *
 * The tile law:
 *   1. The value is the tile — display register, tabular, the largest thing on
 *      the screen. Everything else annotates it.
 *   2. The tile says what it is on its face: a title in sentence case and one
 *      line defining it. `help` keeps the caveats; the face keeps the meaning.
 *   3. The unit lives in the note, never in the value.
 *   4. Each tile carries its own quiet tint, on the icon chip and nowhere else:
 *      a soft `--*-tint` ground behind a `--*-deep` glyph, at 32px, so it
 *      identifies the tile without competing with the number.
 *   5. Every tile in a row is the same object — one silhouette, one frame, one
 *      rhythm. A tile that needs singling out gets `emphasis`, one per row.
 *   6. A mark earns its place only when the single number lies. A mark's parts
 *      name themselves on hover and focus, and a tile carries no legend row,
 *      because one that wraps in some tiles and not others makes the row
 *      ragged. A row of tiles draws its marks in one shape.
 *   7. The comparison lives on the delta pill: hovering or focusing it gives
 *      the previous figure, so no tile carries a footer row the others lack.
 *
 * `sage`/`amber`/`rose` mean good/warn/bad everywhere in this system, so a tile
 * takes one as its identity tint only where it genuinely means that. A tile that
 * is merely neutral takes a kit hue.
 */
// The house lift is the flat offset shadow — `3px 3px 0`, drawn rather than blurred.
//
// DELIBERATE: a warm edge, not an ink one. `Card weight="hard"` puts a 2px ink ring under
// this shadow, which is right for the one card that has to stop you; four in a row read as
// a wireframe. `line-strong` plus the offset separates from the ground without it.
/* DELIBERATE: there is no `tone`. A tile that recoloured itself on a threshold stopped
 * being this component and became a fifth silhouette in a row of four.
 *
 * The two survivors are not substitutes: the tinted chip is identity and the delta pill is
 * direction, so a threshold has no visual of its own. `emphasis` is the lever if a metric
 * needs singling out, and it is one per row. */
const metricFrame =
  'ds-spotlight relative flex flex-col gap-3 rounded-[var(--r-lg)] border border-line-strong '
  + 'bg-surface px-5 py-4 shadow-[var(--shadow-lg)]';

/** Which way the number moved, and whether that is good news for this metric. */
interface MetricDelta {
  /** Pre-formatted, e.g. `+11.2%` or `−43ms`. */
  value: ReactNode;
  direction: 'up' | 'down' | 'flat';
  /**
   * Whether this movement is good. Domain-specific and not derivable from
   * direction: requests up is usually good, error rate up never is. Defaults to
   * `neutral`, which renders in the ink ladder and asserts nothing.
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
   * tile; a status hue only where it genuinely means good / warn / bad.
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
   * Rule 6 of the tile law: a mark earns its place only when the single number lies — a
   * median with a long tail, a count that is really four categories.
   */
  mark?: ReactNode;
  /**
   * The caveats, the definitions behind the definition, and which way is good.
   *
   * Not the one-line meaning of the tile — that is `description`, on the face. What belongs
   * here is everything too long for the face: how the figure is derived, what it excludes,
   * and why a number that looks wrong is not.
   *
   * An array is paragraphs, and long help should use one: each entry becomes its own
   * paragraph, and a bare string is one paragraph.
   */
  help?: string | string[];
}

const ARROW = { up: '↑', down: '↓', flat: '→' } as const;

/** The delta is a pill, not loose text: it is the one thing read against the value. */
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
  // Soft ground, strong glyph — quiet enough at 32px that the number stays the loudest
  // thing in the tile.
  const { bg, fg } = CHIP[tint];

  // A button in a popover, not a `title`: the native attribute renders an unstyleable box the
  // browser truncates, and it only ever appears on hover, which no touch device has.
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
        {/* The first paragraph carries the question and which way is good, so it is set as
            the lede for a reader who stops after one. */}
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

  /* Fixed slots: every tile in a row has the same lines in the same places — a one-line
     title, a one-line description, the number, a one-line detail, the mark. A slot is
     reserved even when empty, and text never wraps past its slot. The copy is written to
     fit the narrowest tile the row allows (see `Row`'s `1/4`), so the clip is a guard. */
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

      {/* The delta sits beside the number, not at the far edge, because the two are one
          statement. The `i` takes the far edge, out of the title row, which needs its
          width to keep the title on one line. */}
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

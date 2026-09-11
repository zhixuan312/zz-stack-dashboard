import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Title } from '@/components/ui/typography';

/**
 * Card — the standard surface. `header`/`footer` slots sit on a sunk band so
 * actions and titles read as distinct zones from the body. Compose with
 * `CardHeader`/`CardTitle`/`CardContent`/`CardFooter`.
 *
 * ── THE WEIGHT LADDER ───────────────────────────────────────────────────
 * A surface has FOUR weights, and picking the right one is how a page gets a
 * reading order without shouting:
 *
 *   flat     no boundary at all — grouping by space alone. The quietest thing
 *            that is still a card. Reach for it first.
 *   default  a hairline. A real object with a real edge.
 *   soft     tinted fill, no border. Quiet CONTEXT beside the main content —
 *            a note, an assumption, a caveat.
 *   hard     a 2px ink edge and one offset. The single most important object
 *            on the page. At most one per screen.
 *
 * The rule that matters: whitespace groups before borders do. Add a boundary
 * only when the content has a real boundary. Four equal bordered cards is what
 * a page looks like when nobody decided what mattered.
 */
// Every card carries `ds-spotlight` — the hairline darkens to `line-strong` on
// hover. That is an acknowledgement, not an interactivity cue; `interactive`
// adds the pointer cursor on top for cards that are actually clickable.
const cardVariants = cva('ds-spotlight overflow-hidden rounded-[var(--r-lg)]', {
  variants: {
    weight: {
      flat: 'border border-transparent bg-transparent',
      default: 'border border-line bg-surface',
      soft: 'border border-transparent bg-surface-2',
      // The 2px edge is drawn as a ring rather than a border so the card's
      // internal box does not shift by 1px against its default-weight
      // neighbours — a row of tiles where one is `hard` would otherwise sit a
      // pixel out of line with the rest.
      hard: 'border border-ink bg-surface ring-1 ring-ink shadow-[var(--shadow-lg)]',
    },
    interactive: { true: 'cursor-pointer' },
  },
  defaultVariants: { weight: 'default' },
});

export function Card({
  className,
  weight,
  interactive,
  ...rest
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return <div className={cn(cardVariants({ weight, interactive }), className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-b border-line px-5 py-4', className)}
      {...rest}
    />
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Title as="h2" className={cn('!text-base', className)} {...(rest as object)}>
      {children}
    </Title>
  );
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5', className)} {...rest} />;
}

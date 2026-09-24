import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Title } from '@/components/ui/typography';

/**
 * Card — the standard surface. `header`/`footer` slots sit on a sunk band so
 * actions and titles read as distinct zones from the body. Compose with
 * `CardHeader`/`CardTitle`/`CardContent`/`CardFooter`.
 *
 * Four weights, lightest first:
 *
 *   flat     no boundary at all — grouping by space alone.
 *   default  a hairline. A real object with a real edge.
 *   soft     tinted fill, no border. Quiet context beside the main content.
 *   hard     a 2px ink edge and one offset. At most one per screen.
 *
 * Whitespace groups before borders do: add a boundary only when the content has
 * a real boundary.
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
      // DELIBERATE: the 2px edge is a ring, not a border, so the card's internal
      // box does not shift by 1px against its default-weight neighbours.
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

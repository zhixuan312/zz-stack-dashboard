import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

/**
 * One titled surface on a dashboard page — the unit every chart, list and table
 * sits in.
 *
 * A thin composition over `Card`, but a named one: the header/aside/body
 * arrangement was being respelled at every call site, which is how two panels
 * end up with different padding and nobody notices. Reach for `Panel` rather
 * than `Card` unless the surface genuinely has no title.
 */
export function Panel({
  title,
  /** Right-aligned in the header — a count, a link, a filter. */
  aside,
  children,
  className,
  /** `false` when the child is a table or list that must run edge to edge. */
  padded = true,
  // Rest props reach the Card — a component that quietly swallows unknown props
  // makes every `data-*` hook on it silently do nothing.
  ...rest
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
} & Omit<ComponentProps<typeof Card>, 'title' | 'children'>) {
  return (
    <Card className={cn('flex flex-col', className)} {...rest}>
      {/* `min-w-0` on the title and `shrink-0` on the aside, which is the pair that
          makes a two-part header survive a long title.
          Without them both children shrink proportionally, so a title long enough
          to wrap squeezed the aside until IT wrapped too — "node 19" broke across
          two lines beside a heading that had plenty of room to take another. The
          title is the part that may wrap; the meta beside it is a label and never
          should. */}
      <CardHeader className="items-start">
        <CardTitle className="min-w-0">{title}</CardTitle>
        {aside ? (
          <span className="shrink-0 text-right text-xs text-ink-faint">{aside}</span>
        ) : null}
      </CardHeader>
      {/* `padded={false}` when a table or list runs edge to edge.
          NO HORIZONTAL SCROLL, here or anywhere: a table that is wider than its card is a
          table with too many columns for that width, and the fix is `hideBelow` on the
          columns that matter least — see `TableHead`. */}
      <CardContent className={cn('min-w-0 flex-1', !padded && 'p-0')}>{children}</CardContent>
    </Card>
  );
}

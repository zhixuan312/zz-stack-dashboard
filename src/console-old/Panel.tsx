import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, CardContent, CardHeader, CardTitle } from '@/console-old/ui';

/**
 * One titled surface on a dashboard page — the unit every chart, list and table
 * sits in. A thin composition over `Card` that fixes the header/aside/body
 * arrangement. Reach for `Panel` rather than `Card` unless the surface genuinely
 * has no title.
 */
export function Panel({
  title,
  /** Right-aligned in the header — a count, a link, a filter. */
  aside,
  children,
  className,
  /** `false` when the child is a table or list that must run edge to edge. */
  padded = true,
  // Rest props reach the Card, so `data-*` hooks on a Panel land on the rendered element.
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
      {/* The title's 10rem basis is what lets the row wrap: with `min-w-0` alone a wide aside
          (a count plus a Segmented) squeezed "Refusals" to 9px at 390px and it painted under
          the aside. Now the aside drops to its own line, still right-aligned, before the
          title goes below one word; `max-w-full` lets a sentence aside wrap there rather than
          run past the card. */}
      <CardHeader className="flex-wrap items-start gap-y-2">
        <CardTitle className="min-w-0 flex-[1_1_10rem]">{title}</CardTitle>
        {aside ? (
          <span className="ml-auto max-w-full shrink-0 text-right text-xs text-ink-faint">{aside}</span>
        ) : null}
      </CardHeader>
      {/* `padded={false}` when a table or list runs edge to edge. No horizontal scroll,
          here or anywhere: a table wider than its card has too many columns for that
          width, and the fix is `hideBelow` on the columns that matter least — see
          `TableHead`. */}
      <CardContent className={cn('min-w-0 flex-1', !padded && 'p-0')}>{children}</CardContent>
    </Card>
  );
}

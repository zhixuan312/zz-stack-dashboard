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
  // Rest props reach the Card. This is how `data-rail-fill` gets through — the
  // rail's grow selector matches an attribute on the panel element, and a
  // component that quietly swallows unknown props makes that opt-in silently
  // do nothing.
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
      {/*
        `padded={false}` is this app's signal that a table or a full-bleed list
        lives here, so it also gets the horizontal scroll affordance.

        The alternative is wrapping each table in its own `overflow-x-auto` at
        the call site. That works but has to be remembered every time, and
        forgetting is silent: a 732px table in a 649px card at a 1280px viewport
        simply cuts off its last columns. Putting it here makes the mistake
        unavailable.

        Deliberately NOT on `Table` itself: `DataTable` renders a sticky header
        inside its own vertical scroller, and adding an inner scroll container
        would re-anchor `sticky top-0` and break it.
      */}
      <CardContent className={cn('min-h-0 flex-1', !padded && 'overflow-x-auto p-0')}>{children}</CardContent>
    </Card>
  );
}

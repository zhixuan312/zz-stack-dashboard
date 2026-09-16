import { type ReactNode } from 'react';
import { StatusDashboard, type StatusDashboardProps } from '@/components/patterns/status-dashboard';

/**
 * PageShell — the master-detail preset of the content shell.
 *
 *   left (2/3)  = the governed LEFT PANEL   (Card · DataTable · List · Form)
 *   right (1/3) = the note, then the RIGHT PANEL box
 *
 * It owns the split and nothing else. It deliberately does NOT build the rail from an item
 * array: a rail needs a header action, grouped sections and its own tiles, so it is a
 * component, passed in.
 */
interface PageShellProps {
  /** The rail note, above the right-panel box. */
  note?: ReactNode;
  /** The LEFT PANEL (2/3). Pass a governed left-panel component — it already renders its
   *  own Card, so PageShell adds none. */
  children: ReactNode;
  /** The RIGHT PANEL (1/3) — the box below the note. PageShell does not build the rail
   *  itself: a page needs header actions, grouped sections and tiles, which a flat item
   *  array cannot express. Omit it on an empty / loading state, where there is nothing to
   *  navigate yet. */
  navigator?: ReactNode;
  /** Metric row above the split — forwarded to the content shell. */
  metrics?: StatusDashboardProps['metrics'];
  /** Rendered last, inside the scroll region — forwarded to the content shell. */
  footer?: StatusDashboardProps['footer'];
  /** Column alignment — forwarded to the content shell. */
  align?: StatusDashboardProps['align'];
  /** Who owns the 2/3 column's scroll — see StatusDashboard. `inner` when one item fills
   *  the panel, `outer` when it stacks several cards. */
  scroll?: StatusDashboardProps['scroll'];
  /** Extra className for the outer grid. */
  className?: string;
}

export function PageShell({ note, children, navigator, metrics, footer, align, scroll, className }: PageShellProps) {
  return (
    <StatusDashboard
      className={className}
      metrics={metrics}
      footer={footer}
      align={align}
      scroll={scroll}
      // LEFT — the governed left panel (2/3). NOT wrapped in a Card: the component passed in
      // already is one, and a second would double-frame it.
      primary={children}
      // RIGHT — note above, then the navigator box (1/3).
      // Only claim the 1/3 column when there is something to put in it. This used to be an
      // unconditional fragment, which is truthy even when both slots are undefined, so
      // StatusDashboard's full-width branch was unreachable and a rail-less page rendered an
      // empty right third — the content ended up occupying about half the screen.
      aside={
        note || navigator ? (
          <>
            {note}
            {navigator}
          </>
        ) : undefined
      }
    />
  );
}

import { AppFooter } from '@/components/AppFooter';
import type { ReactNode } from 'react';
import { PageFrame } from '@/components/ui';
import type { Crumb, MetricCardProps } from '@/components/ui';
import { RailNote } from '@/components/patterns/feature-rail';
import { PageShell } from '@/components/patterns/page-shell';
import { PeriodSelect } from '@/components/PeriodSelect';
import { Freshness } from '@/components/ui/freshness';

/**
 * The one page scaffold every dashboard screen uses.
 *
 * Seven pages were each spelling out the same four-part composition, and the
 * combination has to be exactly right or the layout quietly breaks:
 *
 *   PageFrame  width="full" fill   the body must be HEIGHT-BOUNDED and must not
 *                                  scroll, because the panels below scroll
 *                                  themselves — without `fill`, `PageShell`'s
 *                                  `h-full flex-1` has no bound to fill and the
 *                                  whole grid collapses to content height
 *   PageShell  scroll="outer"      these pages STACK cards, so the 2/3 column
 *                                  owns the scroll; `inner` is for a single
 *                                  self-scrolling child such as a data table
 *   metrics                        the status row across the top
 *   note                           guidance, always the top of the 1/3 rail
 *
 * Getting `fill` or `scroll` wrong produces a page that renders without error
 * and simply looks wrong, so it belongs in one place rather than seven.
 */
export function DashboardPage({
  title,
  breadcrumb,
  description,
  note,
  noteIcon,
  noteTitle,
  metrics,
  actions,
  updatedAt,
  staleAfterMs,
  now,
  showPeriod = true,
  scroll = 'outer',
  rail,
  subnav,
  children,
}: {
  title: string;
  /**
   * The trail back up. A page reached by drilling in must say where it sits and
   * offer the way out, and a `← back` button in the actions cluster says only one
   * of those — from a skill it named its flow and never the list above it.
   */
  breadcrumb?: Crumb[];
  /** A real sentence, or nothing. Not a restatement of the period — the picker says that. */
  description?: ReactNode;
  /** Markdown for the rail note, in the house style: `###` sections, `- **Term** — gloss`. */
  note?: string;
  noteIcon?: ReactNode;
  noteTitle?: string;
  metrics?: MetricCardProps[];
  /** Extra header actions, placed left of the period picker. */
  actions?: ReactNode;
  /**
   * When this page's data was last refreshed. Rendered as a freshness stamp in
   * the header, left of the period picker.
   *
   * Pass it. A dashboard that does not say how old its numbers are cannot be
   * trusted, and a stalled pipeline and a quiet Tuesday both render as a flat
   * line. `null` means "never refreshed" and says so; omitting the prop hides
   * the stamp entirely, which should be reserved for a page whose data has no
   * refresh cadence at all — a settings form, not a metric.
   */
  updatedAt?: Date | string | null;
  /** Past this age the stamp turns amber. See `Freshness`. */
  staleAfterMs?: number;
  /**
   * Clock for the freshness stamp. Pass one when the page runs on a fixed clock
   * — a seeded demo, a test, a replayed incident window — so the relative time
   * is computed against the same instant the data was generated from.
   *
   * It also removes a hydration hazard: a relative timestamp derived from
   * `new Date()` is evaluated once on the server and again on the client, and at
   * a rollover boundary those two render different text.
   */
  now?: Date;
  /** Pages with no time dimension hide the picker. */
  showPeriod?: boolean;
  /** `inner` when a single child manages its own scroll — a full-height table. */
  scroll?: 'inner' | 'outer';
  /**
   * Extra panels for the 1/3 rail, below the note. `PageShell` calls this slot
   * the `navigator`. A page with neither `note` nor `rail` renders full-width,
   * which is what a wide table wants.
   */
  rail?: ReactNode;
  /**
   * A switcher band under the header — WHICH of a set of things this page is
   * showing. It belongs here rather than at the top of the body: a control that
   * scrolls away with the content it controls is content, and the reader loses
   * the ability to change what they are looking at as soon as they read any of
   * it.
   */
  subnav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageFrame
      title={title}
      breadcrumb={breadcrumb}
      description={description}
      width="full"
      fill
      actions={
        (actions || showPeriod || updatedAt !== undefined) && (
          <>
            {updatedAt !== undefined ? (
              <Freshness
                at={updatedAt}
                staleAfterMs={staleAfterMs}
                now={now}
                className="mr-1 hidden sm:flex"
              />
            ) : null}
            {actions}
            {/* No Suspense any more: the picker reads context, not searchParams, so it
                no longer de-opts this route to client rendering just to learn which
                window is selected. */}
            {showPeriod ? <PeriodSelect /> : null}
          </>
        )
      }
      subnav={subnav}
    >
      <PageShell
        scroll={scroll}
        metrics={metrics}
        footer={<AppFooter />}
        note={
          note ? (
            <RailNote icon={noteIcon} title={noteTitle}>
              {note}
            </RailNote>
          ) : undefined
        }
        navigator={rail}
      >
        {children}
      </PageShell>
    </PageFrame>
  );
}

import type { ReactNode } from 'react';
import { MetricCard, PageFrame, Row, Stack } from '@/components/ui';
import type { Crumb, MetricCardProps, PageWidth } from '@/components/ui';
import { PeriodSelect } from '@/components/PeriodSelect';
import { Freshness } from '@/components/ui/freshness';

/**
 * The one page scaffold every dashboard screen uses: the header, then the body as a stack
 * of rows — the metric row first when there is one, then whatever the page puts in
 * `children`, which is `Row`s of cards.
 *
 * IT HAS NO LAYOUT SWITCHES. It used to take `scroll`, `fill`, `align`, `rail` and `note`,
 * and each page picked a combination — so Teams scrolled inside its card, Overview scrolled
 * the page, and a page with a rail scrolled two columns independently. The page scrolls,
 * always, and a split is a `Row`. See `@/components/ui/layout`.
 */
export function DashboardPage({
  title,
  breadcrumb,
  description,
  metrics,
  actions,
  updatedAt,
  staleAfterMs,
  now,
  showPeriod = true,
  subnav,
  width = 'data',
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
  /**
   * A switcher band under the header — WHICH of a set of things this page is
   * showing. It belongs here rather than at the top of the body: a control that
   * scrolls away with the content it controls is content, and the reader loses
   * the ability to change what they are looking at as soon as they read any of
   * it.
   */
  subnav?: ReactNode;
  /** `reading` for a document, a form or prose — see `WIDTH`. */
  width?: PageWidth;
  children: ReactNode;
}) {
  return (
    <PageFrame
      title={title}
      breadcrumb={breadcrumb}
      description={description}
      width={width}
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
      <Stack>
        {metrics && metrics.length > 0 ? (
          <Row split="1/4">
            {metrics.map((m, i) => <MetricCard key={i} {...m} />)}
          </Row>
        ) : null}
        {children}
      </Stack>
    </PageFrame>
  );
}

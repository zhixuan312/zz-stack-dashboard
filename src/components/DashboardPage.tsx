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
 * DELIBERATE: no layout switches. The page scrolls, always, and a split is a `Row`. See
 * `@/components/ui/layout`.
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
   * offer the way out; a `← back` button says only the second.
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
   * `null` means "never refreshed" and says so; omitting the prop hides the stamp
   * entirely, which is for a page whose data has no refresh cadence at all — a
   * settings form, not a metric.
   */
  updatedAt?: Date | string | null;
  /** Past this age the stamp turns amber. See `Freshness`. */
  staleAfterMs?: number;
  /**
   * Clock for the freshness stamp. Pass one when the page runs on a fixed clock
   * — a seeded demo, a test, a replayed incident window — so the relative time
   * is computed against the instant the data was generated from. It also removes
   * a hydration hazard: a time derived from `new Date()` is evaluated on the
   * server and again on the client, which render different text at a rollover.
   */
  now?: Date;
  /** Pages with no time dimension hide the picker. */
  showPeriod?: boolean;
  /**
   * A switcher band under the header — which of a set of things this page is
   * showing. It belongs here rather than at the top of the body, because a
   * control that scrolls away with the content it controls is content.
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
            {/* No Suspense: the picker reads context rather than searchParams, so it does
                not de-opt this route to client rendering. */}
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

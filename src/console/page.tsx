'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { app } from '@/app.config';
import { PageFrame, Stack, type PageWidth } from '@/components/base/shell';
import { Freshness } from '@/components/patterns/freshness';
import { PeriodSelect } from '@/components/patterns/period-select';
import { useConsoleMode } from '@/lib/api';
import { usePeriod } from '@/console/period';

/** A step back up from a record: the list it belongs to, then the parent record. */
export type Crumb = { label: string; href?: string };

/**
 * Every console page: Meridian's `PageFrame` with the console's masthead conventions. The kicker says where the page
 * sits (the scope in view, or the trail back up from a record), the freshness stamp says when its data arrived, and
 * the period picker governs every figure on a page that has a time dimension.
 */
export function ConsolePage({
  title,
  description,
  crumbs,
  updatedAt,
  showPeriod = true,
  actions,
  toolbar,
  width = 'data',
  children,
}: {
  title: ReactNode;
  /** One sentence: what this page answers. */
  description?: ReactNode;
  /** The trail back up from a record; a top-level page leaves it out and the kicker names the scope. */
  crumbs?: Crumb[];
  /** When the page's data arrived (`freshnessOf`); `null` reads "never updated"; left out, no stamp. */
  updatedAt?: Date | null;
  /** Pages with no time dimension hide the picker. */
  showPeriod?: boolean;
  actions?: ReactNode;
  /** Tabs or filters that govern the whole page, in a band under the masthead. */
  toolbar?: ReactNode;
  /** `reading` for a document, a form or prose. */
  width?: PageWidth;
  children: ReactNode;
}) {
  const { mode } = useConsoleMode();
  const kicker = crumbs?.length ? (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i ? <span aria-hidden className="text-ink-3">/</span> : null}
          {c.href ? <Link href={c.href} className="hit rounded-xs hover:text-ink">{c.label}</Link> : <span className="min-w-0 [overflow-wrap:anywhere]">{c.label}</span>}
        </Fragment>
      ))}
    </span>
  ) : `${app.name} · ${mode === 'platform' ? 'The platform' : 'Your team'}`;
  return (
    <PageFrame
      title={title}
      description={description}
      kicker={kicker}
      width={width}
      toolbar={toolbar}
      meta={updatedAt !== undefined ? <Freshness updatedAt={updatedAt} staleAfterMs={10 * 60_000} /> : undefined}
      actions={actions || showPeriod ? <>{actions}{showPeriod ? <PagePeriod /> : null}</> : undefined}
    >
      <Stack>{children}</Stack>
    </PageFrame>
  );
}

/** The page's period control, held in the console's period context. */
function PagePeriod() {
  const { period, setPeriod } = usePeriod();
  return <PeriodSelect value={period} onChange={setPeriod} />;
}

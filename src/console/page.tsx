'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { app } from '@/app.config';
import { PageFrame, Stack, type PageWidth } from '@/components/base/shell';
import { Freshness } from '@/components/patterns/freshness';
import { PeriodSelect } from '@/components/patterns/period-select';
import { useConsoleMode, useDataClock } from '@/lib/api';
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
  /** `data` for a page read across the canvas, `form` for one whose head column and field-width card add up to a
   *  measure of their own, `reading` for one long document. */
  width?: PageWidth;
  children: ReactNode;
}) {
  const { mode } = useConsoleMode();
  // The data's clock, for the freshness stamp: never `new Date()` at render.
  const clock = useDataClock();
  const arriving = useStillWhileArriving();
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
      meta={updatedAt !== undefined ? <Freshness updatedAt={updatedAt} now={clock} staleAfterMs={10 * 60_000} /> : undefined}
      actions={actions || showPeriod ? <>{actions}{showPeriod ? <PagePeriod /> : null}</> : undefined}
    >
      <Stack data-still={arriving || undefined}>{children}</Stack>
    </PageFrame>
  );
}

/**
 * The mark that stops a page's own arrival from being animated, held for as long as one takes.
 *
 * Meridian's `Stack` rises its children in reading order, and the shell already marks the main area still whenever the
 * path changes, because a page reached by a click was already there and the data is what arrived. **A cold load is the
 * same case and was the one left out**: the shimmer the content replaces is the shell's own server-rendered HTML, and
 * the reader has been looking at it. So this page marks its own stack, and the cost it removes is the page's largest
 * paint — measured on `/initiatives/atlas/2026-09-28-search-relevance/plan.md` at 390px under `scripts/vitals.ts`'s
 * phone profile: the document's text entered the DOM at 2,227 ms and the paint the LCP is taken from landed at
 * 2,652 ms, 425 ms later. That is `--dur-enter` (320 ms) plus the second step of the stagger (45 ms), because the rise
 * starts at `opacity: 0` and the text is not presented until it lifts. With the arrival suppressed the same paint is at
 * 2,236 ms. The bar is 2,500 ms.
 *
 * DELIBERATE: the mark lifts after the longest arrival would have ended, on the shell's own arithmetic and read from
 * the same tokens, so everything that arrives afterwards — a new period, a filter, a hint — still rises exactly as
 * `Stack` documents. This is the design system's own escape (`[data-still]` in `styles/motion.css`) applied one level
 * down from where the shell applies it; it belongs in the shell for every product, and is written here until it is.
 */
function useStillWhileArriving(): boolean {
  const [still, setStill] = useState(true);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    // A build may write 820ms as .82s, so read the unit, not only the number.
    const ms = (name: string) => { const v = css.getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000); };
    const t = setTimeout(() => setStill(false), ms('--dur-grow') + ms('--dur-enter'));
    return () => clearTimeout(t);
  }, []);
  return still;
}

/** The page's period control, held in the console's period context. */
function PagePeriod() {
  const { period, setPeriod } = usePeriod();
  return <PeriodSelect value={period} onChange={setPeriod} />;
}

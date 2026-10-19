'use client';

import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Busy, TableSkeleton } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { ReadingBody } from '@/console/reading';
import { useDataClock } from '@/lib/api';
import { formatDateTime } from '@/lib/format-date';
import type { ReleaseDetail, ReleaseRow } from '@/lib/platform-shapes';
import { pendingContext } from '@/views/context';
import {
  NOT_A_VERDICT, OBSERVED, callsIn, clientActionOf, failuresIn, lifted, malformedIn, observedOf, observedText, overlapsOf,
  p95In, rateIn, releaseContext, releasePath, releasesTrouble, type ReleaseRead,
} from '@/views/platform-releases-context';
import { useServed } from '@/views/use-served';

type Side = ReleaseRow['before'];
type Trouble = Exclude<ReleaseRead, { state: 'ok' }>;

/**
 * The page's read: the one the console's server made, so the first paint carries the release and the browser asks for
 * nothing more, then the browser's own once a Retry asks for it. A version the record does not hold reached the page
 * only from the browser's read, since the server's answers it with the missing page.
 */
function useRelease(version: string, served: ReleaseRead, now: Date) {
  const { q, error, retry, busy } = useServed<ReleaseDetail>(releasePath(version), true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf({ error });
  // A read in flight keeps the state the last one ended in on screen, and its Retry, so a press or a change answers
  // there rather than swapping it for a skeleton and taking a keyboard user's place with it.
  const trouble: Trouble | null = data ? null
    : error?.status === 404 ? { state: 'missing' }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' ? null : served;
  return { data, trouble, retry, busy, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? now : null };
}

/** The changelog the console's server drew as prose for its own read of the release, so no renderer is sent for it. */
type ReleaseNotes = { changelog: ReactNode };

/**
 * A text as the page draws it: the server's prose when the text is the one it drew, the browser's renderer only for one
 * it did not, a release read again in the browser after the server's read failed. Measured, a renderer behind
 * `React.lazy` in a boundary the server filled went from prose to plain text and back: the boundary is first drawn in
 * the browser late, when the assistant's arrival changes a context above it, and a lazy component suspends on its
 * first draw. Drawn on the server it is part of the page, with nothing left to suspend on.
 */
function Notes({ md, served, node }: { md: string; served: string | null | undefined; node: ReactNode | undefined }) {
  return node !== undefined && md === served ? node : <ReadingBody>{lifted(md)}</ReadingBody>;
}

/**
 * One release: its published changelog, the page's protagonist, beside what it is (when its tag was made, the console
 * it shipped with, what clients must do and the releases inside its windows), and what was observed in the 72 hours
 * either side of it. The changelog is the section published for the release, its summary its opening and its upgrade
 * notes its own heading, so each is said there once and nowhere beside it. It is the published Markdown, drawn through
 * the console's safe renderer, so raw HTML in it is text.
 */
export function PlatformReleaseView({ version, served, notes = null }: { version: string; served: ReleaseRead; notes?: ReleaseNotes | null }) {
  const now = useDataClock();
  const { data, trouble, retry, busy, updatedAt } = useRelease(version, served, now);
  const asOf = now.toISOString();
  useShareView(data
    ? releaseContext(data, { asOf, updatedAt, now })
    : pendingContext({ view: 'release', title: `Release ${version}`, address: releasePath(version), scope: 'one release' }, trouble && trouble.state !== 'missing' ? releasesTrouble(trouble) : null));

  if (!data) return trouble ? <ReleaseTrouble trouble={trouble} busy={busy} onRetry={retry} /> : <Busy name="release"><Skeleton className="h-72 rounded-lg" /><TableSkeleton rows={2} filters={false} /></Busy>;
  const others = overlapsOf(data);
  const drew = served.state === 'ok' ? served.data : null;
  return (
    <Stack>
      <Row split="2/3" className="items-start">
        <Panel
          data-protagonist="Changelog"
          title="Changelog"
          description="The section published for this release, as written, its upgrade notes included"
          actions={<AskAbout question={`What does the changelog of ${data.version} say changed, and what must clients do about it?`} />}
        >
          <Notes md={data.changelog} served={drew?.changelog} node={notes?.changelog} />
        </Panel>
        <Panel title="This release" description={`Tagged ${formatDateTime(data.releasedAt)}`}>
          <KeyValue items={[
            { label: 'Console', value: data.consoleVersion ?? 'Not recorded' },
            { label: 'Client action', value: clientActionOf(data), wrap: true },
            { label: 'Within 72 hours of', value: others.length ? others.join(', ') : 'No other release', wrap: true },
          ]} />
        </Panel>
      </Row>
      <Windows release={data} asOf={asOf} />
    </Stack>
  );
}

/** A window's figure, or the words for one that was not observed, which wrap where a number never does. */
const figure = (s: string) => (/\d/.test(s) ? s : <span className="whitespace-normal">{s}</span>);

type WindowRow = { key: 'before' | 'after'; label: string; side: Side };

/** The two windows, before and after, each with what of it was observed and what it saw. */
function Windows({ release, asOf }: { release: ReleaseDetail; asOf: string }) {
  const rows: WindowRow[] = [{ key: 'before', label: 'Before', side: release.before }, { key: 'after', label: 'After', side: release.after }];
  const columns: Column<WindowRow>[] = aligned([
    { key: 'window', header: 'Window', mobile: 'title', cell: (r) => r.label },
    {
      key: 'observed', header: 'Observed', grow: true, align: 'left', mobile: 'fact', title: (r) => observedText(r.side, asOf),
      cell: (r) => (
        <span className="block min-w-0 whitespace-normal [overflow-wrap:anywhere]">
          <span className={observedOf(r.side) === 'complete' ? 'text-ink' : 'font-medium text-ink'}>{OBSERVED[observedOf(r.side)]}</span>
          <span className="t-caption block">{observedText(r.side, asOf)}</span>
        </span>
      ),
      mobileCell: (r) => OBSERVED[observedOf(r.side)],
    },
    { key: 'calls', header: 'Calls', numeric: true, hideBelow: 'md', cell: (r) => figure(callsIn(r.side)) },
    { key: 'malformed', header: 'Malformed', numeric: true, hideBelow: 'lg', cell: (r) => figure(malformedIn(r.side)) },
    { key: 'rate', header: 'Per 1,000', numeric: true, mobile: 'fact', cell: (r) => figure(rateIn(r.side)), mobileCell: (r) => `${rateIn(r.side)} per 1,000` },
    { key: 'failures', header: 'Tool failures', numeric: true, hideBelow: 'md', cell: (r) => figure(failuresIn(r.side)) },
    { key: 'p95', header: 'p95', numeric: true, hideBelow: 'md', cell: (r) => figure(p95In(r.side)) },
  ]);
  return (
    <DataTable
      title="Around the release"
      description={NOT_A_VERDICT}
      caption={`What was observed in the 72 hours either side of ${release.version}`}
      noun="windows"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.key}
      pageSize={10}
      pageSizes={[10]}
    />
  );
}

function ReleaseTrouble({ trouble, busy, onRetry }: { trouble: Trouble; busy: boolean; onRetry: () => void }) {
  return (
    <Card>
      {trouble.state === 'missing' ? (
        <EmptyState kind="filtered" title="No release of this version is recorded" className="py-16" action={<Button size="sm" asChild><Link href="/platform/releases">All releases</Link></Button>}>Releases lists every release the platform has recorded.</EmptyState>
      ) : (
        <EmptyState kind="error" title={trouble.state === 'slow' ? 'The release is unavailable' : 'The release did not load'} className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={busy} onClick={onRetry}>Retry</Button>}>{releasesTrouble(trouble)}</EmptyState>
      )}
    </Card>
  );
}

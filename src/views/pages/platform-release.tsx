'use client';

import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { Row } from '@/components/base/shell';
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
  NOT_A_VERDICT, OBSERVED, callsIn, clientActionOf, failuresIn, malformedIn, observedOf, observedText, overlapsOf, p95In,
  rateIn, releaseContext, releasePath, releasesTrouble, type ReleaseRead,
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
  const { q, follow } = useServed<ReleaseDetail>(releasePath(version), true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf(q);
  const trouble: Trouble | null = data ? null
    : q.error?.status === 404 ? { state: 'missing' }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' || q.isFetching ? null : served;
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? now : null };
}

/**
 * One release: its published changelog, the page's protagonist, beside what it is (when its tag was made, the console
 * it shipped with, what clients must do and the releases inside its windows), its upgrade notes, and what was observed
 * in the 72 hours either side of it. The changelog and the notes are the published Markdown, drawn through the
 * console's safe renderer, so raw HTML in them is text.
 */
export function PlatformReleaseView({ version, served }: { version: string; served: ReleaseRead }) {
  const now = useDataClock();
  const { data, trouble, retry, updatedAt } = useRelease(version, served, now);
  const asOf = now.toISOString();
  useShareView(data
    ? releaseContext(data, { asOf, updatedAt, now })
    : pendingContext({ view: 'release', title: `Release ${version}`, address: releasePath(version), scope: 'one release' }, trouble && trouble.state !== 'missing' ? releasesTrouble(trouble) : null));

  if (!data) return trouble ? <ReleaseTrouble trouble={trouble} onRetry={retry} /> : <Busy name="release"><Skeleton className="h-72 rounded-lg" /><TableSkeleton rows={2} filters={false} /></Busy>;
  const others = overlapsOf(data);
  return (
    <>
      <Row split="2/3">
        <Panel
          data-protagonist="Changelog"
          title="Changelog"
          description="The section published for this release, as written"
          actions={<AskAbout question={`What does the changelog of ${data.version} say changed, and what must clients do about it?`} />}
        >
          <ReadingBody>{data.changelog}</ReadingBody>
        </Panel>
        <Panel title="This release" description={`Tagged ${formatDateTime(data.releasedAt)}`}>
          <KeyValue items={[
            { label: 'Summary', value: data.summary, wrap: true },
            { label: 'Console', value: data.consoleVersion ?? 'Not recorded' },
            { label: 'Client action', value: clientActionOf(data), wrap: true },
            { label: 'Within 72 hours of', value: others.length ? others.join(', ') : 'No other release', wrap: true },
          ]} />
        </Panel>
      </Row>
      <Panel title="Upgrade notes" description="What the release's published notes ask of clients">
        {data.upgradeNotes
          ? <ReadingBody>{data.upgradeNotes}</ReadingBody>
          : <EmptyState layout="inline" title="No upgrade notes recorded">{data.clientAction ? `The client action recorded is: ${data.clientAction}` : 'None are needed: nothing is asked of clients.'}</EmptyState>}
      </Panel>
      <Windows release={data} asOf={asOf} />
    </>
  );
}

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
    { key: 'calls', header: 'Calls', numeric: true, hideBelow: 'md', cell: (r) => callsIn(r.side) },
    { key: 'malformed', header: 'Malformed', numeric: true, hideBelow: 'lg', cell: (r) => malformedIn(r.side) },
    { key: 'rate', header: 'Per 1,000', numeric: true, mobile: 'fact', cell: (r) => rateIn(r.side), mobileCell: (r) => `${rateIn(r.side)} per 1,000` },
    { key: 'failures', header: 'Tool failures', numeric: true, hideBelow: 'md', cell: (r) => failuresIn(r.side) },
    { key: 'p95', header: 'p95', numeric: true, hideBelow: 'md', cell: (r) => p95In(r.side) },
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
    />
  );
}

function ReleaseTrouble({ trouble, onRetry }: { trouble: Trouble; onRetry: () => void }) {
  return (
    <Card>
      {trouble.state === 'missing' ? (
        <EmptyState kind="filtered" title="No release of this version is recorded" className="py-16" action={<Button size="sm" asChild><Link href="/platform/releases">All releases</Link></Button>}>Releases lists every release the platform has recorded.</EmptyState>
      ) : (
        <EmptyState kind="error" title={trouble.state === 'slow' ? 'The release is unavailable' : 'The release did not load'} className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={onRetry}>Retry</Button>}>{releasesTrouble(trouble)}</EmptyState>
      )}
    </Card>
  );
}

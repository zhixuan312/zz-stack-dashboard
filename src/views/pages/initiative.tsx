'use client';

import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Busy, ChartSkeleton, TableSkeleton } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { CloseInitiative } from '@/console/close';
import { DocStatus } from '@/console/doc-status';
import { FlowStepper } from '@/console/flow';
import { StateBadge } from '@/console/initiative';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import type { Revised } from '@/data/gateway';
import { encodePath } from '@/lib/store-path';
import { useDataClock } from '@/lib/api';
import type { InitiativeDetail } from '@/lib/api-shapes';
import { formatDateTime } from '@/lib/format-date';
import { formatKb } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { initiativeContext, initiativeTrouble, type InitiativeRead } from '@/views/initiative-context';
import { useServed } from '@/views/use-served';

type Doc = InitiativeDetail['documents'][number];

// The fallback order, used only where two documents share a stage: the flow's own steps decide first.
const ORDER = ['intent', 'ground', 'agreement', 'spec', 'selection', 'plan', 'verification', 'handover', 'guide', 'learnings'];
// A role means different things in different flows, so a line is written only where it is true of every flow.
const WHAT: Record<string, string> = { intent: 'What they asked for', selection: 'Which plugins deliver it', plan: 'How it will be built', learnings: 'What was learned' };

const name = (d: Doc) => d.path.replace(/^sources\//, '');

const DOCUMENTS: Column<Doc>[] = aligned([
  {
    key: 'doc', header: 'Document', grow: true, mobile: 'title', sortValue: (d) => d.path,
    cell: (d) => (
      <span className="block min-w-0">
        <span className="block font-medium text-ink [overflow-wrap:anywhere]">{d.title ?? d.path}</span>
        {/* `anywhere` on the path too: it is monospace, so it has no break opportunity of its own, and a long slug
            widened this cell past the phone's frame — the audit read it as sideways scroll on the one initiative whose
            paths are longest (368px of table in a 356px frame at 390px). The title above already wrapped. */}
        <span className="t-caption block font-mono [overflow-wrap:anywhere]">{d.path}{WHAT[d.type] ? ` · ${WHAT[d.type]}` : ''}</span>
      </span>
    ),
    mobileCell: (d) => d.title ?? d.path,
  },
  { key: 'status', header: 'Approval', mobile: 'status', cell: (d) => <DocStatus status={d.status} outcome={d.outcome} gated={d.gated} requiredForClose={d.requiredForClose} correction={d.correction} />,
    // The card's status slot holds one badge and cannot shrink, so it takes the verdict alone; see DocStatus's `compact`.
    mobileCell: (d) => <DocStatus compact status={d.status} outcome={d.outcome} gated={d.gated} requiredForClose={d.requiredForClose} correction={d.correction} /> },
  {
    // No `truncate`, and the whole `w-40` story written down because it was wrong once. An auto-laid-out table gives a
    // truncating cell whatever is left over, and on an initiative whose Review row carries two badges the neighbouring
    // Approval column widens to hold them — so this one rendered `No approval ne…` and `jonas.weber@e…` where the same
    // column is whole on every other initiative. `w-40` fixed that at 1440 and was measured not to hold at 2560, where
    // the cell capped itself at ~120px: a 22-character address needs ~190px even at the most conservative reading of
    // its font size. A truncated address is an address nobody can use — it is the one value here a reader acts on — and
    // the column beside it holds 8-character badges in ~500px, so the table has the room. It sizes to its content now.
    key: 'by', header: 'Approved by', hideBelow: 'lg',
    // Binary, like the gate itself: a document waiting for a person and one no person will be asked about differ.
    cell: (d) => d.approved_by ?? <span className="text-ink-3">{d.gated === false ? 'No approval needed' : d.gated === true ? 'Not yet' : '—'}</span>,
  },
  { key: 'size', header: 'Size', numeric: true, hideBelow: 'xl', sortValue: (d) => d.bytes, cell: (d) => formatKb(d.bytes / 1024) },
  { key: 'updated', header: 'Updated', numeric: true, mobile: 'fact', sortValue: (d) => d.updated_at, cell: (d) => <When at={d.updated_at} />, mobileCell: (d) => <>Updated <When at={d.updated_at} /></> },
]);

/* Evidence is attached, never approved, so sources have no approval column. */
const SOURCES: Column<Doc>[] = aligned([
  { key: 'source', header: 'Source', grow: true, mobile: 'title', cell: (d) => <span className="font-medium text-ink [overflow-wrap:anywhere]">{d.title || name(d)}</span> },
  { key: 'supports', header: 'Supports', hideBelow: 'md', mobile: 'fact', cell: (d) => <span className="font-mono text-xs text-ink-2">{d.supports ?? '—'}</span> },
  { key: 'size', header: 'Size', numeric: true, hideBelow: 'xl', cell: (d) => formatKb(d.bytes / 1024) },
  { key: 'added', header: 'Added', numeric: true, mobile: 'fact', cell: (d) => <When at={d.updated_at} /> },
]);

/**
 * The page's read: the one the console's server made, so the first paint carries the initiative and the browser asks
 * for nothing more, then the browser's own once a close, a change anywhere to initiatives or a Retry asks for it. An
 * address no initiative has is the read answering, not failing.
 */
function useInitiative(team: string, slug: string, served: InitiativeRead) {
  const { q, error, retry, busy } = useServed<InitiativeDetail>(`/initiatives/${team}/${slug}`, true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf({ error });
  // With nothing to draw there is always a reason: the browser's answer when it has one, the server's until then, a
  // read in flight included, so the state and its Retry stay where they are rather than leaving for a skeleton.
  const trouble: Exclude<InitiativeRead, { state: 'ok' }> | null = data ? null
    : error?.status === 404 ? { state: 'missing' }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' ? null : served;
  return { data, trouble, retry, busy, updatedAt: q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? served.at : null };
}

/**
 * One initiative, end to end: where it is in its flow, the documents the flow produced, and the evidence behind them.
 * Read on the console's server and handed here; its later reads, after a close or a change anywhere to initiatives,
 * are the browser's.
 */
export function InitiativeView({ team, slug, served }: { team: string; slug: string; served: Revised<InitiativeRead> }) {
  useLive(['initiatives'], served.revisions);
  const { data: d, trouble, retry, busy, updatedAt } = useInitiative(team, slug, served);
  const now = useDataClock();
  const base = `/initiatives/${team}/${slug}`;
  useShareView(d
    ? initiativeContext(d, { updatedAt, now })
    : pendingContext({ view: 'initiative', title: slug, address: base, scope: `one initiative of team ${team}` }, trouble ? initiativeTrouble(slug, trouble).detail : null));

  if (!d) {
    return trouble ? <InitiativeTrouble slug={slug} trouble={trouble} busy={busy} onRetry={retry} /> : (
      <Busy name="initiative"><ChartSkeleton height="h-24" /><TableSkeleton rows={5} filters={false} /></Busy>
    );
  }
  const stepOf = (doc: Doc) => d.steps.findIndex((s) => s.produces === doc.path);
  const live = d.documents.filter((x) => !x.path.startsWith('sources/')).sort((a, b) => {
    const sa = stepOf(a), sb = stepOf(b);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    const ia = ORDER.indexOf(a.type), ib = ORDER.indexOf(b.type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.path.localeCompare(b.path);
  });
  // By the title a reader scans, in natural order: sources are numbered ("R2", "R10").
  const sources = d.documents.filter((x) => x.path.startsWith('sources/'))
    .sort((a, b) => (a.title || a.path).localeCompare(b.title || b.path, 'en', { numeric: true }));
  return (
    <>
      {d.steps.length ? (
        <Panel title="Progress" description={`Stage ${d.at} of ${d.of}${d.stage ? `, ${d.stage}` : ''}`}>
          <FlowStepper gates={d.gates} outcome={d.outcome} steps={d.steps} complete={d.complete} correction={d.correction} />
        </Panel>
      ) : null}
      <div data-protagonist="Documents" className="contents">
        <DataTable
          caption="Documents"
          noun="documents"
          rows={live}
          columns={DOCUMENTS}
          rowKey={(x) => x.path}
          rowHref={(x) => `${base}/${encodePath(x.path)}`}
          pageSize={10}
          pageSizes={[10]}
          toolbar={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="t-card">Documents</h2>
                <p className="t-caption mt-1">{d.of ? 'In the order the flow produces them' : 'Everything written in this initiative'}</p>
              </div>
              <AskAbout question={`Where does ${slug} stand, and which of its documents needs me next?`} />
            </div>
          }
          empty={{ title: 'Nothing written yet', body: 'The first stage of the flow writes the first document.' }}
        />
      </div>
      {sources.length ? (
        <DataTable
          caption="Sources"
          noun="sources"
          rows={sources}
          columns={SOURCES}
          rowKey={(x) => x.path}
          rowHref={(x) => `${base}/${encodePath(x.path)}`}
          pageSize={10}
          pageSizes={[10]}
          toolbar={<div><h2 className="t-card">Sources</h2><p className="t-caption mt-1">What someone said or found, attached as evidence</p></div>}
        />
      ) : null}
    </>
  );
}

function InitiativeTrouble({ slug, trouble, busy, onRetry }: { slug: string; trouble: Exclude<InitiativeRead, { state: 'ok' }>; busy: boolean; onRetry: () => void }) {
  const { title, detail } = initiativeTrouble(slug, trouble);
  return (
    <Card>
      {trouble.state === 'missing' ? (
        <EmptyState kind="filtered" title={title} className="py-16" action={<Button size="sm" asChild><Link href="/initiatives">All initiatives</Link></Button>}>{detail}</EmptyState>
      ) : (
        <EmptyState kind="error" title={title} className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={busy} onClick={onRetry}>Retry</Button>}>{detail}</EmptyState>
      )}
    </Card>
  );
}

/** The masthead's status: the initiative's state and the cutoff of the read the page draws, nothing while there is none. */
export function InitiativeMeta({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data, updatedAt } = useInitiative(team, slug, served);
  if (!data) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StateBadge of={data} />
      {updatedAt ? <span className="t-small text-ink-3">Read {formatDateTime(updatedAt)}</span> : null}
    </span>
  );
}

/**
 * The masthead's one action: Close, while the initiative is open and of the team the person acts for, the only team a
 * close is made under. A close with no flow names the document it lands on, of the documents a close may land on.
 */
export function InitiativeClose({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data } = useInitiative(team, slug, served);
  const acting = served.state === 'ok' ? served.team : null;
  if (!data || acting !== data.team) return null;
  const landings = data.documents.filter((x) => !x.path.startsWith('sources/') && x.type !== 'handover').map((x) => x.path);
  return <CloseInitiative team={data.team} slug={data.slug} closed={data.closed} freeform={data.steps.length === 0} documents={landings} />;
}

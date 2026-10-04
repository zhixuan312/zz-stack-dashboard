'use client';

import { use } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { DocStatus } from '@/console/doc-status';
import { FlowStepper } from '@/console/flow';
import { StateBadge } from '@/console/initiative';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { Query } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { InitiativeDetail } from '@/lib/api-shapes';
import { formatKb } from '@/lib/format';

type Doc = InitiativeDetail['documents'][number];

// The fallback order, used only where two documents share a stage: the flow's own steps decide first.
const ORDER = ['intent', 'ground', 'agreement', 'spec', 'selection', 'plan', 'verification', 'handover', 'guide', 'learnings'];
// A role means different things in different flows, so a line is written only where it is true of every flow.
const WHAT: Record<string, string> = { intent: 'What they asked for', selection: 'Which plugins deliver it', plan: 'How it will be built', learnings: 'What was learned' };

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
const name = (d: Doc) => d.path.replace(/^sources\//, '');

const DOCUMENTS: Column<Doc>[] = aligned([
  {
    key: 'doc', header: 'Document', grow: true, mobile: 'title', sortValue: (d) => d.path,
    cell: (d) => (
      <span className="block min-w-0">
        <span className="block font-medium text-ink [overflow-wrap:anywhere]">{d.title ?? d.path}</span>
        <span className="t-caption block font-mono">{d.path}{WHAT[d.type] ? ` · ${WHAT[d.type]}` : ''}</span>
      </span>
    ),
    mobileCell: (d) => d.title ?? d.path,
  },
  { key: 'status', header: 'Approval', mobile: 'status', cell: (d) => <DocStatus status={d.status} outcome={d.outcome} gated={d.gated} requiredForClose={d.requiredForClose} /> },
  {
    key: 'by', header: 'Approved by', hideBelow: 'lg', truncate: true,
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

/** One initiative, end to end: where it is in its flow, the documents the flow produced, and the evidence behind them. */
export default function InitiativePage({ params }: { params: Promise<{ team: string; slug: string }> }) {
  const { team, slug } = use(params);
  const q = useConsole<InitiativeDetail>(`/initiatives/${team}/${slug}`);
  const base = `/initiatives/${team}/${slug}`;

  return (
    <ConsolePage
      title={slug}
      crumbs={[{ label: 'Initiatives', href: '/initiatives' }, { label: team, href: `/teams/${team}` }]}
      description={q.data ? <span className="inline-flex flex-wrap items-center gap-2">Read from the document store; the platform stamped every gate. <StateBadge of={q.data} /></span> : undefined}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
    >
      <Query query={q} skeleton={<div className="flex flex-col gap-(--stack-gap)"><Skeleton className="h-40 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>}>
        {(d) => {
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
                  <FlowStepper gates={d.gates} outcome={d.outcome} steps={d.steps} complete={d.complete} />
                </Panel>
              ) : null}
              <DataTable
                caption="Documents"
                noun="documents"
                rows={live}
                columns={DOCUMENTS}
                rowKey={(x) => x.path}
                rowHref={(x) => `${base}/${encodePath(x.path)}`}
                pageSize={10}
                pageSizes={[10, 20, 50]}
                toolbar={<div><h2 className="t-card">Documents</h2><p className="t-caption mt-1">In the order the flow produces them</p></div>}
                empty={{ title: 'Nothing written yet', body: 'The first stage of the flow writes the first document.' }}
              />
              {sources.length ? (
                <DataTable
                  caption="Sources"
                  noun="sources"
                  rows={sources}
                  columns={SOURCES}
                  rowKey={(x) => x.path}
                  rowHref={(x) => `${base}/${encodePath(x.path)}`}
                  pageSize={10}
                  pageSizes={[10, 20, 50]}
                  toolbar={<div><h2 className="t-card">Sources</h2><p className="t-caption mt-1">What someone said or found, attached as evidence</p></div>}
                />
              ) : null}
            </>
          );
        }}
      </Query>
    </ConsolePage>
  );
}

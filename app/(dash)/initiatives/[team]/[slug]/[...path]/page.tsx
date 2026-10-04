'use client';

import { useState, use } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { KeyValue } from '@/components/ui/key-value';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ApproveAction, canApprove } from '@/console/approve';
import { aligned } from '@/console/columns';
import { DocStatus } from '@/console/doc-status';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { Prose } from '@/console/prose';
import { Query } from '@/console/query';
import { VersionChain } from '@/console/version-chain';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import { readableDocument } from '@/lib/document-markdown';
import { formatKb } from '@/lib/format';

type Decision = DocumentDetail['decisions'][number];

/**
 * The claims a document makes, one row each. The columns follow the role, because the rows do: a selection judges
 * each criterion (verdict and qualifier), a plan's rows are tasks (and the qualifier is which criteria each covers),
 * and an agreement states the criteria, so its verdicts are empty.
 */
function decisionColumns(role: string): Column<Decision>[] {
  const judged = role === 'selection', plan = role === 'plan';
  return aligned([
    { key: 'key', header: plan ? 'Task' : 'Key', mobile: 'title', width: 'w-28', cell: (x) => <span className="font-mono text-xs font-medium text-ink">{x.key}</span> },
    ...(judged ? [{ key: 'verdict', header: 'Verdict', mobile: 'status' as const, cell: (x: Decision) => (x.verdict ? <Badge tone={x.verdict === 'native' || x.verdict === 'met' ? 'positive' : 'warning'} dot>{x.verdict}</Badge> : '—') }] : []),
    ...(judged || plan ? [{ key: 'qualifier', header: plan ? 'Covers' : 'Qualifier', hideBelow: 'md' as const, width: 'w-36', cell: (x: Decision) => <span className="font-mono text-xs text-ink-2">{x.qualifier ?? '—'}</span> }] : []),
    // Full text: this is the column the table exists for.
    { key: 'detail', header: judged ? 'How it is delivered' : plan ? 'What the task does' : 'What it says', align: 'left', mobile: 'fact', cell: (x) => <span className="block py-1 text-sm leading-relaxed whitespace-normal [overflow-wrap:anywhere]">{x.detail ?? '—'}</span> },
  ]);
}

/** One document, read: the text itself, how it changed and on what evidence, and the claims it makes. */
export default function DocumentPage({ params }: { params: Promise<{ team: string; slug: string; path: string[] }> }) {
  const { team, slug, path } = use(params);
  const rel = path.map(decodeURIComponent).join('/');
  const q = useConsole<DocumentDetail>(`/document/${team}/${slug}/${rel}`);
  const me = useConsole<Me>('/me');
  // Rendered by default, because a person came to read it; the stored markdown is one press away.
  const [view, setView] = useState<'read' | 'source'>('read');
  const d = q.data;
  // The document's own version number; the gateway stamps 9999 on the live row for ordering only.
  const version = d ? Math.max(1, ...d.versions.map((v) => v.version).filter((n) => n !== 9999)) : null;

  return (
    <ConsolePage
      title={d?.title || rel.replace(/^sources\//, '')}
      crumbs={[{ label: 'Initiatives', href: '/initiatives' }, { label: team, href: `/teams/${team}` }, { label: slug, href: `/initiatives/${team}/${slug}` }]}
      description={d ? <span className="font-mono text-sm">{rel}{version ? ` · v${version}` : ''}</span> : undefined}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      actions={d && me.data && canApprove(d, me.data) ? <ApproveAction doc={d} me={me.data} /> : undefined}
      width="reading"
    >
      <Query query={q} skeleton={<div className="flex flex-col gap-(--stack-gap)"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-[28rem] rounded-lg" /></div>}>
        {(doc) => (
          <>
            <Panel
              title="Document"
              description={formatKb(doc.bytes / 1024)}
              actions={<Segmented size="sm" label="Document view" value={view} onChange={setView} options={[{ value: 'read', label: 'Read' }, { value: 'source', label: 'Source' }]} />}
            >
              <KeyValue
                columns={2}
                className="mb-6"
                items={[
                  { label: 'Type', value: doc.type },
                  { label: 'Status', wrap: true, value: <DocStatus status={doc.status} outcome={doc.outcome} gated={doc.gated} requiredForClose={doc.requiredForClose} /> },
                  // Three states, not two: a source is a file the flow says nothing about, so "not approved" would imply an approval was ever on the table.
                  { label: 'Approved by', wrap: true, value: doc.approved_by ?? (doc.gated === false ? 'No approval needed' : doc.gated === true ? 'Not yet' : '—') },
                  { label: 'Updated', value: <When at={doc.updated_at} /> },
                ]}
              />
              {doc.body?.trim()
                ? view === 'read'
                  ? <Prose>{readableDocument(doc.body)}</Prose>
                  : <pre className="rounded-lg border border-line bg-surface-sunk p-4 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{doc.body}</pre>
                : <p className="t-small text-ink-3">This document has no body in the store.</p>}
            </Panel>
            <VersionChain doc={doc} />
            {doc.decisions.length ? (
              <DataTable
                caption="Claims"
                noun="claims"
                rows={doc.decisions}
                columns={decisionColumns(doc.decisions[0]?.role ?? '')}
                rowKey={(x) => x.key}
                pageSize={20}
                toolbar={
                  <div>
                    <h2 className="t-card">{doc.decisions[0]?.role === 'plan' ? 'Which criteria each task covers' : 'The claims this document makes'}</h2>
                    <p className="t-caption mt-1">{doc.decisionCounts.rows} rows{doc.decisionCounts.rows && !doc.decisionCounts.withVerdict ? ', none stating a verdict' : ''}</p>
                  </div>
                }
              />
            ) : null}
          </>
        )}
      </Query>
    </ConsolePage>
  );
}

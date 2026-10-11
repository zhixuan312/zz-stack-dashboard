'use client';

import { useState, use, type ReactNode } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ApproveAction, OutOfDate, canApprove, switchToApprove, useRecordShown } from '@/console/approve';
import { aligned } from '@/console/columns';
import { DocStatus } from '@/console/doc-status';
import { Row } from '@/components/base/shell';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { Query } from '@/console/query';
import { VersionChain } from '@/console/version-chain';
import { When } from '@/console/when';
import { decodePath } from '@/lib/address';
import { freshnessOf, useConsole } from '@/lib/api';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import { readableDocument } from '@/lib/document-markdown';
import { ReadingBody } from '@/console/reading';

import { formatKb } from '@/lib/format';
import { useLive } from '@/lib/live';

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

/**
 * What the document is and where it stands, beside the text rather than above it.
 *
 * This was Meridian's `KeyValue` — a two-column label/value grid — sitting between the masthead and the first line of
 * the document. It is a form's shape: a column of labels with a column of values, six rows of it, and it pushed the
 * text a screenful down the page while reading as something a person was meant to fill in. Nothing here is a field.
 *
 * So the facts a reader wants at a glance — what kind of document this is, who approved it, when it last moved, who it
 * is for, what it is tagged with, and whatever fields the flow carries — are set as a colophon in the narrow column,
 * and the document's own status moved up into the masthead where it is visible at every width.
 */
function DocColophon({ doc }: { doc: DocumentDetail }) {
  const fields = Object.entries(doc.fields).sort(([a], [b]) => a.localeCompare(b));
  return (
    <Panel title="This document" description="What it is, and who it is for.">
      <div className="flex flex-col gap-4">
        <Colophon label="Type">{doc.type}</Colophon>
        {/* Three states, not two: a source is a file the flow says nothing about, so "not approved" would imply an
            approval was ever on the table. */}
        <Colophon label="Approved by">{doc.approved_by ?? (doc.gated === false ? 'No approval needed' : doc.gated === true ? 'Not yet' : '—')}</Colophon>
        <Colophon label="Updated"><When at={doc.updated_at} /></Colophon>
        <Colophon label="Stakeholder">{doc.stakeholder || 'None named'}</Colophon>
        <Colophon label="Tags">
          {doc.tags?.length
            ? <span className="flex flex-wrap gap-1.5">{doc.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</span>
            : 'None'}
        </Colophon>
        {/* The review metadata: an approval signs it with the body, and recording this page as shown says the reader
            saw it, so every piece is on screen. The title is the masthead's. */}
        {fields.map(([key, value]) => <Colophon key={key} label={key}>{value}</Colophon>)}
      </div>
    </Panel>
  );
}

/** One line of a colophon: what it is, in mono caps, over what it says. */
function Colophon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="t-eyebrow">{label}</p>
      <p className="t-small mt-1 min-w-0 text-ink [overflow-wrap:anywhere]">{children}</p>
    </div>
  );
}

/** One document, read: the text itself, how it changed and on what evidence, and the claims it makes. */
export default function DocumentPage({ params }: { params: Promise<{ team: string; slug: string; path: string[] }> }) {
  useLive(['document']);
  const { team, slug, path } = use(params);
  const rel = decodePath(path);
  const q = useConsole<DocumentDetail>(`/document/${team}/${slug}/${rel}`);
  const me = useConsole<Me>('/me');
  // Rendered by default, because a person came to read it; the stored markdown is one press away.
  const [view, setView] = useState<'read' | 'source'>('read');
  const d = q.data;
  // The document's own public version. Not the highest of `versions`: those name the snapshot each version is read
  // as, and several snapshots can share one version.
  const version = d?.current_version ?? null;
  // Approve is on offer, so what this page displays is recorded as shown to the reader — the first snapshot of the
  // visit after the render that put its body on screen, any later one when the reader reloads — and Approve signs
  // exactly that snapshot under the context it answers. Not while a refetch failed: the panel then shows the failure,
  // not the body this would vouch for.
  const offered = !!(d && !q.error && me.data && canApprove(d, me.data));
  const { shown, again, outdated } = useRecordShown(d, offered);
  async function reload() {
    // `/me` as well: a record refused because the session now acts for another team clears only once the page knows.
    const [next] = await Promise.all([q.refetch(), me.refetch()]);
    // The snapshot the reload brought is the one the reader now asks to approve, the same one again included.
    if (next.data) again(next.data.content_revision);
  }

  return (
    <ConsolePage
      title={d?.title || rel.replace(/^sources\//, '')}
      crumbs={[{ label: 'Initiatives', href: '/initiatives' }, { label: team, href: `/teams/${team}` }, { label: slug, href: `/initiatives/${team}/${slug}` }]}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-sm">{rel}{version ? ` · v${version}` : ''}</span>
          {d ? <DocStatus status={d.status} outcome={d.outcome} gated={d.gated} requiredForClose={d.requiredForClose} correction={d.correction} /> : null}
        </span>
      }
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      actions={d && me.data && (offered || switchToApprove(d, me.data)) ? <ApproveAction doc={d} me={me.data} shown={shown} onStale={outdated} /> : undefined}
      width="data"
    >
      <OutOfDate shown={shown} onReload={() => void reload()} />
      <Query query={q} what="This document" skeleton={<div className="flex flex-col gap-(--stack-gap)"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-[28rem] rounded-lg" /></div>}>
        {(doc) => (
          <>
            {/* `items-start`: the document is as long as it is, and a card stretched to a taller neighbour's height
                is a page of empty card under the last line of text. Cards in a row share a height when they are cards in
                a row; one side here is a column of the document's own facts and the other is the text. */}
            <Row split="2/3" className="items-start">
              <Panel
                title="Document"
                description={formatKb(doc.bytes / 1024)}
                actions={<Segmented size="sm" label="Document view" value={view} onChange={setView} options={[{ value: 'read', label: 'Read' }, { value: 'source', label: 'Source' }]} />}
              >
                {/* The reader's measure is this cell, not Meridian's 72-character cap. These are long documents on a
                    wide screen, and a 533px strip in a 1,400px canvas makes one longer than it is: the cap is worth
                    2,200px of scroll on a 60,000-character document. Tables and code already fill the cell; this lets
                    the running text join them. */}
                <div className="[&_li]:max-w-[92ch] [&_ol]:max-w-[92ch] [&_p]:max-w-[92ch] [&_ul]:max-w-[92ch]">
                  {doc.body?.trim()
                    ? view === 'read'
                      ? <ReadingBody bytes={doc.bytes}>{readableDocument(doc.body, doc.title)}</ReadingBody>
                      : <pre className="rounded-lg border border-line bg-surface-sunk p-4 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{doc.body}</pre>
                    : <p className="t-small text-ink-3">This document has no body in the store.</p>}
                </div>
              </Panel>
              <div className="flex min-w-0 flex-col gap-(--stack-gap)">
                <DocColophon doc={doc} />
                <VersionChain doc={doc} />
              </div>
            </Row>
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

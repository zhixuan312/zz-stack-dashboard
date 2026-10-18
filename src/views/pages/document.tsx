'use client';

import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ApproveAction, canApprove, switchToApprove, useRecordShown } from '@/console/approve';
import { aligned } from '@/console/columns';
import { DocStatus } from '@/console/doc-status';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { useConsole, useDataClock } from '@/lib/api';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import { readableDocument } from '@/lib/document-markdown';
import { ReadingBody } from '@/console/reading';

import { formatKb } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { documentContext } from '@/views/document-context';
import type { DocumentRead } from '@/views/document-read';
import { INITIATIVES_BOUND_MS } from '@/views/initiatives-context';
import { useServed } from '@/views/use-served';

type Decision = DocumentDetail['decisions'][number];
type Trouble = Exclude<DocumentRead, { state: 'ok' }>;

/**
 * The version chain, behind a chunk of its own.
 *
 * It sits under the colophon, below everything a first paint shows, and it carries the line differ with it. In the
 * page's first load it was one request more than the route had before the assistant was mounted: 21 scripts where
 * there had been 20. The phone profile `scripts/vitals.ts` measures on is HTTP/1.1 with 150 ms on every request, and
 * the document's own text, the page's largest paint, waits for the last of them: measured on three document routes,
 * 2.24-2.40 s with 20 scripts and 2.34-2.62 s with 21, against a 2.5 s bar. Loaded when the page has mounted, the
 * route is back to 20 scripts and 34 KiB lighter.
 */
const VersionChain = lazy(() => import('@/console/version-chain').then((m) => ({ default: m.VersionChain })));

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

/**
 * The words a read's trouble is told in, on the page and to the assistant: the gateway's sentence, or the bound the
 * read missed. COUPLED: the titles are what scripts/primary-data.ts and scripts/states-check.ts read a document answered
 * as not existing, or failed, by.
 */
function troubleOf(trouble: Trouble): { title: string; detail: string } {
  if (trouble.state === 'missing') return { title: 'This document does not exist', detail: trouble.reason };
  return { title: 'This document did not load', detail: trouble.state === 'slow' ? `The read did not answer within ${INITIATIVES_BOUND_MS / 1000} seconds.` : trouble.reason };
}

/**
 * The page's read: the one the console's server made, so the first paint carries the document and the browser asks for
 * nothing more, then the browser's own once an approval, a change anywhere to documents, a Retry or a Reload asks for
 * it. A failed read in the browser is drawn in place of the body it would replace, as it always was: the body on
 * screen is what Approve vouches for, and a read that failed cannot say it is still current.
 */
function useDocument(path: string, served: DocumentRead) {
  const { q, follow } = useServed<DocumentDetail>(path, true);
  const failed = failureOf(q);
  const data = failed ? undefined : q.data ?? (served.state === 'ok' ? served.data : undefined);
  // With nothing to draw there is always a reason: the browser's answer when it has one, the server's until then.
  const trouble: Trouble | null = data ? null
    : q.error?.status === 404 ? { state: 'missing', reason: q.error.message }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' || q.isFetching ? null : served;
  const updatedAt = !data ? null : q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? new Date(served.at) : null;
  return { q, data, trouble, follow, updatedAt };
}

/**
 * One document, read: the text itself, how it changed and on what evidence, and the claims it makes. Read on the
 * console's server and handed here as `served`; its later reads are the browser's.
 *
 * `teamPage` is whether the reader may open the team's page under Platform, the console's server's answer from their
 * `/me`: the breadcrumb's team links there for them and is plain text for anybody else, who would be refused it.
 */
export function DocumentView({ team, slug, rel, served, teamPage }: { team: string; slug: string; rel: string; served: DocumentRead; teamPage: boolean }) {
  useLive(['document']);
  const { q, data: d, trouble, follow, updatedAt } = useDocument(`/document/${team}/${slug}/${rel}`, served);
  const me = useConsole<Me>('/me');
  // Rendered by default, because a person came to read it; the stored markdown is one press away.
  const [view, setView] = useState<'read' | 'source'>('read');
  const now = useDataClock();
  const context = d
    ? documentContext(d, { updatedAt, now })
    : pendingContext({ view: 'document', title: rel, address: `/initiatives/${team}/${slug}/${rel}`, scope: `one document of initiative ${team}/${slug}` }, trouble ? troubleOf(trouble).detail : null);
  // The document's own public version. Not the highest of `versions`: those name the snapshot each version is read
  // as, and several snapshots can share one version.
  const version = d?.current_version ?? null;
  // Approve is on offer, so what this page displays is recorded as shown to the reader — the first snapshot of the
  // visit after the render that put its body on screen, any later one when the reader reloads — and Approve signs
  // exactly that snapshot under the context it answers. Not while a refetch failed: the page then shows the failure,
  // not the body this would vouch for.
  const offered = !!(d && !q.error && me.data && canApprove(d, me.data));
  const { shown, again, outdated } = useRecordShown(d, offered);
  // A Reload over the server's read is the browser's first read of the document, so the snapshot it brings is recorded
  // once that read lands rather than when the reload is asked for.
  const reloading = useRef(false);
  useEffect(() => {
    if (!reloading.current || q.isFetching || (q.data === undefined && !q.error)) return;
    reloading.current = false;
    if (q.data) again(q.data.content_revision);
  }, [q.data, q.error, q.isFetching, again]);
  async function reload() {
    // `/me` as well: a record refused because the session now acts for another team clears only once the page knows.
    if (q.data === undefined && !q.error) {
      reloading.current = true;
      follow();
      void me.refetch();
      return;
    }
    const [next] = await Promise.all([q.refetch(), me.refetch()]);
    // The snapshot the reload brought is the one the reader now asks to approve, the same one again included.
    if (next.data) again(next.data.content_revision);
  }
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());

  return (
    <ConsolePage
      title={d?.title || rel.replace(/^sources\//, '')}
      crumbs={[{ label: 'Initiatives', href: '/initiatives' }, { label: team, href: teamPage ? `/platform/teams/${team}` : undefined }, { label: slug, href: `/initiatives/${team}/${slug}` }]}
      description={
        // TWO ROWS ALWAYS, and the second one is the status's own. It used to be a single wrapping line with the status
        // appended, so whether that line took one row or two depended on **the width of a badge that arrives with the
        // read** — and the masthead is above everything, so when it took two the whole page below moved once.
        //
        // A wider placeholder does not fix that; nothing in a row of variable content can. What fixes it is taking the
        // status out of the row that decides the height. **Measured on a quiet box the shift is never counted** (the
        // read lands ~350 ms; the phone profile's first paint is ~2,100 ms) **and under the sweep it is** — 0.121 and
        // 0.149 against a 0.1 bar — which is why two hand measurements and a full suite disagreed about the same build
        // for an hour. Removing the shift is the only answer that does not depend on which of those runs you are in.
        <span className="flex flex-col items-start gap-1.5">
          <span className="font-mono text-sm">{rel}{version ? ` · v${version}` : ''}</span>
          {/* The status's placeholder stands only while a read is on its way, as the body's skeleton does: beside a
              failed or not-found read it would say a status is still coming. */}
          {d ? <DocStatus status={d.status} outcome={d.outcome} gated={d.gated} requiredForClose={d.requiredForClose} correction={d.correction} />
            : trouble ? null : <Skeleton className="h-5 w-40 rounded-full" />}
        </span>
      }
      showPeriod={false}
      updatedAt={updatedAt}
      context={context}
      actions={d && me.data && (offered || switchToApprove(d, me.data)) ? <ApproveAction doc={d} me={me.data} shown={shown} onStale={outdated} onReload={() => void reload()} /> : undefined}
      width="data"
    >
      {d ? <DocumentBody doc={d} view={view} onView={setView} />
        : trouble ? <DocumentTrouble trouble={trouble} busy={q.isFetching} onRetry={retry} />
          : <div className="flex flex-col gap-(--stack-gap)" aria-busy="true" aria-label="Loading"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-[28rem] rounded-lg" /></div>}
    </ConsolePage>
  );
}

/** The document's body beside its facts and its history, then the claims it makes. */
function DocumentBody({ doc, view, onView }: { doc: DocumentDetail; view: 'read' | 'source'; onView: (view: 'read' | 'source') => void }) {
  return (
    <>
      {/* `items-start`: the document is as long as it is, and a card stretched to a taller neighbour's height
          is a page of empty card under the last line of text. Cards in a row share a height when they are cards in
          a row; one side here is a column of the document's own facts and the other is the text. */}
      <Row split="2/3" className="items-start">
        <Panel
          title="Document"
          description={formatKb(doc.bytes / 1024)}
          actions={<><AskAbout question={doc.gated === true && !doc.approved_by ? 'What does this document commit us to, and what should I check before approving it?' : 'What does this document say, in a few lines?'} /><Segmented size="sm" label="Document view" value={view} onChange={onView} options={[{ value: 'read', label: 'Read' }, { value: 'source', label: 'Source' }]} /></>}
        >
          {/* The reader's measure is this cell, not Meridian's 72-character cap. These are long documents on a
              wide screen, and a 533px strip in a 1,400px canvas makes one longer than it is: the cap is worth
              2,200px of scroll on a 60,000-character document. Tables and code already fill the cell; this lets
              the running text join them. */}
          <div className="[&_li]:max-w-[92ch] [&_ol]:max-w-[92ch] [&_p]:max-w-[92ch] [&_ul]:max-w-[92ch]">
            {doc.body?.trim()
              ? view === 'read'
                ? <ReadingBody>{readableDocument(doc.body, doc.title)}</ReadingBody>
                : <pre className="rounded-lg border border-line bg-surface-sunk p-4 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]">{doc.body}</pre>
              : <p className="t-small text-ink-3">This document has no body in the store.</p>}
          </div>
        </Panel>
        <div className="flex min-w-0 flex-col gap-(--stack-gap)">
          <DocColophon doc={doc} />
          <Suspense fallback={<Skeleton className="h-40 rounded-lg" />}><VersionChain doc={doc} /></Suspense>
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
  );
}

/** Why the page has no document to draw, alone: no document by that address, or a read that failed or did not answer. */
function DocumentTrouble({ trouble, busy, onRetry }: { trouble: Trouble; busy: boolean; onRetry: () => void }) {
  const { title, detail } = troubleOf(trouble);
  return (
    <EmptyState
      kind={trouble.state === 'missing' ? 'filtered' : 'error'}
      title={title}
      action={<Button size="sm" variant="secondary" busy={busy} onClick={onRetry}>Retry</Button>}
    >
      {detail}
    </EmptyState>
  );
}

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
import { ownGates } from '@/console/initiative-state';
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
import { initiativeName, sourceName } from '@/views/initiative-name';
import { useServed } from '@/views/use-served';

type Doc = InitiativeDetail['documents'][number];

// The fallback order, used only where two documents share a stage: the flow's own steps decide first.
const ORDER = ['intent', 'ground', 'agreement', 'spec', 'selection', 'plan', 'verification', 'handover', 'guide', 'learnings'];
// A role means different things in different flows, so a line is written only where it is true of every flow.
const WHAT: Record<string, string> = { intent: 'What they asked for', selection: 'Which plugins deliver it', plan: 'How it will be built', learnings: 'What was learned' };

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

/**
 * Evidence is attached, never approved, so sources have no approval column. A source is named as a person reads it: a
 * web address it was filed under is the page's name, with its host as a note beneath (`sourceName`).
 */
const SOURCES: Column<Doc>[] = aligned([
  {
    key: 'source', header: 'Source', grow: true, mobile: 'title',
    cell: (d) => {
      const { name, host } = sourceName(d.title, d.path);
      return (
        <span className="block min-w-0" title={d.title ?? undefined}>
          <span className="block font-medium text-ink [overflow-wrap:anywhere]">{name}</span>
          {host ? <span className="t-caption block [overflow-wrap:anywhere]">{host}</span> : null}
        </span>
      );
    },
  },
  { key: 'supports', header: 'Supports', hideBelow: 'md', mobile: 'fact', cell: (d) => <span className="font-mono text-xs text-ink-2">{d.supports ?? '—'}</span> },
  { key: 'size', header: 'Size', numeric: true, hideBelow: 'xl', cell: (d) => formatKb(d.bytes / 1024) },
  { key: 'added', header: 'Added', numeric: true, mobile: 'fact', cell: (d) => <When at={d.updated_at} /> },
]);

/** The documents the flow produced, in the order it produces them; the fallback order where two share a stage. */
function inFlowOrder(d: InitiativeDetail): Doc[] {
  const stepOf = (doc: Doc) => d.steps.findIndex((s) => s.produces === doc.path);
  return d.documents.filter((x) => !x.path.startsWith('sources/')).sort((a, b) => {
    const sa = stepOf(a), sb = stepOf(b);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    const ia = ORDER.indexOf(a.type), ib = ORDER.indexOf(b.type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.path.localeCompare(b.path);
  });
}

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
  const live = inFlowOrder(d);
  // By the name a reader scans, in natural order: sources are numbered ("R2", "R10").
  const sources = d.documents.filter((x) => x.path.startsWith('sources/'))
    .sort((a, b) => sourceName(a.title, a.path).name.localeCompare(sourceName(b.title, b.path).name, 'en', { numeric: true }));
  // The cards one gap apart, as on every page; a fragment left the frame to lay them edge to edge. The stack's gap and
  // not Meridian's `Stack`, whose rise would hold the first paint's cards at no opacity while it runs.
  return (
    <div className="flex min-w-0 flex-col gap-(--stack-gap)">
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
    </div>
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

/**
 * The width one character of the title takes, in ems of its own size: the masthead's face at the page title's weight
 * and tracking, measured in the browser at 0.49 to 0.52 on the fake's slugs (a date, then lower-case words), with a
 * margin over the widest. A slug of digits and m's alone would measure 0.64 and run past the masthead.
 */
const EM_PER_CHARACTER = 0.56;

/**
 * The slug as the page's title where no document names the work, whole on one line. It is an identifier, and a break
 * after one of its hyphens reads as two words ("2026-09-28-" over "search-relevance"); a slug is often longer than the masthead holds at the title's
 * size, so the title steps down to the size at which it fits the masthead's width, and never above the page title's.
 * In the masthead's heading the outer block is the container that width is read from; in the top bar, where the
 * frame shows the same title once the masthead has scrolled away, the bar is the container, and the bar's own size
 * holds.
 */
export function SlugTitle({ slug }: { slug: string }) {
  return (
    <span className="[h1_&]:block [h1_&]:[container-type:inline-size]">
      <span className="whitespace-nowrap [h1_&]:block" style={{ fontSize: `min(1em, calc(100cqi / ${(slug.length * EM_PER_CHARACTER).toFixed(2)}))` }}>{slug}</span>
    </span>
  );
}

/**
 * The page's title: the work's name, as its documents name it (`initiativeName`), so a person reads what the work is
 * rather than its identifier; the slug where no document names one, or where nothing was read.
 */
export function InitiativeTitle({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data } = useInitiative(team, slug, served);
  const name = data ? initiativeName(inFlowOrder(data)) : null;
  return name ?? <SlugTitle slug={slug} />;
}

/** The masthead's lead: the slug, under a title that names the work, in the face an identifier is set in, then the sentence. */
export function InitiativeLead({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data } = useInitiative(team, slug, served);
  const named = data ? initiativeName(inFlowOrder(data)) !== null : false;
  return (
    <span className="flex flex-col items-start gap-1.5">
      {named ? <span className="font-mono text-sm [overflow-wrap:anywhere]">{slug}</span> : null}
      <span>Read from the document store; the platform stamped every gate.</span>
    </span>
  );
}

/**
 * The document a person is waited on for, which the state beside it names: the first gate written and not yet
 * approved, or, once it is closed, the correction awaiting approval. COUPLED: a gate is named `approve <its document
 * without .md>` by the gateway (services/gateway/src/console/shared.ts), so a gate whose document is not in the read
 * names nothing here rather than a guessed path.
 */
function awaited(d: InitiativeDetail): string | null {
  if (d.closed) return d.correction?.path ?? null;
  for (const g of ownGates(d).filter((x) => x.written && !x.passed)) {
    const doc = d.documents.find((x) => `approve ${x.path.replace(/\.md$/, '')}` === g.name);
    if (doc) return doc.path;
  }
  return null;
}

/**
 * The masthead's status: the initiative's state, the document it waits on a person for, which opens that document's
 * page to read and approve it, and the cutoff of the read the page draws; nothing while there is none. Review is the
 * next step, so it is the page's one filled button while something waits on the person, and Close steps down beside it
 * (`InitiativeClose`, Work M-7).
 */
export function InitiativeMeta({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data, updatedAt } = useInitiative(team, slug, served);
  if (!data) return null;
  const review = awaited(data);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StateBadge of={data} />
      {review ? <Button asChild size="sm" variant="primary"><Link href={`/initiatives/${team}/${slug}/${encodePath(review)}`}>Review {review}</Link></Button> : null}
      {updatedAt ? <span className="t-small text-ink-3">Read {formatDateTime(updatedAt)}</span> : null}
    </span>
  );
}

/**
 * The masthead's action: Close, while the initiative is open and of the team the person acts for, the only team a close
 * is made under. A close with no flow names the document it lands on, of the documents a close may land on. It is the
 * filled button when nothing waits on a person, and the secondary one while Review, the next step, does (Work M-7).
 */
export function InitiativeClose({ team, slug, served }: { team: string; slug: string; served: InitiativeRead }) {
  const { data } = useInitiative(team, slug, served);
  const acting = served.state === 'ok' ? served.team : null;
  if (!data || acting !== data.team) return null;
  const landings = data.documents.filter((x) => !x.path.startsWith('sources/') && x.type !== 'handover').map((x) => x.path);
  return <CloseInitiative team={data.team} slug={data.slug} closed={data.closed} freeform={data.steps.length === 0} documents={landings} variant={awaited(data) ? 'secondary' : 'primary'} />;
}

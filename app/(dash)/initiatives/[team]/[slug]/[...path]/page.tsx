'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Segmented, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, usePaged,
} from '@/components/ui';
import { DocumentShell, type DocumentShellTab } from '@/components/patterns/document-shell';
import { ProseBlock } from '@/components/patterns/prose-block';
import { DocStatus } from '@/components/DocStatus';
import { readableDocument } from '@/lib/document-markdown';
import { VersionChain } from '@/components/VersionChain';
import { formatCount } from '@/lib/format';
import { ApproveAction, canApprove } from '@/components/ApproveAction';
import {
  DocumentThreadComposer, DocumentThreadMessages, DocumentThreadRevise, canReviseFromThread, useDocumentThread,
} from '@/components/DocumentThread';
import { freshnessOf, useConsole } from '@/lib/api';
import { type DocumentDetail, type Me } from '@/lib/api-shapes';

/** The shell's two tabs, document chrome first. COUPLED: `DocumentShell`'s `onDocumentTab`
 *  relies on that ordering to scope `actions` and `approvers` to tab zero. */
const TABS: readonly DocumentShellTab[] = [
  { id: 'document', label: 'Document' },
  { id: 'discussion', label: 'Discussion' },
];

/**
 * One document, read.
 *
 * The acceptance-criterion ledger lives here rather than on the initiative, because it is
 * keyed by document path: a ledger is what one particular document claims.
 */
export default function DocumentPage({
  params,
}: {
  params: Promise<{ team: string; slug: string; path: string[] }>;
}) {
  const { team, slug, path } = use(params);
  const rel = path.map(decodeURIComponent).join('/');
  const q = useConsole<DocumentDetail>(`/document/${team}/${slug}/${rel}`);
  // Shares the same query key `ConsoleModeProvider` seeds (see api.ts), so this is a
  // cache hit in the common case. Unscoped for the same reason that provider's is:
  // "who is this" carries no team or mode.
  const meQ = useConsole<Me>('/me');
  // Rendered by default, because a person came to read it. The source is one click
  // away: these documents are markdown a flow parses, and the headings and ledger
  // tables the platform keys on are worth seeing exactly as stored.
  const [view, setView] = useState<'read' | 'source'>('read');
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  // One hook, called on every render regardless of which tab is showing, but its effect only
  // fetches and streams while `active` is true. One hook rather than two because the message
  // list (`body`) and the composer (`footer`) are two `DocumentShell` slots sharing one
  // thread's state.
  const thread = useDocumentThread({ team, initiative: slug, path: rel, active: activeTab === 'discussion' });

  return (
    <DashboardPage
      title={rel.replace(/^(_versions|sources)\//, '')}
      description={
        <>
          <Link href={`/initiatives/${team}/${slug}`} className="text-accent hover:underline">
            {slug}
          </Link>
          {' · '}
          <Link href={`/teams/${team}`} className="text-accent hover:underline">{team}</Link>
        </>
      }
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      // Reading width: the page is one column — the document, how it changed, and its
      // claims, each a full-width card.
      actions={
        <Link
          href={`/initiatives/${team}/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to the initiative
        </Link>
      }
    >
      <Query query={q} skeletonRows={12}>
        {(d) => (
          <>
            <DocumentShell
              title={d.title || rel}
              // `versions` is every snapshot of this document, oldest first, ending with
              // the live one; there is no top-level version number.
              //
              // The document's own version number, not a count of snapshots: a revision
              // consumes a version without freezing a file, so `d.versions.length` would
              // disagree with the chain. The sentinel 9999 the gateway stamps on the live
              // row is for ordering and is excluded here the same way the chain excludes it.
              version={Math.max(1, ...d.versions.map((v) => v.version).filter((n) => n !== 9999))}
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              approvers={
                <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-surface-2/40 px-5 py-2.5 text-[13px]">
                  <span className="flex items-center gap-2">
                    <dt className="text-ink-faint">Approved by</dt>
                    <dd className="break-all font-mono text-xs text-ink">
                      {d.approved_by ?? (
                        // Three states, not two. `false` is "the flow gates this and
                        // nobody has"; `null` is a file the flow says nothing about — a
                        // source — where "not approved" would imply an approval was ever
                        // on the table.
                        <span className="font-sans text-ink-faint">
                          {d.gated === false ? 'no approval needed'
                            : d.gated === true ? 'not approved'
                            : '—'}
                        </span>
                      )}
                    </dd>
                  </span>
                  {d.approved_by ? (
                    <span className="flex items-center gap-2">
                      <dt className="text-ink-faint">Approved at</dt>
                      <dd><Time value={d.approved_at} /></dd>
                    </span>
                  ) : null}
                </dl>
              }
              actions={meQ.data && canApprove(d, meQ.data) ? <ApproveAction doc={d} me={meQ.data} /> : undefined}
              body={
                activeTab === 'discussion' ? (
                  <DocumentThreadMessages
                    messages={thread.messages}
                    loading={thread.loading}
                    loadError={thread.loadError}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
                        <span className="flex items-center gap-2">
                          <dt className="text-ink-faint">Type</dt>
                          <dd><Badge variant="neutral">{d.type}</Badge></dd>
                        </span>
                        {/* COUPLED: the same component the documents table uses, so a
                            document cannot be "delivered" in the list and "draft" one
                            click in. */}
                        <span className="flex items-center gap-2">
                          <dt className="text-ink-faint">Status</dt>
                          <dd>
                            <DocStatus
                              status={d.status}
                              outcome={d.outcome}
                              gated={d.gated}
                              requiredForClose={d.requiredForClose}
                            />
                          </dd>
                        </span>
                        <span className="flex items-center gap-2">
                          <dt className="text-ink-faint">Updated</dt>
                          <dd><Time value={d.updated_at} /></dd>
                        </span>
                      </dl>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-ink-faint">
                        <Segmented
                          label="Document view"
                          value={view}
                          onChange={(v) => setView(v as 'read' | 'source')}
                          options={[{ value: 'read', label: 'Read' }, { value: 'source', label: 'Source' }]}
                        />
                        <span>{formatCount(d.bytes)} bytes</span>
                      </span>
                    </div>

                    <div className="h-px bg-line" />

                    {d.body?.trim() ? (
                      view === 'read' ? (
                        // The card's full width, and so is everything beside it: a spec is
                        // half decision tables and criterion ledgers, and capping the prose
                        // but not them puts two widths in one card.
                        <ProseBlock>{readableDocument(d.body)}</ProseBlock>
                      ) : (
                        // Wrapped, not scrolled sideways: a source line longer than the
                        // column breaks, and a hard-wrapped one is untouched.
                        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.7] text-ink-soft">
                          {d.body}
                        </pre>
                      )
                    ) : (
                      <p className="text-sm text-ink-faint">This document has no body in the store.</p>
                    )}
                  </div>
                )
              }
              // Discussion-only, and not scoped by the shell the way `actions`/`approvers`
              // are: `footer` is deliberately unscoped, because the apply bar and this
              // composer belong to a non-document tab. The page does the scoping instead.
              footer={
                activeTab === 'discussion' ? (
                  <div className="flex flex-col">
                    {/* Above the composer, not inside it: revising is an act on the whole
                        thread so far, not something typed alongside the next message. */}
                    <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-2.5">
                      {/* Not offered where it cannot work: `revise_document` refuses a
                          frozen snapshot under `_versions/` and a source under `sources/`,
                          both immutable. A control whose only possible outcome is the
                          server's refusal teaches a reader to distrust the ones that work.
                          The same three-state reasoning `gated` gets on the document tab. */}
                      <DocumentThreadRevise
                        team={team}
                        initiative={slug}
                        path={rel}
                        disabled={
                          !canReviseFromThread(thread.messages) ||
                          /^(_versions|sources)\//.test(rel) ||
                          // And not on a closed initiative. zz-core carries `outcome` and
                          // `closed_by` forward across a revision rather than deleting them,
                          // so a revise corrupts nothing — but a closed initiative's
                          // documents are the record the ledger row was written from, and
                          // offering to rewrite one invites a disagreement between document
                          // and ledger.
                          Boolean(d.outcome)
                        }
                      />
                    </div>
                    <DocumentThreadComposer
                      draft={thread.draft}
                      onDraftChange={thread.setDraft}
                      onSubmit={thread.submit}
                      posting={thread.posting}
                    />
                  </div>
                ) : undefined
              }
            />

            <VersionChain doc={d} />

            {d.decisions.length ? <DecisionPanel decisions={d.decisions} counts={d.decisionCounts} /> : null}
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

/** Its own component so it can hold the page state — a spec carries hundreds of rows. */
function DecisionPanel({ decisions, counts }: {
  decisions: DocumentDetail['decisions'];
  counts: DocumentDetail['decisionCounts'];
}) {
  const { page, controls } = usePaged(decisions);
  // The columns depend on the role, because the rows do. A selection judges each
  // criterion, so it carries a verdict and a mechanism. An agreement
  // (the spec) is where the criteria are stated, so every verdict and qualifier on its
  // rows is empty. A plan's rows are tasks, and the qualifier holds which criteria each
  // one discharges.
  const role = decisions[0]?.role ?? '';
  const judged = role === 'selection';
  const isPlan = role === 'plan';
  return (
    <Panel
      // The claims, not "the acceptance criteria". These rows come from decisionRows(),
      // whose key pattern is deliberately generic and does not ask what each key means —
      // an sdlc-flow spec lists FR-1..FR-14 under a heading reading "acceptance
      // criteria", because those lines open with a bold key while its real AC-* lines are
      // checklist items.
      //
      // A selection and a plan keep their own titles: for those roles the rows genuinely
      // are what the titles say, judged and traced respectively.
      title={
        judged ? 'How each criterion will be delivered'
          : isPlan ? 'Which criteria each task discharges'
          : 'The claims this document makes'
      }
      // The counts, not just the row total: the gateway sends them so a table of blanks is
      // readable as a fact about these documents rather than as the extractor having
      // stopped. Said only where it is the interesting half.
      aside={counts.rows && !counts.withVerdict
        ? `${counts.rows} — none states a verdict`
        : `${counts.rows}`}
      padded={false}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[5.5rem]">{isPlan ? 'Task' : judged ? 'AC' : 'Key'}</TableHead>
            {judged ? <TableHead className="w-[7.5rem]">Verdict</TableHead> : null}
            {judged ? <TableHead hideBelow="md" className="w-[11rem]">Qualifier</TableHead> : null}
            {isPlan ? <TableHead hideBelow="md" className="w-[9rem]">Covers</TableHead> : null}
            <TableHead>
              {judged ? 'How it is delivered' : isPlan ? 'What the task does' : 'What it says'}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((x, i) => (
            <TableRow key={`${x.key}-${i}`}>
              <TableCell className="break-all font-mono text-xs font-medium text-ink">
                {x.key}
              </TableCell>
              {judged ? (
                <TableCell>
                  {x.verdict ? (
                    <Badge variant={x.verdict === 'native' ? 'sage' : 'amber'} dot>
                      {x.verdict}
                    </Badge>
                  ) : <span className="text-xs text-ink-faint">—</span>}
                </TableCell>
              ) : null}
              {judged ? (
                <TableCell hideBelow="md" className="text-xs text-[var(--amber-deep)]">
                  {x.qualifier || <span className="text-ink-faint">—</span>}
                </TableCell>
              ) : null}
              {isPlan ? (
                <TableCell hideBelow="md" className="break-words font-mono text-[11px] text-ink-faint">
                  {x.qualifier || '—'}
                </TableCell>
              ) : null}
              {/* Full text, not truncated: this is the column the table exists for. */}
              <TableCell className="break-words text-xs leading-relaxed">{x.detail ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </Panel>
  );
}

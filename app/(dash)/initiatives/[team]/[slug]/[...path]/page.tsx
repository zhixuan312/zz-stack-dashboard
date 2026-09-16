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
import { useConsole, type DocumentDetail, type Me } from '@/lib/api';

/** The shell's two tabs, in the order every tabbed shell puts document chrome first (see
 *  `DocumentShell`'s `onDocumentTab`, which relies on that ordering to scope `actions` and
 *  `approvers` to tab zero). */
const TABS: readonly DocumentShellTab[] = [
  { id: 'document', label: 'Document' },
  { id: 'discussion', label: 'Discussion' },
];

/**
 * One document, read.
 *
 * The console could say a spec existed, who approved it and how many bytes it
 * was, and not a word of what it said — everything except the thing a reader
 * came for.
 *
 * The acceptance-criterion ledger lives HERE rather than on the initiative,
 * because it is keyed by document path: a ledger is what one particular
 * selection or spec claims, and floating it beside the initiative detached it
 * from the document that has to answer for it.
 */
export default function DocumentPage({
  params,
}: {
  params: Promise<{ team: string; slug: string; path: string[] }>;
}) {
  const { team, slug, path } = use(params);
  const rel = path.map(decodeURIComponent).join('/');
  const q = useConsole<DocumentDetail>(`/document/${team}/${slug}/${rel}`);
  // Shares the SAME query key `ConsoleModeProvider` seeds (see api.ts), so
  // this is a cache hit in the common case rather than a second request —
  // and it is unscoped for the same reason that provider's is: "who is this"
  // carries no team or mode.
  const meQ = useConsole<Me>('/me');
  // Rendered by default, because a person came to READ it. The source is one
  // click away because these documents are markdown that a flow parses, and the
  // headings and ledger tables the platform keys on are worth being able to see
  // exactly as they are stored.
  const [view, setView] = useState<'read' | 'source'>('read');
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  // One hook, called on every render regardless of which tab is showing (hooks can't be
  // conditional) — but its own effect only fetches and streams while `active` is true, so
  // sitting on the Document tab costs nothing. See `useDocumentThread`'s own header for
  // why this is a single hook rather than two: the message list (`body`) and the composer
  // (`footer`) are two different `DocumentShell` slots that still share one thread's state.
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
      updatedAt={new Date()}
      // READING WIDTH: the page is one column — the document, how it changed, and its
      // claims, each a full-width card — and the column is what a reader reads.
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
              // `versions` is every snapshot of this document, oldest first, ending
              // with the LIVE one — there is no top-level version number, because a
              // frozen `_versions/spec.v1.md` and the live `spec.md` differ only in
              // whether a suffix was ever attached, not in a field either carries.
              // Its length is exactly the count a reader means by "version N": one
              // unnumbered document is v1, and each approval that freezes a
              // snapshot before the next edit adds one more. (The gateway does
              // stamp the live entry with a sentinel version of 9999 so it sorts
              // last — see `VersionChain`'s own `label()` — but that sentinel is
              // for ordering, not for display, so the badge never reads "v9999".)
              version={d.versions.length}
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              approvers={
                <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-surface-2/40 px-5 py-2.5 text-[13px]">
                  <span className="flex items-center gap-2">
                    <dt className="text-ink-faint">Approved by</dt>
                    <dd className="break-all font-mono text-xs text-ink">
                      {d.approved_by ?? (
                        // Three states, not two. `false` is "the flow gates this
                        // and nobody has"; `null` is a file the flow says nothing
                        // about — a source — where "not approved" would imply an
                        // approval was ever on the table.
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
                        {/* The SAME component the documents table uses, so a document
                            cannot be "delivered" in the list and "draft" one click in.
                            This bar had its own inline ladder and still said "draft"
                            on an ungated document long after the table stopped. */}
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
                          label="How to show this document"
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
                        // THE CARD'S FULL WIDTH, and so is everything beside it. A spec is
                        // half decision tables and criterion ledgers; capping the prose and
                        // not them puts two widths in one card, which reads as broken. This
                        // page is `data` like the other nineteen.
                        <ProseBlock>{readableDocument(d.body)}</ProseBlock>
                      ) : (
                        // WRAPPED, not scrolled sideways: a source line longer than the
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
              // Discussion-only, and NOT scoped by the shell the way `actions`/`approvers`
              // are — `footer` is deliberately unscoped (see `DocumentShell`'s own
              // comment) because the apply bar and this composer legitimately belong to
              // a non-document tab. The page does the scoping instead.
              footer={
                activeTab === 'discussion' ? (
                  <div className="flex flex-col">
                    {/* Above the composer, not inside it: revising is an act on the whole
                        thread so far, not something typed alongside the next message. */}
                    <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-2.5">
                      {/* NOT OFFERED WHERE IT CANNOT WORK. `revise_document` refuses a
                          frozen snapshot under `_versions/` and a source under `sources/`
                          — both are immutable by design, which is the whole reason they
                          exist. Rendering the control there would be a button whose only
                          possible outcome is the server's refusal, and a control that can
                          only fail teaches a reader to distrust the ones that work. The
                          same three-state reasoning `gated` gets on the document tab. */}
                      <DocumentThreadRevise
                        team={team}
                        initiative={slug}
                        path={rel}
                        disabled={
                          !canReviseFromThread(thread.messages) ||
                          /^(_versions|sources)\//.test(rel) ||
                          // AND NOT ON A CLOSED INITIATIVE. Found by revising one on UAT:
                          // the document's version moved while `outcome: accepted` and
                          // `closed_by` stayed on it. zz-core carries those forward rather
                          // than deleting them — its own comment records the incident where
                          // deleting them reopened a closed initiative and let close() append
                          // a SECOND ledger row for the same work — so nothing was corrupted.
                          // But a closed initiative's documents ARE the record the ledger row
                          // was written from, and offering to rewrite one invites exactly the
                          // disagreement between document and ledger that close is meant to
                          // end. Whether the platform should refuse this outright is its
                          // question; the console should not be asking it.
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

            {d.decisions.length ? <DecisionPanel decisions={d.decisions} /> : null}
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

/** ITS OWN COMPONENT so it can hold the page state — a spec carries hundreds of rows. */
function DecisionPanel({ decisions }: { decisions: DocumentDetail['decisions'] }) {
  const { page, controls } = usePaged(decisions);
  // THE COLUMNS DEPEND ON THE ROLE, because the rows do.
  //
  // A SELECTION judges each criterion against a block, so it carries a
  // verdict and a mechanism. An AGREEMENT (the spec) is where the
  // criteria are STATED — there is nothing to judge yet, so every
  // verdict and qualifier on those 381 rows is empty, and rendering
  // the selection's columns over them produced a table of em-dashes
  // beside truncated text. A PLAN's rows are tasks, and the qualifier
  // holds which criteria each one discharges.
  const role = decisions[0]?.role ?? '';
  const judged = role === 'selection';
  const isPlan = role === 'plan';
  return (
    <Panel
      // THE CLAIMS, NOT "the acceptance criteria". These rows come from
      // decisionRows(), whose key pattern is deliberately generic — its own
      // comment says "what each key MEANS stays the flow's business, and this
      // deliberately does not ask". Calling the column AC asserted a meaning the
      // extractor declines to determine, and got it wrong on the first document
      // it was pointed at: an sdlc-flow spec listed FR-1..FR-14 under the
      // heading "acceptance criteria", because those lines open with a bold key
      // and its real AC-* lines are checklist items the reader skipped entirely.
      //
      // A selection and a plan keep their own titles: for those roles the rows
      // genuinely ARE what the titles say, judged and traced respectively.
      title={
        judged ? 'How each criterion will be delivered'
          : isPlan ? 'Which criteria each task discharges'
          : 'The claims this document makes'
      }
      aside={`${decisions.length}`}
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
              {/* Full text, not truncated. This is the column the table
                  exists for and it was being clipped mid-sentence. */}
              <TableCell className="break-words text-xs leading-relaxed">{x.detail ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </Panel>
  );
}

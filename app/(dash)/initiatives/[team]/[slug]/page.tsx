'use client';

import { use } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { DocStatus } from '@/components/DocStatus';
import { Query } from '@/components/Query';
import { FlowStepper } from '@/components/Flow';
import {
  PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, usePaged,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole, type InitiativeDetail } from '@/lib/api';

/**
 * One initiative, end to end.
 *
 * The acceptance-criterion ledger at the bottom is the densest real content the
 * platform holds — one row per criterion, with the verdict the selection step
 * reached and the qualifier that says how sure it is ("seam-dependent, may
 * degrade" is a real one) — and nothing has ever displayed it.
 */
export default function InitiativePage({
  params,
}: {
  params: Promise<{ team: string; slug: string }>;
}) {
  const { team, slug } = use(params);
  const q = useConsole<InitiativeDetail>(`/initiatives/${team}/${slug}`);

  return (
    <DashboardPage
      title={slug}
      description={
        <>
          in <Link href={`/teams/${team}`} className="text-accent hover:underline">{team}</Link>
          {' · '}read from the document store — the platform stamped every gate
        </>
      }
      showPeriod={false}
      updatedAt={freshnessOf(q)}
    >
      <Query query={q}>
        {(d) => {
          const live = d.documents
            .filter((x) => !x.path.startsWith('_versions/') && !x.path.startsWith('sources/'))
            .sort((a, b) => {
              const ia = ORDER.indexOf(a.type), ib = ORDER.indexOf(b.type);
              return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.path.localeCompare(b.path);
            });
          const sources = d.documents.filter((x) => x.path.startsWith('sources/'));
          const versions = d.documents.filter((x) => x.path.startsWith('_versions/'));
          return (
            <>
              <Panel title="Progress">
                <FlowStepper gates={d.gates} outcome={d.outcome} steps={d.steps} complete={d.complete} />
              </Panel>

              {/* GROUPED BY WHAT A DOCUMENT IS, not sorted by its path.
                  Alphabetical order interleaved three different kinds of file —
                  the flow's live deliverables, the raw material behind them, and
                  frozen snapshots of earlier drafts — so `_versions/intent.v1.md`
                  sorted above the actual `intent.md` and a reader had to know the
                  convention to tell which one was the document. The path stays,
                  because it is what the store is keyed by, but it is no longer
                  the thing you read first. */}
              <Panel
                title="The documents"
                aside={`${live.length} — in the order the flow produces them`}
                padded={false}
              >
                <DocumentTable docs={live} base={`/initiatives/${team}/${slug}`} showWhat />
              </Panel>

              {sources.length ? (
                <Panel
                  title="Sources"
                  aside={`${sources.length} — what someone said, attached as evidence`}
                  padded={false}
                >
                  <SourceTable docs={sources} base={`/initiatives/${team}/${slug}`} />
                </Panel>
              ) : null}

              {versions.length ? (
                <Panel
                  title="Earlier versions"
                  aside={`${versions.length} — frozen at approval, kept readable`}
                  padded={false}
                >
                  <DocumentTable docs={versions} base={`/initiatives/${team}/${slug}`} showWhat={false} />
                </Panel>
              ) : null}

              {/* The acceptance-criterion ledger used to sit here, detached from
                  the document that has to answer for it. It is keyed by document
                  path — a ledger is what one particular selection or spec claims —
                  so it now lives inside that document, one click away, where the
                  criteria sit beside the text that argues for them. */}
            </>
          );
        }}
      </Query>
    </DashboardPage>
  );
}

type Doc = InitiativeDetail['documents'][number];

// THE ORDER THE FLOW PRODUCES THEM IN, when the flow says. `d.steps` is the
// manifest's, so a document's place comes from the flow rather than from a list
// of ops-flow's types — which put `rulers.md` under "What will be built" because
// its role is `agreement`, a word ops-flow uses for a spec.
const ORDER = ['intent', 'agreement', 'spec', 'selection', 'plan', 'verification', 'guide', 'learnings'];
// A ROLE MEANS DIFFERENT THINGS IN DIFFERENT FLOWS, so the subtitle is only
// written where it is true of every flow that uses the role. Where it is not,
// no subtitle beats a confident wrong one: a skill evaluation's `agreement` is
// a definition of good, and calling it "What will be built" is a lie about the
// document a reader is deciding whether to open.
const WHAT: Record<string, string> = {
  intent: 'What they asked for',
  selection: 'Which plugins deliver it',
  plan: 'How it will be built',
  learnings: 'What was learned',
};

const href = (base: string, path: string) =>
  `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** ITS OWN COMPONENT so it can hold the page state — the rows come from a `Query` render prop. */
function DocumentTable({ docs, base, showWhat }: { docs: Doc[]; base: string; showWhat: boolean }) {
  const { page, controls } = usePaged(docs);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead hideBelow="lg">Approved by</TableHead>
            <TableHead hideBelow="md">Updated</TableHead>
            <TableHead hideBelow="xl">Bytes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((doc) => (
            <TableRow key={doc.path}>
              <TableCell className="max-w-[30ch]">
                {/* The point of the row. A reader came to read the document,
                    not to learn that it is 54,691 bytes. */}
                <Link href={href(base, doc.path)} className="block break-all font-medium text-accent hover:underline">
                  {doc.path.replace(/^(_versions|sources)\//, '')}
                </Link>
                {showWhat && WHAT[doc.type] ? (
                  <span className="block text-xs text-ink-faint">{WHAT[doc.type]}</span>
                ) : null}
              </TableCell>
              <TableCell>
                <DocStatus
                  status={doc.status}
                  outcome={doc.outcome}
                  gated={doc.gated}
                  requiredForClose={doc.requiredForClose}
                />
              </TableCell>
              <TableCell hideBelow="lg" className="max-w-[26ch] truncate text-xs" title={doc.approved_by ?? ''}>
                {doc.approved_by ?? (
                  // Binary, like the gate itself. "not approved" read the
                  // same on a document waiting for a person and on one no
                  // person will ever be asked about.
                  <span className="text-ink-faint">
                    {doc.gated === false ? 'no approval needed'
                      : doc.gated === true ? 'not approved'
                      : '—'}
                  </span>
                )}
              </TableCell>
              <TableCell hideBelow="md"><Time value={doc.updated_at} /></TableCell>
              <TableCell hideBelow="xl" className="whitespace-nowrap tabular-nums text-xs">
                {formatCount(doc.bytes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}

/* Evidence is attached, never approved, so it has no approval column — a column
   of dashes is the grey area this page is trying to remove. */
function SourceTable({ docs, base }: { docs: Doc[]; base: string }) {
  const { page, controls } = usePaged(docs);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Attached source</TableHead>
            <TableHead hideBelow="md">Supports</TableHead>
            <TableHead>Added</TableHead>
            <TableHead hideBelow="xl">Bytes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((x) => (
            <TableRow key={x.path}>
              <TableCell className="max-w-[42ch]">
                <Link href={href(base, x.path)} className="break-words font-medium text-accent hover:underline">
                  {x.title || x.path.replace(/^sources\//, '')}
                </Link>
              </TableCell>
              <TableCell hideBelow="md" className="break-all font-mono text-xs">{x.supports ?? '—'}</TableCell>
              <TableCell><Time value={x.updated_at} /></TableCell>
              <TableCell hideBelow="xl" className="whitespace-nowrap tabular-nums text-xs">
                {formatCount(x.bytes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}

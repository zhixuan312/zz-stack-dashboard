'use client';

import { use } from 'react';
import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { useSearchParams } from 'next/navigation';
import { VersionSelect, ALL_VERSIONS } from '@/components/VersionSelect';
import { useConsole, type SkillScores } from '@/lib/api';

/** Score → a tint. The rubric's own floor and anchor, not a curve: 1 is the
 *  floor and 5 the anchor, so 5 and 4 are good, 3 is the middle, 1–2 is the
 *  thing to look at. */
function tone(n: number): string {
  if (n >= 4) return 'text-[var(--sage-deep)]';
  if (n <= 2) return 'text-[var(--rose-deep)]';
  return 'text-ink';
}

export default function SkillScoresPage({ params }: { params: Promise<{ flow: string; skill: string }> }) {
  const { flow, skill: name } = use(params);
  const q = useConsole<SkillScores>(`/skills/${name}/scores`);
  const search = useSearchParams();
  const version = search.get('version') ?? ALL_VERSIONS;
  const all = q.data?.documents ?? [];
  // FILTERED BY THE VERSION THAT WROTE THE DOCUMENT. A document is produced by
  // exactly one version of the skill and judged as that version's work, so picking
  // a version picks a SET OF DOCUMENTS — not a subset of each one's scores.
  //
  // And it keeps the unjudged ones. The version comes from the run that produced
  // the document, not from the eval, so a document written by 1.0 that no judge
  // has read is still 1.0's work and still counts against it. That is the whole
  // point of the filter: fine-tuning a version means seeing what it produced,
  // including what nobody has scored yet. Documents older than the run link have
  // no recorded version and appear only under "all versions".
  const docs = version === ALL_VERSIONS ? all : all.filter((d) => d.version === version);
  const scored = docs.filter((d) => d.scores);
  const means = scored.map((d) => d.mean).filter((m): m is number => m !== null);

  return (
    <DashboardPage
      title={`${name} — every score`}
      description={
        q.data?.path
          ? version === ALL_VERSIONS
            ? `One row per ${q.data.path} in the store, whether a judge has read it or not. Control scores are excluded.`
            : `The ${q.data.path} documents written by version ${version}. Control scores are excluded.`
          : 'Every document this skill produced, scored or not.'
      }
      showPeriod={false}
      updatedAt={new Date()}
      actions={<VersionSelect versions={q.data?.versions ?? []} />}
      breadcrumb={[
        { label: 'Flows', href: '/flows' },
        { label: flow, href: `/flows/${flow}` },
        { label: name, href: `/flows/${flow}/${name}` },
        { label: 'scores' },
      ]}
      metrics={
        q.data
          ? [
              { label: 'Documents', value: String(docs.length),
                sublabel: version === ALL_VERSIONS
                  ? (q.data.path ? `every ${q.data.path}` : 'none produced')
                  : `written by version ${version}` },
              { label: 'Scored', value: String(scored.length),
                sublabel: docs.length ? `${Math.round((scored.length / docs.length) * 100)}% of them` : '—' },
              // THE NUMBER THE PAGE EXISTS FOR. A mean over 30 of 81 documents
              // is a mean over a sample, and the skill page never said which.
              { label: 'Not scored', value: String(docs.length - scored.length),
                sublabel: version === ALL_VERSIONS
                  ? 'no judge has read them'
                  : `written by ${version}, never scored`,
                emphasis: docs.length - scored.length > 0 },
              { label: 'Mean', value: means.length ? (means.reduce((a, b) => a + b, 0) / means.length).toFixed(2) : '—',
                sublabel: means.length ? `across ${means.length} judged documents` : 'nothing judged' },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) =>
          !d.path ? (
            <Panel title="Nothing to score">
              <EmptyState
                icon={<FlaskConical />}
                title="This skill produces no document"
                description={`No evaluation has ever named a document for ${name}, so there is no set of documents to list. ${name === 'sm-build' ? 'For sm-build that is structural: it produces side effects in other systems, not a document a judge can read.' : 'A rubric for it is a decision nobody has made.'}`}
              />
            </Panel>
          ) : (
            <>
              {/* THE LEGEND. Five dimension names of up to forty-six characters
                  cannot be column headings, and truncating them leaves headings
                  that all begin the same way. D1–D5 is the rubric's own ordinal
                  order — a real sequence, not a label invented for the table. */}
              <Panel title="The dimensions" aside={`${d.dimensions.length} · in rubric order`}>
                <ol className="flex flex-col gap-1.5 text-[13px]">
                  {d.dimensions.map((dim, i) => (
                    <li key={dim} className="flex gap-3">
                      <span className="w-6 shrink-0 font-mono text-xs font-medium text-ink-faint">D{i + 1}</span>
                      <span className="text-ink-soft">{dim}</span>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel
                title="Every document"
                aside={version === ALL_VERSIONS
                  ? `${docs.length} — ${scored.length} judged, ${docs.length - scored.length} not`
                  : `${docs.length} written by ${version} — ${scored.length} judged, ${docs.length - scored.length} not`}
                padded={false}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Initiative</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Version</TableHead>
                      {d.dimensions.map((dim, i) => (
                        <TableHead key={dim} className="text-right" title={dim}>D{i + 1}</TableHead>
                      ))}
                      <TableHead className="text-right">Mean</TableHead>
                      <TableHead>Judged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* `docs`, the FILTERED list — not `d.documents`, which is the whole
                        payload. The metric row was computed from one and the table
                        rendered the other, so picking a version changed the counts
                        above and left all 81 rows below them. */}
                    {docs.map((doc) => (
                      <TableRow key={`${doc.team}/${doc.initiative}`}>
                        <TableCell className="max-w-[34ch]">
                          {/* The click-in: straight to the document itself. */}
                          <Link
                            href={`/initiatives/${doc.team}/${doc.initiative}/${doc.path}`}
                            className="block truncate font-medium text-accent hover:underline"
                            title={doc.initiative}
                          >
                            {doc.initiative}
                          </Link>
                          {doc.title ? (
                            <span className="block truncate text-xs text-ink-faint" title={doc.title}>{doc.title}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">{doc.team}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {doc.version ?? <span className="font-sans text-ink-faint">—</span>}
                        </TableCell>
                        {doc.scores ? (
                          d.dimensions.map((dim) => {
                            const s = doc.scores?.[dim];
                            return (
                              <TableCell key={dim} className="text-right tabular-nums" title={s?.reason ?? ''}>
                                {s ? <span className={tone(s.score)}>{s.score}</span>
                                   : <span className="text-ink-faint">—</span>}
                              </TableCell>
                            );
                          })
                        ) : (
                          // ONE CELL, NOT FIVE DASHES. Five empty cells read as
                          // five missing numbers; this row has no verdict at all.
                          <TableCell colSpan={d.dimensions.length} className="text-center">
                            <Badge variant="neutral">not scored</Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium tabular-nums">
                          {doc.mean !== null ? doc.mean.toFixed(2) : <span className="text-ink-faint">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {doc.evaluatedAt
                            ? <span className="font-mono text-ink-faint">{doc.evaluatedAt} · {doc.judge}</span>
                            : <span className="text-ink-faint">never</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </>
          )
        }
      </Query>
    </DashboardPage>
  );
}

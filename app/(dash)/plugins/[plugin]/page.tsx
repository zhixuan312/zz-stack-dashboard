'use client';

import { use } from 'react';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, EmptyState, PageControl, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, usePaged,
} from '@/components/ui';
import { EvalScore, EvalVerdict } from '@/components/EvalScore';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole } from '@/lib/api';
import { type PluginRow } from '@/lib/api-shapes';

/**
 * Layer two: one plugin — what it is, what it reaches, and every skill it ships.
 *
 * DELIBERATE: reads the same `/plugins` payload as the list rather than a per-plugin
 * endpoint. There is a handful of plugins and the response is small, and a second endpoint
 * returning a subset of the first is a second place for the shape to drift.
 *
 * Its skills, not its stages: the manifest's stages are the method's running order and not
 * its contents, and a plugin ships more skills than it declares stages. A stage's position
 * is shown where the method declares one; a skill that is simply shipped shows none.
 */
export default function PluginPage({ params }: { params: Promise<{ plugin: string }> }) {
  const { plugin } = use(params);
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const p = q.data?.plugins.find((x) => x.plugin === plugin);

  return (
    <DashboardPage
      title={p && p.agentName ? `${plugin} — ${p.agentName}` : plugin}
      breadcrumb={[{ label: 'Plugins', href: '/plugins' }, { label: plugin }]}
      // DELIBERATE: no subtitle. The manifest description runs to two lines and is the first
      // thing "What this plugin is" says, lower down.
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      metrics={
        p
          ? [
              { label: 'Skills', value: String(p.skills.length),
                sublabel: p.stages.length ? `${p.stages.length} of them stages, in order` : 'no declared method' },
              { label: 'Gates', value: String(p.gates),
                sublabel: p.gates ? 'a person must approve' : 'an assistant, not a delivery method' },
              { label: 'Calls', value: formatCount(p.calls),
                sublabel: p.failed ? `${formatCount(p.failed)} refused` : 'none refused' },
              { label: 'Never run', value: String(p.skills.filter((s) => !s.everRun).length),
                sublabel: `of ${p.skills.length} skills`,
                emphasis: p.skills.some((s) => !s.everRun) },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {() =>
          !p ? (
            <Panel title="No such plugin">
              <EmptyState
                illustration={{ src: '/assets/brand/state-notfound.png', width: 76, height: 96 }}
                icon={<Package />}
                title={`'${plugin}' is not a plugin the console lists`}
                description="It may have been renamed or removed. All plugins lists what is there."
              />
            </Panel>
          ) : (
            <>
              {/* What the plugin is, then what its skills did. */}
              <Row split="1/2">
                <Panel title="About this plugin">
                  <dl className="flex flex-col gap-3 text-[13px]">
                    <Field k="Does" v={<span className="text-ink-soft">{p.description ?? '—'}</span>} />
                    {/* DELIBERATE: no "whose" field. `origin` is hardcoded `platform` on
                        every catalog row, so it could only ever say "ours". */}
                    {p.owner ? <Field k="Owner" v={<span className="break-all font-mono text-xs">{p.owner}</span>} /> : null}
                    {/* DELIBERATE: the version and the digest render together or not at all.
                        The number is a claim and the digest is what makes it true, so a
                        version with no digest means release has not vouched for it — it was
                        never released, or has been edited since. */}
                    <Field
                      k="Version"
                      v={p.version
                        ? <span className="break-all font-mono text-xs">
                            {p.version}
                            {p.release
                              ? <span className="ml-2 text-ink-faint">+{p.release.digest}</span>
                              : <span className="ml-2 text-ink-faint">— not released</span>}
                          </span>
                        : <span className="text-ink-faint">declares none</span>}
                    />
                    <Field
                      k="Reaches"
                      v={p.servers.length
                        ? <span className="flex flex-wrap gap-1">
                            {p.servers.map((s) => (
                              <Badge key={s} variant={s === 'zz-core' ? 'accent' : 'neutral'}>{s}</Badge>
                            ))}
                          </span>
                        : <span className="text-ink-faint">no server — skills only</span>}
                    />
                  </dl>
                </Panel>

                <Panel title="The documents it governs" aside={p.gates ? `${p.gates} gated` : 'none'}>
                  {p.documents.length ? (
                    <ul className="flex flex-col gap-2 text-[13px]">
                      {p.documents.map((doc) => (
                        <li key={doc.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="min-w-0 break-all font-mono text-xs text-ink">{doc.name}</span>
                          {doc.gate
                            ? <Badge variant="accent" dot>a person must approve</Badge>
                            : <Badge variant="neutral">no approval needed</Badge>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-ink-faint">
                      None. This plugin produces no document and gates nothing — an assistant, not a
                      delivery method.
                    </p>
                  )}
                </Panel>
              </Row>

              {/* How it scored, and the way back to the report that says why. */}
              <Panel
                title="Latest evaluation"
                aside={p.latestEval
                  ? `${p.latestEval.headroomState} · measured at v${p.latestEval.version}`
                  : 'never evaluated'}
              >
                {p.latestEval ? (
                  <div className="flex flex-col gap-4">
                    {/* DELIBERATE: two axes, side by side and never added up. How good it
                        is and what is left to do are different questions — a plugin scoring 9
                        can still have something named to fix. */}
                    <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
                          Effectiveness
                        </p>
                        <EvalScore of={p.latestEval} className="text-3xl" />
                        <p className="mt-0.5 text-[13px] text-ink-soft">
                          {p.latestEval.band}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
                          Room to improve
                        </p>
                        <p className="text-3xl font-semibold tabular-nums text-ink">
                          {p.latestEval.headroomPoints === null
                            ? <span className="text-ink-faint">—</span>
                            : <>{p.latestEval.headroomPoints.toFixed(2)}
                                <span className="text-[0.7em] font-normal text-ink-faint"> pts</span></>}
                        </p>
                        <p className="mt-0.5 text-[13px] text-ink-soft">
                          {p.latestEval.headroomNamed === null
                            ? 'not recorded'
                            : p.latestEval.headroomNamed === 0
                              ? 'nothing named'
                              : `${p.latestEval.headroomNamed} named change${p.latestEval.headroomNamed === 1 ? '' : 's'} open`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
                          What is left to do
                        </p>
                        <p className="mt-1">
                          <EvalVerdict of={p.latestEval} />
                        </p>
                        {/* DELIBERATE: no recommendation. The state above reports what the
                            evidence says about the gap and prescribes nothing. */}
                      </div>
                    </div>
                    <p className="text-[13px] text-ink-soft">
                      {p.latestEval.initiative ? (
                        <>
                          Measured at <strong className="font-medium text-ink">v{p.latestEval.version}</strong> on{' '}
                          <Time value={p.latestEval.at} />.{' '}
                          <Link
                            href={`/initiatives/${p.latestEval.initiative.team}/${p.latestEval.initiative.slug}`}
                            className="font-medium text-accent hover:underline"
                          >
                            Read the evaluation →
                          </Link>
                        </>
                      ) : (
                        // DELIBERATE: absent, never guessed. A round that predates the
                        // platform recording which initiative produced it is not matched by
                        // plugin name and date — see journal 0116.
                        <>
                          Measured at <strong className="font-medium text-ink">v{p.latestEval.version}</strong> on{' '}
                          <Time value={p.latestEval.at} />. This round predates the platform
                          recording which initiative produced it, so there is no report to link.
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-faint">
                    No round has reached a verdict for this plugin. A score arrives when
                    zz-plugin-eval runs a round and records a recommendation.
                  </p>
                )}
              </Panel>

              <Panel
                title="Its skills"
                aside={`${p.skills.length} — pick one to read it and see what it scored`}
                padded={false}
              >
                <SkillTable plugin={plugin} skills={p.skills} />
              </Panel>
            </>
          )
        }
      </Query>
    </DashboardPage>
  );
}

/** The skills, ten rows at a time — its own component because a hook cannot run inside the
 *  `Query` render prop. */
function SkillTable({ plugin, skills }: { plugin: string; skills: PluginRow['skills'] }) {
  /* Stages first and in order, then everything else the plugin ships. `stages` carries the
     running order and the rest have none, so sorting alphabetically across both would put
     step 6 above step 2. */
  const rows = [...skills].sort((a, b) =>
    (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name));
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Skill</TableHead>
            {/* Kept, unlike the plugin-level "whose" above: a skill's origin is derived
                from a `source:` line in its own SKILL.md, so it varies the day a vendored
                skill ships. No skill carries one today, which makes the column quiet rather
                than constant. */}
            <TableHead hideBelow="md">Whose</TableHead>
            <TableHead hideBelow="lg">Versions</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead hideBelow="md">Last run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((s) => (
            <TableRow key={s.name}>
              <TableCell className="tabular-nums text-xs text-ink-faint">
                {/* The front door is unnumbered: it is not step zero, it is the plugin. */}
                {s.position ?? '—'}
              </TableCell>
              <TableCell className="break-words">
                <Link href={`/plugins/${plugin}/${s.name}`} className="font-medium text-accent hover:underline">
                  {s.name}
                </Link>
                {s.isEntry ? <span className="ml-2 text-xs text-ink-faint">the front door</span> : null}
              </TableCell>
              <TableCell hideBelow="md">
                {s.origin === 'theirs'
                  ? <Badge variant="accent" dot>the {plugin} team&rsquo;s</Badge>
                  : <Badge variant="neutral">ours</Badge>}
              </TableCell>
              <TableCell hideBelow="lg" className="tabular-nums text-xs">{s.versions || '—'}</TableCell>
              <TableCell className="tabular-nums">
                {s.everRun ? formatCount(s.calls) : '—'}
              </TableCell>
              <TableCell hideBelow="md" className="text-xs">
                {s.lastRun
                  ? <Time value={s.lastRun} className="text-ink-soft" />
                  : <Badge variant="neutral">never run</Badge>}
              </TableCell>
            </TableRow>
          ))}
          {skills.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-ink-faint">
                This plugin ships no skill — it grants an MCP surface and nothing else.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}

/** A label/value line, stacked — the card is half the page at most. */
function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

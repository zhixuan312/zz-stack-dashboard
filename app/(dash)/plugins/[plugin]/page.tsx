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
import { formatCount } from '@/lib/format';
import { useConsole, type PluginRow } from '@/lib/api';
import { pluginKind, pluginTitle } from '@/lib/plugin-labels';

/**
 * LAYER TWO: one plugin — what it is, what it reaches, and every skill it ships.
 *
 * Reads the same `/plugins` payload as the list rather than a per-plugin endpoint: there is
 * a handful of plugins, the response is small, and a second endpoint returning a subset of
 * the first is a second place for the shape to drift.
 *
 * ITS SKILLS, NOT ITS STAGES. The flow page listed the stages the manifest declares, which is
 * the method's running order and not its contents — sdlc ships seventeen skills and declares
 * seven, so ten of them had no page in the console that packages them. A stage's position is
 * shown where the method declares one; a skill that is simply shipped shows none.
 */
export default function PluginPage({ params }: { params: Promise<{ plugin: string }> }) {
  const { plugin } = use(params);
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const p = q.data?.plugins.find((x) => x.plugin === plugin);

  return (
    <DashboardPage
      title={p ? (p.agentName ? `${plugin} — ${p.agentName}` : pluginTitle({ plugin, title: p.title })) : plugin}
      breadcrumb={[{ label: 'Plugins', href: '/plugins' }, { label: plugin }]}
      // NO SUBTITLE. A manifest description runs to two full lines and sat under the title as
      // a wall of prose above the metrics. It is the first thing "What this plugin is" says —
      // read once, where the rest of what this plugin IS already lives.
      showPeriod={false}
      updatedAt={new Date()}
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
              {/* WHAT THE PLUGIN IS, then what its skills DID. */}
              <Row split="1/2">
                <Panel title="What this plugin is">
                  <dl className="flex flex-col gap-3 text-[13px]">
                    <Field k="Does" v={<span className="text-ink-soft">{p.description ?? pluginKind(p)}</span>} />
                    <Field
                      k="Whose"
                      v={p.origin === 'platform'
                        ? <Badge variant="accent" dot>ours</Badge>
                        : <Badge variant="neutral">a team&rsquo;s own service, reached over MCP</Badge>}
                    />
                    {p.owner ? <Field k="Owner" v={<span className="break-all font-mono text-xs">{p.owner}</span>} /> : null}
                    {/* THE VERSION AND THE DIGEST, TOGETHER OR NOT AT ALL. The declared number is
                        a claim — "sdlc 0.2 fixed it" — and the digest of what that version
                        actually contained is what makes it true. A version with no digest beside
                        it means nothing has vouched for that number: release writes the pair, and
                        this one has not been released — or has been edited since it was. */}
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
                    <Field
                      k="Evaluated"
                      v={p.eval
                        ? <span className="flex flex-wrap items-baseline gap-2">
                            <Badge variant="sage" dot>
                              {p.eval.meanDelta === null ? 'recorded' : `Δ ${p.eval.meanDelta.toFixed(2)}`}
                              {` over ${p.eval.cases} cases`}
                            </Badge>
                            <Time value={p.eval.ranAt} className="text-ink-faint" />
                          </span>
                        : <Badge variant="amber" dot>no ablation run recorded</Badge>}
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
  /* STAGES FIRST AND IN ORDER, then everything else the plugin ships. `stages` is the
     running order and the rest have none, so mixing them alphabetically would put step 6
     above step 2. */
  const rows = [...skills].sort((a, b) =>
    (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name));
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-right">#</TableHead>
            <TableHead>Skill</TableHead>
            <TableHead hideBelow="md">Whose</TableHead>
            <TableHead hideBelow="lg" className="text-right">Versions</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead hideBelow="md">Last run</TableHead>
            <TableHead hideBelow="lg" className="text-right">Evals</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((s) => (
            <TableRow key={s.name}>
              <TableCell className="text-right tabular-nums text-xs text-ink-faint">
                {/* THE FRONT DOOR IS UNNUMBERED. It is not step zero, it is the
                    plugin — which its own name already says. */}
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
              <TableCell hideBelow="lg" className="text-right tabular-nums text-xs">{s.versions || '—'}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.everRun ? formatCount(s.calls) : '—'}
              </TableCell>
              <TableCell hideBelow="md" className="text-xs">
                {s.lastRun
                  ? <Time value={s.lastRun} className="text-ink-soft" />
                  : <Badge variant="neutral">never run</Badge>}
              </TableCell>
              <TableCell hideBelow="lg" className="text-right tabular-nums text-xs">{s.evals || '—'}</TableCell>
            </TableRow>
          ))}
          {skills.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-ink-faint">
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

'use client';

import { use } from 'react';
import Link from 'next/link';
import { Blocks } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { BarList } from '@/components/charts/BarList';
import {
  Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Block, type BlockDetail } from '@/lib/api';
import { blockKind, blockTitle } from '@/lib/block-labels';

/**
 * One block at a time, NEVER aggregated.
 *
 * Averaging the blocks together hides the only thing worth knowing about them:
 * one block may refuse a large share of calls where another refuses almost none, and a
 * combined "block failure rate" is a number describing neither. `platform` is in
 * the same tab strip on purpose — the worst-refusing tool on the platform is
 * ours, and a view that covered only third parties would never have shown it.
 */

/** What a refusal actually means, from its text.
 *
 * The distinction that decides WHO FIXES IT: a 403 is our grant being too
 * narrow, a 422 is us sending the wrong shape, "fully booked" is the block
 * working correctly, and a 5xx is the far side being down. Lumping them into
 * one "errors" count is how a healthy block looks broken. */
function cause(refusal: string): { label: string; tone: 'sage' | 'amber' | 'rose' | 'neutral' } {
  const r = refusal.toLowerCase();
  if (/fully booked|already|not allowed|gate|approved and carries/.test(r)) return { label: 'by design', tone: 'sage' };
  if (/50\d|503|502|timeout|unavailable/.test(r)) return { label: 'outage', tone: 'amber' };
  if (/40[13]|forbidden|unauthor/.test(r)) return { label: 'scope', tone: 'rose' };
  if (/422|400|unprocessable|bad request/.test(r)) return { label: 'payload', tone: 'rose' };
  if (/invalid arguments|validation error|missing/.test(r)) return { label: 'schema', tone: 'rose' };
  if (/404|no such|does not exist/.test(r)) return { label: 'caller error', tone: 'neutral' };
  return { label: 'other', tone: 'neutral' };
}

export default function BlockPage({ params }: { params: Promise<{ block: string }> }) {
  const { block: name } = use(params);
  const list = useConsole<{ blocks: Block[] }>('/blocks');
  const block = list.data?.blocks.find((b) => b.block === name);
  const known = !list.data || !!block;
  const detail = useConsole<BlockDetail>(known ? `/blocks/${name}` : null);

  return (
    <DashboardPage
      title={block ? blockTitle(block) : name}
      breadcrumb={[{ label: 'Blocks', href: '/blocks' }, { label: name }]}
      showPeriod={false}
      updatedAt={new Date()}
      metrics={
        block
          ? [
              { label: 'Calls', value: formatCount(block.calls), sublabel: `${block.tools} distinct tools` },
              { label: 'Refused', value: formatCount(block.failed),
                sublabel: `${block.failureRate}% of all calls`, emphasis: block.failureRate > 5 },
              { label: 'Flow steps using it', value: String(block.steps), sublabel: 'recorded' },
              { label: 'Versions seen', value: block.versions ? String(block.versions) : '—',
                sublabel: block.versions > 5 ? 'it redeploys constantly' : `${block.firstSeen} → ${block.lastSeen}` },
            ]
          : undefined
      }
      rail={
        block ? (
          <div className="flex flex-col gap-4">
            <Panel title="What this block is">
              <dl className="flex flex-col gap-3 text-[13px]">
                <Row k="Kind" v={<span className="text-ink-soft">{block ? blockKind(block) : '—'}</span>} />
                <Row
                  k="Whose"
                  v={block.origin === 'platform'
                    ? <span className="text-ink-soft">Ours — zz-core, in zz-stack. The block every flow uses.</span>
                    : <span className="text-ink-soft">A team&rsquo;s own service, reached over MCP.</span>}
                />
                <Row k="Seen" v={<span className="font-mono text-xs">{block.firstSeen} → {block.lastSeen}</span>} />
              </dl>
            </Panel>
            <Query query={detail} skeletonRows={4}>
              {(d) => (
                <Panel title="Which flow steps call it" aside={`${d.steps.length}`}>
                  <BarList
                    rows={d.steps.map((x) => ({
                      key: x.step, label: x.step, value: x.calls,
                      caption: x.failed ? `${x.failed} refused` : undefined,
                      tint: x.failed ? 'rose' : undefined,
                    }))}
                  />
                </Panel>
              )}
            </Query>
          </div>
        ) : undefined
      }
    >
      <Query query={list}>
        {() => (
          <>
            {!known ? (
              <Panel title="No such block">
                <EmptyState
                  icon={<Blocks />}
                  title={`'${name}' is not a block the console lists`}
                  description="This console lists the blocks the platform has actually recorded a call to. A name it does not know is one PLATFORMS never registered, or one nothing has called yet."
                />
              </Panel>
            ) : block ? (
              <>
                <Query query={detail} skeletonRows={6}>
                  {(d) => {
                    const causes = new Map<string, { n: number; tone: string }>();
                    d.refusals.forEach((r) => {
                      const c = cause(r.refusal ?? '');
                      const got = causes.get(c.label);
                      causes.set(c.label, { n: (got?.n ?? 0) + r.n, tone: c.tone });
                    });
                    return (
                      <>
                        {/* THE SKILLS THIS BLOCK CARRIES, and whose they are. The
                            distinction is the page's whole point: a skill marked
                            THEIRS is the block team's own, vendored, and changing
                            it means agreeing a change with them; OURS is what we
                            worked out by calling their server and is ours to fix.
                            The test is the `source:` line in the file, not a list
                            kept here — a list would quietly default a newly
                            published skill of theirs to "ours". */}
                        {block.skills.length ? (
                          <Panel
                            title="The skills it carries"
                            aside={`${block.skills.filter((x) => x.origin === 'theirs').length} theirs · ${block.skills.filter((x) => x.origin === 'ours').length} ours — pick one to read it`}
                            padded={false}
                          >
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Skill</TableHead>
                                  <TableHead>Whose</TableHead>
                                  <TableHead className="text-right">Version</TableHead>
                                  <TableHead>What it is for</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {block.skills.map((sk) => (
                                  <TableRow key={sk.name}>
                                    <TableCell>
                                      <Link href={`/blocks/${name}/${sk.name}`}
                                            className="font-mono text-xs font-medium text-accent hover:underline">
                                        {sk.name}
                                      </Link>
                                    </TableCell>
                                    <TableCell>
                                      {sk.origin === 'theirs'
                                        ? <Badge variant="accent" dot>theirs</Badge>
                                        : <Badge variant="neutral">ours</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs">{sk.version ?? '—'}</TableCell>
                                    <TableCell className="max-w-[62ch] text-xs text-ink-soft" title={sk.source ?? ''}>
                                      {sk.description ?? '—'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Panel>
                        ) : null}

                        <Panel title="Which tools it is called with" aside={`${d.tools.length} shown`}>
                          <BarList
                            limit={14}
                            rows={d.tools.map((t) => ({
                              key: t.tool,
                              label: <span className="font-mono text-xs">{t.tool}</span>,
                              value: t.calls,
                              caption: t.failed ? `${t.failed} refused — ${Math.round((t.failed / t.calls) * 100)}%` : undefined,
                              tint: t.failed / t.calls > 0.3 ? 'rose' : t.failed ? 'amber' : undefined,
                            }))}
                          />
                        </Panel>

                        <Panel title="Refusals by cause" aside="who fixes it">
                            <BarList
                              rows={[...causes.entries()].map(([label, v]) => ({
                                key: label, label, value: v.n,
                                tint: v.tone as 'sage' | 'amber' | 'rose' | undefined,
                              }))}
                            />
                            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                              <b>by design</b> — the tool working correctly · <b>scope</b> — our grant is too
                              narrow · <b>payload</b> — we send the wrong shape · <b>schema</b> — the error
                              names no field · <b>outage</b> — the far side was down
                            </p>
                        </Panel>

                        <Panel title="Every refusal recorded" padded={false}>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tool</TableHead>
                                  <TableHead className="text-right">n</TableHead>
                                  <TableHead>Refusal</TableHead>
                                  <TableHead>Cause</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {d.refusals.map((r, i) => {
                                  const c = cause(r.refusal ?? '');
                                  return (
                                    <TableRow key={`${r.tool}-${i}`}>
                                      <TableCell className="font-mono text-xs">{r.tool}</TableCell>
                                      <TableCell className="text-right font-medium tabular-nums">{r.n}</TableCell>
                                      <TableCell className="max-w-[34ch] truncate text-xs" title={r.refusal ?? ''}>
                                        {r.refusal}
                                      </TableCell>
                                      <TableCell><Badge variant={c.tone} dot>{c.label}</Badge></TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                        </Panel>

                        <Panel title="Event log" aside="most recent calls, exactly as recorded" padded={false}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>When</TableHead>
                                <TableHead>Tool</TableHead>
                                <TableHead>Step</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Refusal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {d.feed.map((e, i) => (
                                <TableRow key={i}>
                                  <TableCell><Time value={e.ts} /></TableCell>
                                  <TableCell className="font-mono text-xs text-ink">{e.tool}</TableCell>
                                  <TableCell className="text-xs">{e.step || <span className="text-ink-faint">—</span>}</TableCell>
                                  <TableCell>
                                    {e.ok ? <Badge variant="sage" dot>ok</Badge> : <Badge variant="rose" dot>refused</Badge>}
                                  </TableCell>
                                  <TableCell className="max-w-[38ch] truncate text-xs text-[var(--rose-deep)]" title={e.refusal ?? ''}>
                                    {e.refusal ?? ''}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Panel>
                      </>
                    );
                  }}
                </Query>
              </>
            ) : null}
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

/** A label/value line in the rail's identity panel. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

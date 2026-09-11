'use client';

import { use } from 'react';
import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type FlowRow } from '@/lib/api';

/**
 * LAYER TWO: one flow — what it is, and its steps in declared order.
 *
 * Reads the same `/flows` payload as the list rather than a per-flow endpoint:
 * there are four flows, the response is small, and a second endpoint returning a
 * subset of the first is a second place for the shape to drift.
 */
export default function FlowPage({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = use(params);
  const q = useConsole<{ flows: FlowRow[] }>('/flows');
  const f = q.data?.flows.find((x) => x.flow === flow);

  return (
    <DashboardPage
      title={f?.agentName ? `${flow} — ${f.agentName}` : flow}
      breadcrumb={[{ label: 'Flows', href: '/flows' }, { label: flow }]}
      // NO SUBTITLE. The manifest description runs to two full lines and sat under
      // the title as a wall of prose above the metrics. It is the first thing the
      // rail's identity panel says now — read once, where the rest of what this
      // flow IS already lives.
      showPeriod={false}
      updatedAt={new Date()}
      scroll="inner"
      metrics={
        f
          ? [
              { label: 'Steps', value: String(f.steps.length), sublabel: 'skills, in declared order' },
              { label: 'Gates', value: String(f.gates),
                sublabel: f.gates ? 'a person must approve' : 'an assistant, not a delivery method' },
              { label: 'Calls', value: formatCount(f.steps.reduce((a, s) => a + s.calls, 0)),
                sublabel: 'across every step' },
              { label: 'Never run', value: String(f.steps.filter((s) => !s.everRun).length),
                sublabel: `of ${f.steps.length} steps`,
                emphasis: f.steps.some((s) => !s.everRun) },
            ]
          : undefined
      }
      // WHAT THE FLOW IS in the rail; what its steps DID in the main column —
      // the same division as every other detail page on this console.
      rail={
        f ? (
          <div className="flex flex-col gap-4">
            <Panel title="What this flow is">
              <dl className="flex flex-col gap-3 text-[13px]">
                <Row k="Does" v={<span className="text-ink-soft">{f.description ?? '—'}</span>} />
                <Row k="Owner" v={<span className="font-mono text-xs">{f.owner}</span>} />
                <Row k="Version" v={<span className="font-mono text-xs">{f.version ?? '—'}</span>} />
                <Row
                  k="Uses"
                  v={<span className="flex flex-wrap gap-1">
                    {f.blocks.map((b) => (
                      <Badge key={b} variant={b === 'platform' ? 'accent' : 'neutral'}>{b}</Badge>
                    ))}
                  </span>}
                />
                <Row
                  k="Installed on"
                  v={f.installs.length
                    ? <span className="text-ink-soft">{f.installs.map((i) => `${i.team} (v${i.version})`).join(', ')}</span>
                    : <span className="text-ink-faint">nobody has installed it</span>}
                />
              </dl>
            </Panel>

            <Panel title="The documents it governs" aside={f.gates ? `${f.gates} gated` : 'none'}>
              {f.documents.length ? (
                <ul className="flex flex-col gap-2 text-[13px]">
                  {f.documents.map((doc) => (
                    <li key={doc.name} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-ink">{doc.name}</span>
                      {doc.gate
                        ? <Badge variant="accent" dot>a person must approve</Badge>
                        : <Badge variant="neutral">no approval needed</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-faint">
                  None. This flow produces no document and gates nothing — an assistant, not a
                  delivery method.
                </p>
              )}
            </Panel>
          </div>
        ) : undefined
      }
    >
      <Query query={q}>
        {() =>
          !f ? (
            <Panel title="No such flow">
              <EmptyState
                icon={<Boxes />}
                title={`'${flow}' is not in the catalog`}
                description="It may have been renamed or removed. All flows lists what is there."
              />
            </Panel>
          ) : (
            <Panel
              title="Its skills, in order"
              aside={`${f.steps.length} — pick one to see how it runs and what it scored`}
              padded={false}
              className="h-full min-h-0"
            >
              <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-right">#</TableHead>
                    <TableHead>Skill</TableHead>
                    <TableHead className="text-right">Versions</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead className="text-right">Evals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* THE FLOW ITSELF, first and unnumbered. `stages` lists the steps and
                      not the front door, so the one skill describing the whole method was
                      the only one this page could not reach. No position number: it is not
                      step zero, it is the flow — which its own name already says. */}
                  {f.entry ? (
                    <TableRow key={f.entry.name}>
                      <TableCell className="text-right text-xs text-ink-faint">—</TableCell>
                      <TableCell>
                        <Link href={`/flows/${flow}/${f.entry.name}`}
                              className="font-medium text-accent hover:underline">
                          {f.entry.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{f.entry.versions || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.entry.everRun ? formatCount(f.entry.calls) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {f.entry.lastRun
                          ? <span className="font-mono text-ink-soft">{f.entry.lastRun}</span>
                          : <Badge variant="neutral">never run</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{f.entry.evals || '—'}</TableCell>
                    </TableRow>
                  ) : null}
                  {f.steps.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="text-right tabular-nums text-xs text-ink-faint">{s.position}</TableCell>
                      <TableCell>
                        <Link href={`/flows/${flow}/${s.name}`} className="font-medium text-accent hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{s.versions || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.everRun ? formatCount(s.calls) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {s.lastRun
                          ? <span className="font-mono text-ink-soft">{s.lastRun}</span>
                          : <Badge variant="neutral">never run</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{s.evals || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Panel>
          )
        }
      </Query>
    </DashboardPage>
  );
}

/** A label/value line in the rail, stacked — the rail is a third of the page. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

'use client';

import { Activity, HardDrive, Timer } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConsolePage, useArrival } from '@/console/page';
import { usePeriod } from '@/console/period';
import { failureOf } from '@/console/query';
import { SkillWorkPanel } from '@/console/skill-work';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Runs, Skill } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';
import { PERIOD_LABEL } from '@/lib/period';
import { useLive } from '@/lib/live';
import { addressOf, pendingContext } from '@/views/context';
import { runsContext } from '@/views/runs-context';

/**
 * Every recorded run, by the skill that drove it. Both reads take the window: tiles answering all time above a table
 * answering the picker would put two true numbers about different spans an inch apart.
 */
export default function RunsPage() {
  useLive(['runs', 'skills']);
  const { period } = usePeriod();
  const q = (path: string) => (period === 'all' ? path : `${path}?period=${period}`);
  const runs = useConsole<Runs>(q('/runs'));
  const skills = useConsole<{ skills: Skill[] }>(q('/skills'));
  const r = runs.data?.totals;
  const arrival = useArrival(runs, skills);
  const context = runs.data && skills.data
    ? runsContext({ totals: runs.data.totals, skills: skills.data.skills, period, ...arrival })
    : pendingContext({ view: 'runs', title: 'Runs', address: addressOf('/runs', { period }, { period: 'all' }), scope: `${PERIOD_LABEL[period].toLowerCase()}, every team on the platform` }, failureOf(runs) ?? failureOf(skills));

  return (
    <ConsolePage title="Runs" description="Every recorded run, by the skill that drove it." updatedAt={freshnessOf(runs, skills)} context={context}>
      {/* The tiles stand from the first paint and read an ellipsis until the totals arrive, so nothing moves.
          COUPLED: `…` means coming, `—` means it is not. They were the same mark, so a failed read
          looked exactly like a slow one. */}
      <Row split="tiles">
        <MetricTile label="Runs" icon={<Timer />} value={r ? r.runs : runs.isPending ? '…' : '—'} note="Skill sessions recorded" />
        {/* "Calls in runs", not "Tool calls": the Overview counts every call, and calls no run claimed are not here. */}
        <MetricTile label="Calls in runs" icon={<Activity />} value={r ? r.calls : runs.isPending ? '…' : '—'} note={r ? `${formatCount(r.refusals)} refused` : 'Refused calls beside it'} />
        {/* Null is not zero: a window with no measured run has moved nothing anyone counted. */}
        <MetricTile label="Payload moved" icon={<HardDrive />} value={!r ? runs.isPending ? '…' : '—' : r.mb === null ? 'Not measured' : r.mb} format={(n) => `${n.toLocaleString('en-US')} MB`} note="Tool output, across those runs" />
      </Row>
      {runs.error && runs.error.status !== 401 ? <EmptyState kind="error" title="The run totals did not load" action={<Button size="sm" onClick={() => void runs.refetch()}>Retry</Button>}>{runs.error.message}</EmptyState> : null}
      <SkillWorkPanel skills={skills.data?.skills ?? []} loading={skills.isPending} error={failureOf(skills)} onRetry={() => void skills.refetch()} />
    </ConsolePage>
  );
}

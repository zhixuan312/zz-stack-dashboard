'use client';

import { Activity, HardDrive, Timer } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsolePage } from '@/console/page';
import { usePeriod } from '@/console/period';
import { Query } from '@/console/query';
import { SkillWorkPanel } from '@/console/skill-work';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Runs, Skill } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

/**
 * Every recorded run, by the skill that drove it. Both reads take the window: tiles answering all time above a table
 * answering the picker would put two true numbers about different spans an inch apart.
 */
export default function RunsPage() {
  const { period } = usePeriod();
  const q = (path: string) => (period === 'all' ? path : `${path}?period=${period}`);
  const runs = useConsole<Runs>(q('/runs'));
  const skills = useConsole<{ skills: Skill[] }>(q('/skills'));

  return (
    <ConsolePage title="Runs" description="Every recorded run, by the skill that drove it." updatedAt={freshnessOf(runs, skills)}>
      <Query query={runs} skeleton={<Skeleton className="h-36 rounded-lg" />}>
        {(r) => (
          <Row split="tiles">
            <MetricTile label="Runs" icon={<Timer />} value={r.totals.runs} note="Skill sessions recorded" />
            {/* "Calls in runs", not "Tool calls": the Overview counts every call, and calls no run claimed are not here. */}
            <MetricTile label="Calls in runs" icon={<Activity />} value={r.totals.calls} note={`${formatCount(r.totals.refusals)} refused`} />
            {/* Null is not zero: a window with no measured run has moved nothing anyone counted. */}
            <MetricTile label="Payload moved" icon={<HardDrive />} value={r.totals.mb === null ? 'Not measured' : r.totals.mb} format={(n) => `${n.toLocaleString('en-US')} MB`} note="Tool output, across those runs" />
          </Row>
        )}
      </Query>
      <Query query={skills} skeleton={<Skeleton className="h-96 rounded-lg" />}>
        {(s) => <SkillWorkPanel skills={s.skills} />}
      </Query>
    </ConsolePage>
  );
}

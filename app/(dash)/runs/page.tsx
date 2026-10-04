'use client';

import { DashboardPage } from '@/console-old/DashboardPage';
import { Query } from '@/console-old/Query';
import { SkillWorkPanel } from '@/console-old/SkillWorkPanel';
import { usePeriod } from '@/console/period';
import { MetricCard, Row, SkeletonPage } from '@/console-old/ui';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole } from '@/lib/api';
import { type Runs, type Skill } from '@/lib/api-shapes';

export default function RunsPage() {
  const { period } = usePeriod();
  /* Both routes take the window. The tiles sit directly above the panel, so one answering
     all time while the other answered the picker puts two true numbers about different
     spans an inch apart, with nothing on the page saying which is which. */
  const q = (path: string) => (period === 'all' ? path : `${path}?period=${period}`);
  const runs = useConsole<Runs>(q('/runs'));
  const skills = useConsole<{ skills: Skill[] }>(q('/skills'));

  return (
    <DashboardPage
      title="Runs"
      description="Every recorded run, by the skill that drove it."
      updatedAt={freshnessOf(runs, skills)}
    >
      <Query query={runs} skeleton={<SkeletonPage metrics={3} />}>
        {(r) => (
          <>
            <Row split="1/4">
              <MetricCard label="Runs" description="skill sessions recorded"
                value={formatCount(r.totals.runs)} />
              {/* "Calls in runs", not "Tool calls": the Overview's tile of that name counts
                  every call, and calls no run claimed are missing here — two different
                  totals for one window under one name read as a bug. */}
              <MetricCard label="Calls in runs" description="tool calls a run made"
                value={formatCount(r.totals.calls)}
                sublabel={`${formatCount(r.totals.refusals)} refused`} />
              {/* `mb` is `sum(bytes_total)`, SQL-null for any window with no run. Null is
                  not zero, and interpolating it raw renders the text "null MB". */}
              <MetricCard label="Payload moved" description="tool output, across those runs"
                value={r.totals.mb === null ? '—' : `${r.totals.mb} MB`} />
            </Row>

            {/* DELIBERATE: no turns tile here. `zz.run.turns` is written by nothing, so a
                tile over it can only ever read "—". */}
            <Query query={skills} skeletonRows={6}>
              {(s) => <SkillWorkPanel skills={s.skills} />}
            </Query>
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

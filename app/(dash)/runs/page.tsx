'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Query } from '@/components/Query';
import { SkillWorkPanel } from '@/components/SkillWorkPanel';
import { usePeriod } from '@/components/PeriodProvider';
import { MetricCard, Row } from '@/components/ui';
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
      <Query query={runs}>
        {(r) => (
          <>
            <Row split="1/4">
              <MetricCard label="Runs" value={formatCount(r.totals.runs)} />
              <MetricCard label="Tool calls" value={formatCount(r.totals.calls)}
                sublabel={`${formatCount(r.totals.refusals)} refused`} />
              {/* `mb` is `sum(bytes_total)`, SQL-null for any window with no run. Null is
                  not zero, and interpolating it raw renders the text "null MB". */}
              <MetricCard label="Payload moved"
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

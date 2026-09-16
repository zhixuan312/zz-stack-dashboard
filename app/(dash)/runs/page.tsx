'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Query } from '@/components/Query';
import { SkillWorkPanel } from '@/components/SkillWorkPanel';
import { usePeriod } from '@/components/PeriodProvider';
import { Banner, MetricCard, Row } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Runs, type Skill } from '@/lib/api';

export default function RunsPage() {
  /* THE PICKER IS ON NOW. It was hidden because /skills had no window and answered all time
     whatever was asked — so a page headed "Runs" sat beside every other view's last-24-hours
     and quietly meant something else. The endpoint takes `period` and this passes it. */
  const { period } = usePeriod();
  /* BOTH routes take the window, and both must. The tiles sit directly above the panel, so
     one of them answering all time while the other answered the picker put "336 runs" and
     "62 runs" an inch apart on the same screen — two true numbers about different spans,
     with nothing on the page saying which was which. */
  const q = (path: string) => (period === 'all' ? path : `${path}?period=${period}`);
  const runs = useConsole<Runs>(q('/runs'));
  const skills = useConsole<{ skills: Skill[] }>(q('/skills'));

  return (
    <DashboardPage
      title="Runs"
      description="Every recorded run, by the skill that drove it."
      updatedAt={new Date()}
    >
      <Query query={runs}>
        {(r) => (
          <>
            <Row split="1/4">
              <MetricCard label="Runs" value={formatCount(r.totals.runs)} />
              <MetricCard label="Tool calls" value={formatCount(r.totals.calls)}
                sublabel={`${formatCount(r.totals.refusals)} refused`} />
              {/* The sublabel is a CLAIM, so it only appears when there is something to
                  claim it about. It read "recorded, but not linked to a run" beside a zero
                  on a platform that has never run anything, which describes a defect that
                  is really an empty table. */}
              <MetricCard label="LLM turns" value={r.gaps.turnEvents ? formatCount(r.gaps.turnEvents) : '—'}
                sublabel={r.gaps.turnEvents && !r.gaps.turnsAttributed ? 'recorded, but not linked to a run' : undefined}
                emphasis muted={!r.gaps.turnsAttributed} />
              <MetricCard label="Payload moved" value={`${r.totals.mb} MB`} />
            </Row>

            {/* The gaps are stated as data, not as a hardcoded caveat — they
                disappear from the page by themselves the day the platform
                starts recording these. */}
            {!r.gaps.turnsAttributed ? (
              <Banner
                variant="warning"
                title="Turns are recorded but not attributed"
                description={`zz.run.turns is 0 on all ${r.totals.runs} rows, while the event log holds ${formatCount(r.gaps.turnEvents)} turn events with no step and no run id. Cost per document is therefore unanswerable today. It is a one-column platform fix.`}
              />
            ) : null}

            <Query query={skills} skeletonRows={6}>
              {(s) => <SkillWorkPanel skills={s.skills} />}
            </Query>
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

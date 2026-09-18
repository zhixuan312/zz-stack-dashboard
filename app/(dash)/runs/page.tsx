'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Query } from '@/components/Query';
import { SkillWorkPanel } from '@/components/SkillWorkPanel';
import { usePeriod } from '@/components/PeriodProvider';
import { MetricCard, Row } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole, type Runs, type Skill } from '@/lib/api';

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
      updatedAt={freshnessOf(runs, skills)}
    >
      <Query query={runs}>
        {(r) => (
          <>
            <Row split="1/4">
              <MetricCard label="Runs" value={formatCount(r.totals.runs)} />
              <MetricCard label="Tool calls" value={formatCount(r.totals.calls)}
                sublabel={`${formatCount(r.totals.refusals)} refused`} />
              {/* NULL IS NOT ZERO, and it is not the string "null" either. `mb` is
                  `sum(bytes_total)`, which is SQL-null for any window with no run — the
                  tile rendered the literal text "null MB". Every other figure on this page
                  goes through a formatter; this one was interpolated raw. */}
              <MetricCard label="Payload moved"
                value={r.totals.mb === null ? '—' : `${r.totals.mb} MB`} />
            </Row>

            {/* THE TURNS TILE AND ITS CAVEAT ARE GONE. Both read `zz.run.turns`, a column
                written by nothing, beside an event kind nothing emits — so the tile could
                only ever read "—" and the banner beneath it, "turns are recorded but not
                attributed", could never clear. A warning watching a column no code will
                ever fill teaches the reader to skip the warnings that mean something. */}
            <Query query={skills} skeletonRows={6}>
              {(s) => <SkillWorkPanel skills={s.skills} />}
            </Query>
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

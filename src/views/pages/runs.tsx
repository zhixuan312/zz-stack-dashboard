'use client';

import { HardDrive, Timer, Trophy } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { SkillWorkPanel } from '@/console/skill-work';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Runs } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { formatKb } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { runsContext, runsPath } from '@/views/runs-context';

/**
 * Every run the active team recorded since its first, by the skill that drove it. A run's bytes are its observed
 * output: the response bytes of its own calls, never what a model read and never a cost.
 */
/** A byte count as the tiles show it. */
const kb = (bytes: number): string => formatKb(bytes / 1024);

export function RunsView() {
  useLive(['runs']);
  const q = useConsole<Runs>(runsPath('all'));
  const r = q.data;
  const arrival = useArrival(q);
  const context = r
    ? runsContext(r, { skill: 'all', ...arrival })
    : pendingContext({ view: 'runs', title: 'Runs', address: '/runs', scope: 'your active team\'s runs' }, failureOf(q));
  const bySkill = r?.bySkill.state === 'ok' ? r.bySkill.data.rows : [];
  // COUPLED: `…` means coming, `—` means it is not. They were the same mark, so a failed read looked exactly like a slow one.
  const mark = q.isPending ? '…' : '—';

  return (
    <ConsolePage
      title="Runs"
      description="Every run your team recorded, by the skill that drove it."
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <Row split="tiles">
        <MetricTile label="Runs" icon={<Timer />} value={r?.tiles.runs.value ?? mark} note={r?.since ? `Since ${formatDate(r.since)}` : 'Skill runs recorded'} />
        {/* Null is not zero: a run nothing measured has answered nothing anyone counted. */}
        {/* Bytes go in as a number with their formatter, as every other tile's figure does: a formatted string is a word
            value, which wraps on a phone and grew the tile when the read landed (CLS 0.138 on /runs). */}
        <MetricTile label="Observed output per run" icon={<HardDrive />} value={!r ? mark : r.tiles.outputPerRun.value ?? 'Not measured'} format={kb}
                    note={r?.tiles.outputPerRun.unmeasured ? `${r.tiles.outputPerRun.unmeasured} not measured` : 'Response bytes of its own calls'} />
        <MetricTile label="Largest run" icon={<Trophy />} value={!r ? mark : r.tiles.largest?.bytes ?? 'None measured'} format={kb} note={r?.tiles.largest ? r.tiles.largest.skill : 'Its skill'} />
      </Row>
      {q.error && q.error.status !== 401 ? <EmptyState kind="error" title="The runs did not load" action={<Button size="sm" onClick={() => void q.refetch()}>Retry</Button>}>{q.error.message}</EmptyState> : null}
      <SkillWorkPanel
        skills={bySkill}
        loading={q.isPending}
        error={failureOf(q) ?? (r?.bySkill.state === 'unavailable' ? r.bySkill.reason : undefined)}
        onRetry={() => void q.refetch()}
        ask={<AskAbout question="Which skill's runs answer the most output, and why does it matter?" />}
      />
    </ConsolePage>
  );
}

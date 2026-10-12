/** The Runs page's shared context (decision 0011): every recorded run, by the skill that drove it. */
import type { Runs, Skill } from '@/lib/api-shapes';
import { formatCount, formatKb, formatSeconds, plural } from '@/lib/format';
import { PERIOD_LABEL, type Period } from '@/lib/period';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, type Arrival } from './context';

export function runsContext({ totals, skills, period, ...arrival }: { totals: Runs['totals']; skills: Skill[]; period: Period } & Arrival): SharedContext {
  const ran = skills.filter((s) => s.runs > 0);
  const insights: Insight[] = [];
  const busiest = ran.reduce<Skill | null>((a, s) => (!a || s.runs > a.runs ? s : a), null);
  if (busiest) insights.push({ text: `${busiest.name} drove the most runs: ${formatCount(busiest.runs)} of ${formatCount(totals.runs)} (${shareOf(busiest.runs, totals.runs)}), at ${busiest.callsAvg.toFixed(1)} calls a run.` });
  const refusing = ran.filter((s) => s.calls >= 20 && s.refusals / s.calls > 0.05).sort((a, b) => b.refusals / b.calls - a.refusals / a.calls);
  if (refusing.length) insights.push({ text: `Skills refused on more than 5% of their calls: ${listed(refusing, (s) => `${s.name} ${((s.refusals / s.calls) * 100).toFixed(1)}% (${formatCount(s.refusals)} of ${formatCount(s.calls)})`, 'see /runs', 8)}.` });
  const heaviest = ran.filter((s) => s.kbPerRun !== null).reduce<Skill | null>((a, s) => (!a || (s.kbPerRun as number) > (a.kbPerRun as number) ? s : a), null);
  if (heaviest) insights.push({ text: `${heaviest.name} pulls the most into context: ${formatKb(heaviest.kbPerRun)} of tool output a run.` });
  if (ran.length) insights.push({ text: `By skill: ${listed([...ran].sort((a, b) => b.runs - a.runs), (s) => `${s.name} (${formatCount(s.runs)} ${plural(s.runs, 'run')}, ${formatCount(s.calls)} calls, median ${s.durationMedian === null ? 'not timed' : formatSeconds(s.durationMedian)}${s.retired ? ', retired' : ''})`, 'see /runs', 15)}.` });
  return budgeted({
    view: 'runs',
    title: 'Runs',
    address: addressOf('/runs', { period }, { period: 'all' }),
    scope: `${PERIOD_LABEL[period].toLowerCase()}, every team on the platform`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Runs', value: formatCount(totals.runs), definition: 'Skill sessions recorded: a run is one skill being followed by one caller.' },
      { label: 'Calls in runs', value: formatCount(totals.calls), change: `${formatCount(totals.refusals)} refused`, definition: 'Tool calls a run claimed. The Overview counts every call; calls no run claimed are not here.' },
      { label: 'Payload moved', value: totals.mb === null ? 'not measured' : `${totals.mb.toLocaleString('en-US')} MB`, definition: 'Tool output across those runs.' },
    ],
    insights,
    unknowns: [
      ...(totals.mb === null ? ['No run in this period had its output measured, so the payload is unknown, not zero.'] : []),
      'A run is timed only when it has more than one call: a single call has one timestamp and no span.',
      ...(ran.length ? [] : ['No run was recorded in this period.']),
    ],
  });
}

/**
 * The Runs page's shared context (decision 0011): every run the active team recorded since its first, by the skill that
 * drove it and lately, from the one `Runs` the gateway answered. A run's bytes are the response bytes of its own calls,
 * its observed output, which is neither what a model read nor anything paid for; and a run is never said to be running.
 */
import type { RunRow, Runs } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** The rows one page of the recent runs holds. */
const PAGE_SIZE = 10;

/** The gateway address of the team's runs, narrowed to `skill` unless it is `all`, `limit` recent runs from `offset`. */
export function runsPath(skill: string, { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams();
  if (skill !== 'all') p.set('skill', skill);
  p.set('limit', String(limit));
  p.set('offset', String(offset));
  return `/runs?${p}`;
}

/** Observed output in words, from bytes; a run nothing measured has none to quote. */
export const outputOf = (bytes: number | null): string => (bytes === null ? 'not measured' : formatKb(bytes / 1024));

/** How a run stands, in words: active while its last call is recent, never running beyond it. */
const stateOf = (r: RunRow): string => (r.state === 'active' ? 'active' : r.state === 'one_call' ? 'one call' : `last call ${formatDateTime(r.lastCallAt)}`);

export function runsContext(runs: Runs, { skill, ...arrival }: { skill: string } & Arrival): SharedContext {
  const { tiles, coverage } = runs;
  const insights: Insight[] = [];
  const bySkill = runs.bySkill.state === 'ok' ? runs.bySkill.data.rows : [];
  const recent = runs.recent.state === 'ok' ? runs.recent.data : null;
  insights.push({ text: `The runs cover ${formatSeconds(coverage.coverageMs / 1000)}, overlapping time counted once, against ${formatSeconds(coverage.summedMs / 1000)} summed; at most ${coverage.peak} ran at once, and ${formatCount(coverage.oneCall)} ${plural(coverage.oneCall, 'was', 'were')} one call.` });
  if (bySkill.length) {
    insights.push({ text: `By skill, the most observed output per run first: ${listed(bySkill, (s) => `${s.skill} (${formatCount(s.runs)} ${plural(s.runs, 'run')}, ${s.outputPerRun === null ? 'output not measured' : `${formatKb(s.outputPerRun / 1024)} a run`}, ${s.typicalMs === null ? 'none longer than one call' : `typically ${formatSeconds(s.typicalMs / 1000)}`}${s.shareRefused ? `, ${(s.shareRefused * 100).toFixed(1)}% refused` : ''})`, 'see /runs', 5)}.` });
  }
  if (recent?.rows.length) insights.push({ text: `The latest runs, of ${formatCount(recent.total)}: ${listed(recent.rows, (r) => `${r.skill} on ${clip(r.initiative ?? 'no initiative', 40)}, ${formatCount(r.calls)} ${plural(r.calls, 'call')}, ${outputOf(r.bytes)}, ${stateOf(r)}`, 'page on /runs', 5)}.` });
  return budgeted({
    view: 'runs',
    title: 'Runs',
    address: addressOf('/runs', { skill }, { skill: 'all' }),
    scope: `your active team's runs${skill !== 'all' ? ` of ${skill}` : ''}, every one${runs.since ? ` since ${formatDate(runs.since)}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Runs', value: formatCount(tiles.runs.value), definition: 'Skill runs recorded: one skill followed by one caller, from its first call to its last.' },
      { label: 'Observed output per run', value: tiles.outputPerRun.value === null ? 'not measured' : formatKb(tiles.outputPerRun.value / 1024), change: tiles.outputPerRun.unmeasured ? `${tiles.outputPerRun.unmeasured} not measured` : undefined, definition: 'The response bytes of a run\'s own calls, the mean over the runs that measured them.' },
      { label: 'Largest run', value: tiles.largest ? `${outputOf(tiles.largest.bytes)}, ${tiles.largest.skill}` : 'none measured', definition: tiles.largest?.initiative ? `On ${tiles.largest.initiative}.` : undefined },
    ],
    insights,
    unknowns: [
      'Observed output is the bytes a run\'s calls answered: it is not what a model read, and not anything paid for.',
      'A run is active while its last call is within five minutes; nothing says one is still running after that.',
      ...(tiles.outputPerRun.unmeasured ? [`${formatCount(tiles.outputPerRun.unmeasured)} ${plural(tiles.outputPerRun.unmeasured, 'run')} had no output measured, which is unknown, not zero.`] : []),
      ...(tiles.runs.value ? [] : ['No run has been recorded yet.']),
    ],
  });
}

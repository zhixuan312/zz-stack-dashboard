/**
 * The Overview's shared context (decision 0011): what the page and the console's assistant are both told about tool
 * calls, open work, the knowledge shelf and refusals. The tiles' definitions live here too, so the person's info
 * button and the assistant read the same words.
 */
import type { Overview } from '@/lib/api-shapes';
import { formatPercent, plural } from '@/lib/format';
import { median } from '@/lib/insight';
import { formatCount, formatKb } from '@/lib/format-units';
import { PERIOD_LABEL, type Period } from '@/lib/period';
import type { Fact, Insight, SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, whose, type Arrival, type ViewMode } from './context';
import { OVERVIEW_METRICS, bucketLabel, change } from './overview-metrics';

/** "up 7.9% vs the previous period (76%)", or nothing when there is no previous period to stand against. */
function against(now: number | null, prev: number | null, format: (n: number) => string): string | undefined {
  const c = change(now, prev);
  if (c === null || prev === null) return undefined;
  const dir = Math.abs(c) < 0.0005 ? 'unchanged' : c > 0 ? 'up' : 'down';
  return `${dir}${dir === 'unchanged' ? '' : ` ${formatPercent(Math.abs(c), 1)}`} vs the previous period (${format(prev)})`;
}

/**
 * The Overview's context for `d`, with the person pointing at bucket `index` of the trend, or at nothing: the chart's
 * shared pointer is part of what the page shows, so "why this one?" has a referent.
 */
export function overviewContext(d: Overview, { period, mode, index = null, ...arrival }: { period: Period; mode: ViewMode; index?: number | null } & Arrival): SharedContext {
  const m = d.metrics;
  const totals = d.toolTrend.map((b) => b.inside + b.outside + b.refused);
  const calls = totals.reduce((a, b) => a + b, 0);
  const sum = (pick: (b: Overview['toolTrend'][number]) => number) => d.toolTrend.reduce((a, b) => a + pick(b), 0);
  const events = d.eventKinds.reduce((a, k) => a + k.n, 0);
  const pct = (n: number) => formatPercent(n / 100, 0);
  const knowledge = OVERVIEW_METRICS.knowledge(m.knowledge.importThresholdPerHour);
  const context = OVERVIEW_METRICS.context(m.context.contextWindowKb);
  const p = m.progressing;

  const facts: Fact[] = [
    { label: OVERVIEW_METRICS.calls.label, value: `${formatCount(calls)} ${plural(calls, 'call')}`, definition: OVERVIEW_METRICS.calls.hint },
    { label: OVERVIEW_METRICS.progressing.label, value: p.value === null ? 'not measured' : pct(p.value), definition: OVERVIEW_METRICS.progressing.hint },
    { label: 'Waiting on a person', value: `${formatCount(p.waiting)} ${plural(p.waiting, 'gate document')}`, definition: 'Gate documents written and not yet approved, across the open initiatives.' },
    { label: knowledge.label, value: m.knowledge.value === null ? 'not measured' : pct(m.knowledge.value), change: against(m.knowledge.value, m.knowledge.prev, pct), definition: knowledge.hint },
    { label: context.label, value: m.context.value === null ? 'not measured' : formatKb(m.context.value), change: against(m.context.value, m.context.prev, formatKb), definition: context.hint },
    { label: OVERVIEW_METRICS.refusals.label, value: m.refusals.value === null ? 'not measured' : formatPercent(m.refusals.value / 100), change: against(m.refusals.value, m.refusals.prev, (n) => formatPercent(n / 100)), definition: OVERVIEW_METRICS.refusals.hint },
  ];

  const insights: Insight[] = [];
  const unknowns: string[] = [];
  if (calls) {
    insights.push({ text: `Of the ${formatCount(calls)} calls, ${formatCount(sum((b) => b.inside))} ran inside a skill run, ${formatCount(sum((b) => b.outside))} outside any run and ${formatCount(sum((b) => b.refused))} were refused.` });
    const busiest = totals.reduce((best, n, i) => (n > totals[best] ? i : best), 0);
    insights.push({ text: `The busiest ${d.grain} ${d.grain === 'week' ? 'was the week of' : 'was'} ${bucketLabel(d.toolTrend[busiest].bucket, d.grain, d.timezone)}, with ${formatCount(totals[busiest])} calls; the chart has one point per ${d.grain}, cut on ${d.timezone} time.` });
  } else unknowns.push(`No tool call was recorded in this period${period === 'all' ? '' : '; a longer period shows what came before'}.`);

  if (p.active) {
    const s = p.stages;
    insights.push({ text: `${formatCount(p.active)} open ${plural(p.active, 'initiative')} by stage: ${s.noflow + s.notstarted} not started, ${s.drafting} drafting, ${s.agreed} agreed, ${s.gated + s.closed} settled. ${p.scoreable} of them declare a flow and are measured.`, evidence: '/initiatives' });
    if (p.waiting) insights.push({ text: `${formatCount(p.waiting)} ${plural(p.waiting, 'gate document')} ${p.waiting === 1 ? 'waits' : 'wait'} on a person's approval${p.waitingOldestDays === null ? '' : `, the oldest for ${Math.round(p.waitingOldestDays)} ${plural(Math.round(p.waitingOldestDays), 'day')}`}.`, evidence: '/initiatives?show=waiting' });
  } else unknowns.push('No initiative is open, so there is no progress to measure.');

  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  if (shelf) insights.push({ text: `The knowledge shelf holds ${formatCount(shelf)} ${plural(shelf, 'node')}: ${formatCount(m.knowledge.fromWork)} written by initiatives and ${formatCount(m.knowledge.imported)} imported in bulk. It was searched ${formatCount(m.knowledge.searches)} ${plural(m.knowledge.searches, 'time')} in this period.`, evidence: '/knowledge' });

  if (d.refusals.total) {
    const tool = d.refusals.byTool[0], message = d.refusals.byMessage[0];
    if (tool) insights.push({ text: `${tool.tool} refused most often: ${formatCount(tool.n)} of the ${formatCount(d.refusals.total)} refused calls (${shareOf(tool.n, d.refusals.total)}).`, evidence: '/activity?show=failed' });
    if (message) insights.push({ text: `The commonest refusal, ${formatCount(message.n)} times from ${message.tools > 1 ? `${message.tools} tools` : message.tool}: "${message.message}"` });
    if (m.refusals.byDoor.length > 1) insights.push({ text: `Refused calls by door: ${m.refusals.byDoor.map((x) => `${x.door} ${formatCount(x.n)}`).join(', ')}.` });
  } else if (calls) insights.push({ text: 'No call was refused in this period.' });

  if (events) {
    const top = d.eventKinds[0];
    insights.push({ text: `${formatCount(events)} ${plural(events, 'event')} recorded; the commonest kind is ${top.kind}, ${formatCount(top.n)} (${shareOf(top.n, events)}).${d.counts.unattributedEvents ? ` ${formatCount(d.counts.unattributedEvents)} belong to no team.` : ''}`, evidence: '/activity' });
  }

  if (m.context.p90 !== null) insights.push({ text: `The heaviest tenth of runs pull ${formatKb(m.context.p90)} or more of tool output into context.`, evidence: '/runs' });
  if (m.context.unmeasured) unknowns.push(`${formatCount(m.context.unmeasured)} ${plural(m.context.unmeasured, 'run')} had no output measured and ${m.context.unmeasured === 1 ? 'is' : 'are'} left out of Context per run, not counted as zero.`);
  if (m.context.capped) unknowns.push('Context per run compares against a truncated previous period: the run query reached its cap, so that change is approximate.');
  unknowns.push('Context per run is in KB of tool output. Nothing counts tokens, so a context window in KB is a rule of thumb.');
  if (period === 'all') unknowns.push('All time has no previous period, so no figure here carries a change.');
  else unknowns.push(`Initiatives progressing carries no change: ${p.noDeltaBecause}`);

  // What the pointer is on: that bucket's calls and their split, against the period's typical bucket.
  const at = index !== null ? d.toolTrend[index] : undefined;
  let focus: string | undefined;
  if (at) {
    const total = at.inside + at.outside + at.refused;
    const typical = median(totals);
    focus = `the ${d.grain} of ${bucketLabel(at.bucket, d.grain, d.timezone)}: ${formatCount(total)} ${plural(total, 'call')}${typical ? ` (${(total / typical).toFixed(1)}× the period's median ${d.grain} of ${formatCount(Math.round(typical))})` : ''}; ${formatCount(at.inside)} inside a run, ${formatCount(at.outside)} outside any run, ${formatCount(at.refused)} refused${total ? ` (${shareOf(at.refused, total)} of that ${d.grain}'s calls)` : ''}`;
  }

  return budgeted({
    view: 'overview',
    title: 'Overview',
    address: addressOf('/', { period }, { period: 'all' }),
    scope: `${PERIOD_LABEL[period].toLowerCase()}, ${whose(mode)}`,
    freshness: arrived(arrival),
    focus,
    facts,
    insights,
    unknowns,
  });
}

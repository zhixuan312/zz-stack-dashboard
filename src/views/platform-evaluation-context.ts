/**
 * Evaluation's shared context (decision 0011), and the words its cards are drawn with: what the page and the assistant
 * are both told about each plugin's evaluation, from the one `GET /platform/evaluation` the console's server read.
 *
 * Every figure is the gateway's. A score belongs to its series, one protocol version and one population, so a change
 * is only ever stated between two scores of one series, never across two; whether a plugin's series compare is the
 * read's own statement, never worked out here. A member's answer carries no protocol key, no measure key and no
 * finding's own words (the owning team's), and the page and the context say so rather than leave a gap unexplained.
 */
import { plural } from '@/lib/format';
import { formatDateTime, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Evaluation, SafeFinding } from '@/lib/platform-shapes';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { budgeted, clip, pendingContext } from './context';
import { waited } from './platform-bugs-context';

/** How long the console's server waits for the read: half a second under five, for a phone to draw what it says. */
export const EVALUATION_BOUND_MS = 4_500;

/** What the page's one read came back as: the whole response, the gateway's sentence, or no answer within the bound. */
export type EvaluationRead = { state: 'ok'; evaluation: Evaluation } | { state: 'failed'; reason: string } | { state: 'slow' };

/** Why the read is not on the page, in words. */
export function evaluationTrouble(read: Exclude<EvaluationRead, { state: 'ok' }>): { title: string; detail: string } {
  if (read.state === 'slow') return { title: 'Evaluation is unavailable', detail: `The read did not answer within ${EVALUATION_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: 'Evaluation did not load', detail: `${read.reason.replace(/\.?$/, '.')} Nothing on this page was read.` };
}

type Ok<P> = P extends { state: 'ok'; data: infer D } ? D : never;
export type PluginScoreRow = Ok<Evaluation['plugins']>[number];
type History = Ok<Evaluation['history']>[number];
type Series = History['series'][number];
type Run = Series['runs'][number];
type Protocol = Series['protocol'];
/** A waiting finding as the superadmin reads it: the safe row and the pattern the evaluation recorded. */
export type WaitingFinding = SafeFinding & { pattern?: string };

/** The tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  waiting: { label: 'Findings waiting', definition: 'Defects and unknowns with no decision yet, each counted once.' },
  established: { label: 'Scores established', definition: 'Plugins whose latest scoring is recorded as established.' },
  lastScored: { label: 'Last scored', definition: 'When any plugin was last scored.' },
  daysScored: { label: 'Days scored', definition: 'Distinct days, in the reporting time zone, on which a plugin was scored.' },
} as const;

/** A standing as a reader says it: `not_established` is an enum, not a word. */
const STANDING: Record<string, string> = { established: 'Established', provisional: 'Provisional', not_established: 'Not established' };
export const standingOf = (s: string): string => STANDING[s] ?? s.replace(/_/g, ' ');

/** Whether the guardrails held at the latest scoring. */
export const GUARDRAILS: Record<PluginScoreRow['guardrails'], string> = { pass: 'Held', fail: 'One failed', not_established: 'Not established' };

/** A protocol as the caller may read it: its key and version for the superadmin, its version alone for a member. */
export const protocolOf = (p: Protocol): string => (p.key ? `${p.key} v${p.version}` : `Protocol v${p.version}`);

const ONE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
/** A score out of 10 at the precision the page prints it. */
export const scoreIn = (n: number): string => ONE.format(n);
/** A score's range, `5.7 to 7.1`, or null when none was recorded. */
export const rangeOf = (lower: number | null, upper: number | null): string | null => (lower !== null && upper !== null ? `${scoreIn(lower)} to ${scoreIn(upper)}` : null);
/** A score as a sentence says it: its value out of 10 with its range, or that it has none. A missing score is never 0. */
function scoreText(score: number | null, lower: number | null, upper: number | null): string {
  if (score === null) return 'no score';
  const range = rangeOf(lower, upper);
  return `${scoreIn(score)} of 10${range ? ` (${range})` : ''}`;
}

/** The decisions a finding is counted under, as the composition names them; a deferred finding is the one still waiting. */
export const DECISIONS = [
  { key: 'applied', label: 'Applied', color: 'accent' },
  { key: 'rejected', label: 'Rejected', color: 'neutral-ink' },
  { key: 'deferred', label: 'Deferred, waiting', color: 'neutral' },
] as const;

/** The owner categories a finding may blame, in the evaluation's vocabulary; another reads as its own words. */
const OWNERS: Record<string, string> = {
  plugin: 'The plugin', dependency: 'A dependency', platform: 'The platform', environment: 'The environment', user_input: 'User input', unknown: 'Not known',
};
export const OWNER_KEYS = Object.keys(OWNERS);
export const ownerOf = (o: string): string => OWNERS[o] ?? o.replace(/_/g, ' ');

/** A finding's kind as a reader says it. */
export const kindOf = (k: string): string => (k === 'defect' ? 'Defect' : k === 'unknown' ? 'Unknown' : k);

/** What a series' scores make of each other: from its first score to its last, when it holds two or more. */
type Trend = { from: Run; to: Run; change: number; points: (number | null)[] };

/** The trend of one series, or null under two scores: a series is the only whole a change is stated over. */
export function trendOf(series: Series): Trend | null {
  const scored = series.runs.filter((r) => r.score !== null);
  if (scored.length < 2) return null;
  const [from, to] = [scored[0], scored.at(-1)!];
  return { from, to, change: to.score! - from.score!, points: series.runs.map((r) => r.score) };
}

/** A change of score in points, as a person reads it: `up 0.7 points`. */
const changeText = (n: number): string => (Math.abs(n) < 0.05 ? 'unchanged' : `${n > 0 ? 'up' : 'down'} ${scoreIn(Math.abs(n))} points`);

/**
 * One row of the scores by series: a plugin's series, with the statement the read makes of that plugin's series. The
 * statement is the plugin's, not the series', so it is said once, on the plugin's first row (`first`).
 */
export type SeriesRow = { key: string; plugin: string; statement: string; first: boolean; series: Series; trend: Trend | null };

/** Every plugin's series, one row each, in the read's order: a plugin's first series first. */
export function seriesRows(history: History[]): SeriesRow[] {
  return history.flatMap((h) => h.series.map((s, i) => ({ key: `${h.plugin}#${i}`, plugin: h.plugin, statement: h.statement, first: i === 0, series: s, trend: trendOf(s) })));
}

/** A series as a row names it: its protocol, and the population it was scored over. */
export const seriesName = (s: Series): string => `${protocolOf(s.protocol)}, ${s.population ?? 'population not recorded'}`;

/** One scoring as a cell or a line says it: its score with its range, or its standing alone, and the day. */
export const runText = (r: Run): string => `${r.score === null ? `no score (${standingOf(r.standing).toLowerCase()})` : `${scoreIn(r.score)} ${standingOf(r.standing).toLowerCase()}`} ${formatShortDate(r.scoredAt)}`;

/** The waiting findings as the read lists them, oldest first, each in the caller's form. */
export const waitingOf = (e: Evaluation): WaitingFinding[] => (e.waiting.state === 'ok' ? e.waiting.data.rows : []);

/** Whether the read is the superadmin's, which alone carries the protocol's and the measure's keys and each finding's words. */
export const isAdmin = (e: Evaluation): boolean => e.meta.scope === 'platform-admin';

/** The question the Ask on the plugins' table hands the assistant. */
export const ASK = 'Which plugins\' latest scores can be relied on, which guardrails failed, and what is still waiting for a decision?';

/** The read's own cutoff, as the masthead says it. */
export const asOfLine = (e: Evaluation): string => `As of ${formatDateTime(e.meta.asOf)}`;

const VIEW = { view: 'evaluation', title: 'Evaluation', address: '/platform/evaluation' } as const;

/**
 * The context the page shares and `view_evaluation` answers with, from the same read. The tiles and the two counts of
 * findings are facts; each plugin's latest score with its series, one insight a plugin, then the findings waiting, so
 * the findings waiting are the first to go when the budget is tight (their count stays a fact), then the last plugins.
 */
export function evaluationContext(read: EvaluationRead): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = evaluationTrouble(read);
    return pendingContext({ ...VIEW, scope: 'every plugin\'s evaluation on the platform' }, `${title}. ${detail}`);
  }
  const e = read.evaluation;
  const admin = isAdmin(e);
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  const unavailable = (part: string, reason: string) => unknowns.push(`${part} could not be read (${reason}).`);
  const { tiles } = e;
  const waiting = waitingOf(e);

  facts.push(
    { label: TILES.waiting.label, value: formatCount(tiles.waiting), change: waiting.length ? `the oldest waiting ${waited(waiting[0].waitingSince, e.meta.asOf)}` : undefined, definition: TILES.waiting.definition },
    { label: TILES.established.label, value: formatCount(tiles.established), change: e.plugins.state === 'ok' ? `of ${formatCount(e.plugins.data.length)} ${plural(e.plugins.data.length, 'plugin')} scored` : undefined, definition: TILES.established.definition },
    { label: TILES.lastScored.label, value: tiles.lastScored ? formatDateTime(tiles.lastScored) : 'Never', definition: TILES.lastScored.definition },
    { label: TILES.daysScored.label, value: formatCount(tiles.daysScored), definition: TILES.daysScored.definition.replace('the reporting time zone', e.meta.timezone) },
  );
  if (e.byDecision.state === 'ok') {
    const d = e.byDecision.data;
    facts.push({ label: 'Findings by decision', value: DECISIONS.map((p) => `${formatCount(d[p.key])} ${p.label.toLowerCase()}`).join(', '), definition: 'Every defect and unknown recorded, each counted once.' });
  } else unavailable('The findings by decision', e.byDecision.reason);
  if (e.byOwner.state === 'ok') {
    const by = Object.entries(e.byOwner.data);
    facts.push({ label: 'Findings by owner', value: by.length ? by.map(([o, n]) => `${ownerOf(o).toLowerCase()} ${formatCount(n)}`).join(', ') : 'none recorded', definition: 'The same findings, by the owner category each blames.' });
  } else unavailable('The findings by owner', e.byOwner.reason);

  // One line a plugin: its latest scoring, then its series with the read's statement of whether they compare. The
  // protocol and day of the latest are its series' newest scoring, so they are said apart only when there is no series.
  const latest = new Map(e.plugins.state === 'ok' ? e.plugins.data.map((p) => [p.plugin, p]) : []);
  const history = new Map(e.history.state === 'ok' ? e.history.data.map((h) => [h.plugin, h]) : []);
  const series = (s: Series) => {
    const t = trendOf(s);
    return `${seriesName(s)}: ${s.runs.map(runText).join(', ')}${t ? `; ${changeText(t.change)} within the series` : ''}`;
  };
  for (const plugin of new Set([...latest.keys(), ...history.keys()])) {
    const [p, h] = [latest.get(plugin), history.get(plugin)];
    const said = [
      p ? `latest ${p.score.value === null ? 'no score' : scoreText(p.score.value, p.lower, p.upper)}, ${standingOf(p.standing).toLowerCase()}, guardrails ${GUARDRAILS[p.guardrails].toLowerCase()}${h ? '' : `, ${protocolOf(p.protocol)}, ${formatShortDate(p.scoredAt)}`}` : null,
      h ? `by series, ${h.statement.replace(/^./, (c) => c.toLowerCase())}: ${h.series.map(series).join(' | ')}` : null,
    ].filter((x) => x !== null);
    insights.push({ text: `${plugin}: ${said.join('; ')}.` });
  }
  if (e.plugins.state !== 'ok') unavailable('Each plugin\'s latest score', e.plugins.reason);
  if (e.history.state !== 'ok') unavailable('Every score by series', e.history.reason);
  if (e.waiting.state === 'ok') {
    const line = (f: WaitingFinding) => `${f.summary} (${kindOf(f.kind).toLowerCase()}${f.measure ? ` on ${f.measure}` : ''}, since ${formatShortDate(f.waitingSince)})${f.pattern ? `: ${clip(f.pattern.replace(/\.$/, ''), 80)}` : ''}`;
    if (waiting.length) insights.push({ text: `Findings waiting, oldest first: ${listed(waiting, line, 'the list on /platform/evaluation', 5)}.` });
  } else unavailable('The findings waiting', e.waiting.reason);

  unknowns.push(
    'Scores are out of 10. A change is stated within one series (one protocol version and one population), never across two; no score is combined into an overall one.',
    'A score not established is not a number to quote. Strengths are not counted.',
  );
  if (!admin) unknowns.push('A protocol\'s key, a measure\'s key and a finding\'s own words are the owning team\'s: a member reads the version, the owner category and a fixed summary.');
  return budgeted({
    ...VIEW,
    scope: `every plugin's evaluation on the platform, ${admin ? 'as the superadmin reads it' : 'in the form everybody may read'}`,
    freshness: `${asOfLine(e)}.`,
    facts, insights, unknowns,
  });
}

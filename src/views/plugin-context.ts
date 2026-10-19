/**
 * One plugin's shared context (decision 0011) and the reads its page makes on the console's server: what it ships and
 * governs, how to install it, its public score with the protocol, the date and the comparability statement the gateway
 * answered, how much the active team used it, and, where the gateway answered it, the owning team's evaluation.
 *
 * The evaluation (`GET /plugins/:plugin/eval`) is answered to the superadmin and to the plugin's owning team alone, and
 * refused to everybody else before anything of it is read. That refusal is not a failure but the evaluation's absence
 * for this reader, so it is `withheld`, which says nothing; the public score on the catalog's row stands for everybody.
 */
import type { PluginEval, PluginRow } from '@/lib/api-shapes';
import type { PluginScore } from '@/lib/destination-shapes';
import type { Evaluation } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatDay } from '@/lib/format-date';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';
import { scoreOf as score } from './eval-score';
import { NO_EVALUATION, scoreSaid, versionSaid, type PluginsRead, type Served } from './plugins-context';

/** The gateway address of one plugin's evaluation. */
export const evalPath = (plugin: string): string => `/plugins/${encodeURIComponent(plugin)}/eval`;

/** The evaluation as the console's server read it: answered, withheld from this reader, failed or not answered in time. */
export type EvalRead = Served<PluginEval> | { state: 'withheld'; path: string };

/**
 * A plugin's scores in the series the platform's Evaluation read groups them into (`GET /platform/evaluation`'s
 * `history`), one series per protocol version and population, so two scores compare exactly when they share one. The
 * protocol's key is the superadmin's alone, as everywhere. `none` when the read did not answer, or answered no series
 * for the plugin: the comparability line is then the gateway's statement alone.
 */
type ScoreSeries = { protocol: { key: string | null; version: number }; population: string | null; runs: { scoredAt: string; score: number | null }[] };
export type HistoryRead = { state: 'ok'; series: ScoreSeries[] } | { state: 'none' };

/** A plugin's page's three reads, made together: the catalog its row is in, the owning team's evaluation, and its scores' series. */
export type PluginRead = { catalog: PluginsRead; evaluation: EvalRead; history?: HistoryRead };

/** The gateway address of the platform's Evaluation read, whose `history` holds every plugin's scores by series. */
export const SCORES_PATH = '/platform/evaluation';

/** One plugin's series out of the Evaluation read, and nothing else of it; `none` for no read or no series of it. */
export function historyOf(read: Evaluation | null, plugin: string): HistoryRead {
  const history = read?.history?.state === 'ok' ? read.history.data.find((h) => h.plugin === plugin) : undefined;
  return history ? { state: 'ok', series: history.series.map((s) => ({ protocol: s.protocol, population: s.population, runs: s.runs.map((r) => ({ scoredAt: r.scoredAt, score: r.score })) })) } : { state: 'none' };
}

/** A protocol as a sentence names it beside a score: its key and version, or for a member the version in words. */
const protocolOf = (p: ScoreSeries['protocol']): string => (p.key ? `${p.key} v${p.version}` : `version ${p.version} of its protocol`);

/**
 * What the lead score compares with, by name: the newest other score in its own series, which it compares with, and the
 * newest score of each other series, which it does not, each with its day and what differs. The series are the
 * gateway's, so nothing is decided here that the platform did not group; null when the lead is not in the series read,
 * and the page then quotes the gateway's statement as it is.
 */
export function comparedSaid(lead: PluginScore | null, history: HistoryRead | undefined): string | null {
  if (!lead || history?.state !== 'ok') return null;
  const own = history.series.find((s) => s.protocol.version === lead.protocol.version && s.runs.some((r) => r.scoredAt === lead.scoredAt));
  if (!own) return null;
  const newest = (s: ScoreSeries, but?: string) => s.runs.filter((r) => r.score !== null && r.scoredAt !== but).sort((a, b) => b.scoredAt.localeCompare(a.scoredAt))[0];
  const before = newest(own, lead.scoredAt);
  const others = history.series.filter((s) => s !== own).flatMap((s) => {
    const r = newest(s);
    if (!r) return [];
    const why = s.protocol.version !== own.protocol.version ? `scored against ${protocolOf(s.protocol)}` : 'measured on another population';
    return [{ at: r.scoredAt, said: `its ${r.score!.toFixed(1)} of ${formatDay(r.scoredAt)}, ${why}` }];
  }).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 2);
  const same = before ? `Comparable with its ${before.score!.toFixed(1)} of ${formatDay(before.scoredAt)}, the same protocol and population` : null;
  const apart = others.length ? `not comparable with ${others.map((o) => o.said).join(', or ')}` : null;
  if (same && apart) return `${same}; ${apart}`;
  if (apart) return `N${apart.slice(1)}`;
  return same ?? 'Its only score: nothing earlier to compare it with';
}

/**
 * What the page and `view_plugin` say about `name`. `evaluation` is the gateway's answer, or null when it gave none to
 * this reader: withheld, which is said as nothing, or unread, whose reason `unread` gives.
 */
export function pluginContext(name: string, { plugin: p, evaluation: e, unread, compared = null, ...arrival }: { plugin?: PluginRow; evaluation: PluginEval | null; unread?: string; compared?: string | null } & Arrival): SharedContext {
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  if (p) {
    const neverRun = p.skills.filter((s) => !s.everRun);
    facts.push(
      { label: 'Skills', value: formatCount(p.skills.length), change: p.stages.length ? `${p.stages.length} of them stages, in order` : undefined },
      { label: 'Gates', value: formatCount(p.gates), definition: 'Documents this plugin\'s method requires a person to approve.' },
      {
        label: 'Public score', value: scoreSaid(p.score),
        change: `${p.score && p.score.lower !== null && p.score.upper !== null ? `between ${p.score.lower.toFixed(1)} and ${p.score.upper.toFixed(1)}; ` : ''}${compared ?? p.comparability}`,
        definition: 'Its latest score out of 10, and whether its scores compare, as the gateway states both.',
      },
      { label: 'Your team\'s calls', value: formatCount(p.yourTeam.calls), change: p.yourTeam.failed ? `${formatCount(p.yourTeam.failed)} refused` : 'none refused', definition: 'Your active team\'s calls of its skills, all time.' },
      { label: 'Never run by your team', value: `${formatCount(neverRun.length)} of ${formatCount(p.skills.length)} skills` },
    );
    insights.push({ text: `It is ${p.required ? 'required: every client installs it' : 'optional'}; install it with ${p.install}.` });
    insights.push({ text: `It declares ${p.version ? `version ${p.version}, ${p.release ? `released with digest ${p.release.digest}` : 'which no release has vouched for'}` : 'no version'}${p.owner ? `, owned by ${p.owner}` : ''}, and ${p.servers.length ? `reaches the MCP ${plural(p.servers.length, 'server')} ${p.servers.join(', ')}` : 'reaches no server, skills only'}.` });
    if (p.stages.length) insights.push({ text: `Its method runs ${p.stages.join(', then ')}${p.entry ? `; ${p.entry} is the front door` : ''}.` });
    if (p.documents.length) insights.push({ text: `The documents it governs: ${p.documents.map((d) => `${d.name} (${d.gate ? 'a person approves' : 'no approval'})`).join(', ')}.` });
    if (neverRun.length) insights.push({ text: `Never run by your team: ${listed(neverRun, (s) => s.name, `see /plugins/${name}`)}.` });
  } else unknowns.push(`${name} is not in the catalog: it has no manifest, skills or install command to show, and is registered for evaluation only.`);

  if (e?.found) facts.push({ label: 'Evaluation score', value: e.run ? score(e.run) : 'never scored', definition: 'The owning team\'s newest scored run, against the protocol below.' });
  if (e?.found && e.run) {
    insights.push({ text: `Evaluated on ${formatDate(e.run.createdAt)} against protocol ${e.run.protocol.key} v${e.run.protocol.version}${e.subjectVersion ? `, measuring version ${e.subjectVersion.declaredVersion}` : ''}; guardrails ${e.run.guardrailStatus ?? 'not established'}.` });
    const scored = e.run.dimensions.filter((d) => d.applicable && d.score !== null);
    if (scored.length) insights.push({ text: `By dimension: ${scored.map((d) => `${d.key} ${d.score!.toFixed(1)}`).join(', ')}.` });
    // The run's guardrail status is one verdict over every guardrail measure; no measure carries a verdict of its own.
    const guardrails = e.run.dimensions.flatMap((d) => d.measures.filter((m) => m.guardrail));
    if (guardrails.length) insights.push({ text: `Guardrail ${plural(guardrails.length, 'measure')}, ${e.run.guardrailStatus ?? 'not established'} as one verdict over all of them: ${listed(guardrails, (g) => `${g.key} ${g.value ?? `no value (${g.excludedReason ?? 'none recorded'})`}`, 'see the plugin\'s page', 6)}.` });
    if (e.run.coverage.usableRunCount != null) insights.push({ text: `It was scored on ${formatCount(e.run.coverage.usableRunCount)} usable ${plural(e.run.coverage.usableRunCount, 'run')}${e.run.coverage.totalRunCount != null ? ` of ${formatCount(e.run.coverage.totalRunCount)}` : ''}.` });
  } else if (e?.found) unknowns.push(e.subjectVersion ? 'Its owning team has profiled it and never scored it: no evaluation run has a score.' : 'Its owning team registered it and has never profiled it.');
  else if (e) unknowns.push('It has never been registered for evaluation.');
  else if (unread) unknowns.push(`Its owning team's evaluation could not be read: ${unread}`);

  if (e?.found) {
    const f = e.findings;
    if (f.strengths.length + f.defects.length + f.unknowns.length) insights.push({ text: `Findings: ${f.strengths.length} ${plural(f.strengths.length, 'strength')}, ${f.defects.length} ${plural(f.defects.length, 'defect')}, ${f.unknowns.length} ${plural(f.unknowns.length, 'unknown')}.${f.defects.length ? ` The defects: ${listed(f.defects, (d) => `${d.pattern} (${d.decision})`, 'see the plugin\'s page', 6)}.` : ''}` });
    if (e.candidates.length) insights.push({ text: `Candidates for change: ${listed(e.candidates, (c) => `"${c.hypothesis}" (${c.status}${c.release?.releasedDeclaredVersion ? `, released as ${c.release.releasedDeclaredVersion}` : ''}${c.release?.rolledBack ? ', rolled back' : ''})`, 'see the plugin\'s page', 6)}.` });
    if (e.ownershipMode === 'evaluation_only') unknowns.push('It is registered for evaluation only: it may be evaluated and diagnosed, and nothing here can release it.');
  }
  unknowns.push('Calls and runs are your team\'s alone; the catalog and the public score are the platform\'s.', NO_EVALUATION);
  return budgeted({
    view: 'plugin',
    title: name,
    address: `/plugins/${name}`,
    scope: `one plugin${p ? `, ${p.required ? 'required' : 'optional'}, ${versionSaid(p)}` : ''}${p?.description ? `: ${p.description}` : ''}`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns,
  });
}

/**
 * One plugin's shared context (decision 0011): what it ships and governs, how much it is used, and its evaluation.
 */
import type { PluginEval, PluginRow } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';
import { scoreOf as score } from './eval-score';

export function pluginContext(name: string, { plugin: p, evaluation: e, ...arrival }: { plugin?: PluginRow; evaluation: PluginEval } & Arrival): SharedContext {
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  if (p) {
    const neverRun = p.skills.filter((s) => !s.everRun);
    facts.push(
      { label: 'Skills', value: formatCount(p.skills.length), change: p.stages.length ? `${p.stages.length} of them stages, in order` : undefined },
      { label: 'Gates', value: formatCount(p.gates), definition: 'Documents this plugin\'s method requires a person to approve.' },
      { label: 'Calls', value: formatCount(p.calls), change: p.failed ? `${formatCount(p.failed)} refused` : 'none refused', definition: 'Tool calls across its skills, all time.' },
      { label: 'Never run', value: `${formatCount(neverRun.length)} of ${formatCount(p.skills.length)} skills` },
    );
    insights.push({ text: `It declares ${p.version ? `version ${p.version}, ${p.release ? `released with digest ${p.release.digest}` : 'which no release has vouched for'}` : 'no version'}${p.owner ? `, owned by ${p.owner}` : ''}, and ${p.servers.length ? `reaches the MCP ${plural(p.servers.length, 'server')} ${p.servers.join(', ')}` : 'reaches no server, skills only'}.` });
    if (p.stages.length) insights.push({ text: `Its method runs ${p.stages.join(', then ')}${p.entry ? `; ${p.entry} is the front door` : ''}.` });
    if (p.documents.length) insights.push({ text: `The documents it governs: ${p.documents.map((d) => `${d.name} (${d.gate ? 'a person approves' : 'no approval'})`).join(', ')}.` });
    if (neverRun.length) insights.push({ text: `Never run: ${listed(neverRun, (s) => s.name, `see /plugins/${name}`)}.` });
  } else unknowns.push(`${name} has no manifest, skills or documents to show: it is a third-party subject, registered for evaluation only.`);

  if (!e.found) unknowns.push('It has never been evaluated.');
  else if (e.run) {
    facts.push({ label: 'Evaluation score', value: score(e.run), definition: 'The newest scored evaluation run, 0 to 10, against the protocol named below.' });
    insights.push({ text: `Evaluated on ${formatDate(e.run.createdAt)} against protocol ${e.run.protocol.key} v${e.run.protocol.version}${e.subjectVersion ? `, measuring version ${e.subjectVersion.declaredVersion}` : ''}; guardrails ${e.run.guardrailStatus ?? 'not established'}.` });
    const scored = e.run.dimensions.filter((d) => d.applicable && d.score !== null);
    if (scored.length) insights.push({ text: `By dimension: ${scored.map((d) => `${d.key} ${d.score!.toFixed(1)}`).join(', ')}.` });
    // The run's guardrail status is one verdict over every guardrail measure; no measure carries a verdict of its own.
    const guardrails = e.run.dimensions.flatMap((d) => d.measures.filter((m) => m.guardrail));
    if (guardrails.length) insights.push({ text: `Guardrail ${plural(guardrails.length, 'measure')}, ${e.run.guardrailStatus ?? 'not established'} as one verdict over all of them: ${listed(guardrails, (g) => `${g.key} ${g.value ?? `no value (${g.excludedReason ?? 'none recorded'})`}`, 'see the plugin\'s page', 6)}.` });
    if (e.run.coverage.usableRunCount != null) insights.push({ text: `It was scored on ${formatCount(e.run.coverage.usableRunCount)} usable ${plural(e.run.coverage.usableRunCount, 'run')}${e.run.coverage.totalRunCount != null ? ` of ${formatCount(e.run.coverage.totalRunCount)}` : ''}.` });
  } else unknowns.push(e.subjectVersion ? 'It has been profiled and never scored: no evaluation run has a score.' : 'It has never been evaluated.');

  if (e.found) {
    const f = e.findings;
    if (f.strengths.length + f.defects.length + f.unknowns.length) insights.push({ text: `Findings: ${f.strengths.length} ${plural(f.strengths.length, 'strength')}, ${f.defects.length} ${plural(f.defects.length, 'defect')}, ${f.unknowns.length} ${plural(f.unknowns.length, 'unknown')}.${f.defects.length ? ` The defects: ${listed(f.defects, (d) => `${d.pattern} (${d.decision})`, 'see the plugin\'s page', 6)}.` : ''}` });
    if (e.candidates.length) insights.push({ text: `Candidates for change: ${listed(e.candidates, (c) => `"${c.hypothesis}" (${c.status}${c.release?.releasedDeclaredVersion ? `, released as ${c.release.releasedDeclaredVersion}` : ''}${c.release?.rolledBack ? ', rolled back' : ''})`, 'see the plugin\'s page', 6)}.` });
    if (e.ownershipMode === 'evaluation_only') unknowns.push('It is registered for evaluation only: it may be evaluated and diagnosed, and nothing here can release it.');
  }
  return budgeted({
    view: 'plugin',
    title: name,
    address: `/plugins/${name}`,
    scope: `one plugin${p?.description ? `: ${p.description}` : ''}`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns,
  });
}

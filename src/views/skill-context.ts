/** One skill's shared context (decision 0011): how the active team's runs of it went, where it sits in its plugin's method, and what it is for. */
import type { PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import type { Fact, Insight, SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival } from './context';

export function skillContext(pluginName: string, name: string, { plugin, skill, detail, text, ...arrival }: { plugin?: PluginRow; skill?: Skill; detail?: SkillDetail; text?: SkillText } & Arrival): SharedContext {
  const shipped = plugin?.skills.find((s) => s.name === name);
  const produces = plugin?.documents.filter((d) => d.stage === name) ?? [];
  const gated = produces.find((d) => d.gate);
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  if (skill) {
    const rate = skill.calls ? skill.refusals / skill.calls : null;
    facts.push(
      { label: 'Runs', value: formatCount(skill.runs), definition: 'Your active team\'s runs of it, all time.' },
      { label: 'Calls per run', value: skill.runs ? skill.callsAvg.toFixed(1) : 'no runs', change: skill.runs ? `at most ${formatCount(skill.callsMax)}` : undefined },
      { label: 'Median run', value: skill.durationMedian === null ? 'not timed' : formatSeconds(skill.durationMedian), change: skill.durationMax === null ? undefined : `longest ${formatSeconds(skill.durationMax)}`, definition: `Over the ${formatCount(skill.timedRuns)} runs with more than one call; a single call has one timestamp and no span.` },
      { label: 'Refused', value: rate === null ? 'no calls' : `${(rate * 100).toFixed(1)}%`, change: `${formatCount(skill.refusals)} of ${formatCount(skill.calls)} calls` },
      { label: 'Observed output per run', value: skill.kbPerRun === null ? 'not measured' : formatKb(skill.kbPerRun), definition: 'The response bytes of a run\'s own calls: not what a model read, and not anything paid for.' },
    );
  } else unknowns.push('Your team has recorded no call against this skill, so it has no runs to quote.');
  if (shipped) insights.push({ text: `${shipped.isEntry ? `It is the front door of ${pluginName}` : shipped.position && plugin ? `It is step ${shipped.position} of ${plugin.stages.length} in ${pluginName}` : `${pluginName} ships it outside its method's stages`}; ${shipped.origin === 'theirs' ? `the ${pluginName} team wrote it` : 'we wrote it'}. ${produces.length ? `It produces ${produces.map((d) => d.name).join(', ')}` : 'It produces work, not a document'}${gated ? `, and is closed by a person approving ${gated.name}` : ', and no gate closes it'}.` });
  if (text?.description) insights.push({ text: `What it is for: ${text.description}` });
  if (text?.whenToUse) insights.push({ text: `When to use it: ${text.whenToUse}` });
  if (detail?.surfaces.length) insights.push({ text: `Its calls by door: ${detail.surfaces.map((s) => `${s.surface} ${formatCount(s.calls)}${s.failed ? ` (${formatCount(s.failed)} refused)` : ''}`).join(', ')}.` });
  if (detail?.busiestTools.length) insights.push({ text: `Its busiest tools: ${detail.busiestTools.slice(0, 6).map((t) => `${t.tool} ${formatCount(t.calls)}${t.failed ? ` (${formatCount(t.failed)} refused)` : ''}`).join(', ')}.` });
  if (text) insights.push({ text: `Its text is ${formatCount(text.body.length)} characters, with ${text.references.length} ${plural(text.references.length, 'reference')} shipped beside it; read it at /plugins/${pluginName}/${name}?view=read.` });
  if (skill) unknowns.push('Calls are attributed by the last skill served to the caller, not by what the skill declares: someone running two conversations at once has their calls filed under whichever skill loaded last.');
  return budgeted({
    view: 'skill',
    title: name,
    address: `/plugins/${pluginName}/${name}`,
    scope: `your active team's runs of one skill of the ${pluginName} plugin, all time`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns,
  });
}

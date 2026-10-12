/**
 * The Plugins catalog's shared context (decision 0011): what the page and the assistant are both told about what the
 * platform has installed and how each plugin's runs and evaluation went.
 */
import type { PluginRow } from '@/lib/api-shapes';
import { formatCount, plural } from '@/lib/format';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, shareOf, type Arrival } from './context';
import { scoreOf as score } from './eval-score';

export function pluginsContext(plugins: PluginRow[], arrival: Arrival): SharedContext {
  const skills = plugins.reduce((a, p) => a + p.skills.length, 0);
  const neverRun = plugins.reduce((a, p) => a + p.skills.filter((s) => !s.everRun).length, 0);
  const declaring = plugins.filter((p) => p.version).length;
  const released = plugins.filter((p) => p.release).length;
  const calls = plugins.reduce((a, p) => a + p.calls, 0);
  const busiest = plugins.reduce<PluginRow | null>((a, p) => (!a || p.calls > a.calls ? p : a), null);
  const failing = plugins.filter((p) => p.latestEval?.guardrailStatus === 'fail' || (p.latestEval?.openDefects ?? 0) > 0);
  const insights: Insight[] = [];
  if (busiest && busiest.calls) insights.push({ text: `${busiest.plugin} is the most used: ${formatCount(busiest.calls)} of the ${formatCount(calls)} calls (${shareOf(busiest.calls, calls)}).`, evidence: `/plugins/${busiest.plugin}` });
  if (failing.length) insights.push({ text: `Evaluations with something open: ${listed(failing, (p) => `${p.plugin} (${p.latestEval?.guardrailStatus === 'fail' ? 'a guardrail fails' : ''}${p.latestEval?.guardrailStatus === 'fail' && p.latestEval.openDefects ? ', ' : ''}${p.latestEval?.openDefects ? `${p.latestEval.openDefects} open ${plural(p.latestEval.openDefects, 'defect')}` : ''})`, 'see /plugins')}.` });
  if (plugins.length) insights.push({ text: `The plugins: ${listed(plugins, (p) => `${p.plugin} (${p.version ? `v${p.version}${p.release ? '' : ', not released'}` : 'no version'}; ${p.skills.length} ${plural(p.skills.length, 'skill')}; ${formatCount(p.calls)} ${plural(p.calls, 'call')}; evaluation ${score(p.latestEval)})`, 'see /plugins')}.` });
  return budgeted({
    view: 'plugins',
    title: 'Plugins',
    address: '/plugins',
    scope: 'every plugin in the catalog, all time',
    freshness: arrived(arrival),
    facts: [
      { label: 'Plugins', value: formatCount(plugins.length), definition: 'What a person installs: a package\'s skills plus the MCP servers those skills call, under one declared version.' },
      { label: 'Skills', value: formatCount(skills), definition: 'Across every plugin.' },
      { label: 'Released', value: formatCount(released), change: `of ${declaring} declaring a version`, definition: 'A release vouched for the declared version with a digest.' },
      { label: 'Never run', value: `${formatCount(neverRun)} ${plural(neverRun, 'skill')}`, definition: 'Skills shipped and never called.' },
    ],
    insights,
    unknowns: [
      'An evaluation score belongs to the version that was measured, which is not necessarily the version on the shelf today.',
      ...(plugins.length ? [] : ['The catalog holds no plugin.']),
    ],
  });
}

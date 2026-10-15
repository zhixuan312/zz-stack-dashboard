/**
 * The Plugins catalog's shared context (decision 0011): what the page and the assistant are both told about what a
 * person may install, each plugin's latest public score with its protocol, date and whether its scores compare, and
 * how much the active team used it. The catalog and the scores are the platform's; the use is the team's own.
 */
import type { PluginRow } from '@/lib/api-shapes';
import type { PluginScore } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, shareOf, type Arrival } from './context';

/** A public score as every view words it, 0 to 10, with the protocol it was scored against and when. */
export const scoreSaid = (s: PluginScore | null): string => (!s ? 'never scored'
  : `${s.standing === 'not_established' ? 'not established' : `${s.value.toFixed(1)} of 10 (${s.standing.replace(/_/g, ' ')})`}, protocol ${s.protocol.key ? `${s.protocol.key} ` : ''}v${s.protocol.version}, ${formatDate(s.scoredAt)}`);

export function pluginsContext(plugins: PluginRow[], arrival: Arrival): SharedContext {
  const skills = plugins.reduce((a, p) => a + p.skills.length, 0);
  const neverRun = plugins.reduce((a, p) => a + p.skills.filter((s) => !s.everRun).length, 0);
  const required = plugins.filter((p) => p.required);
  const calls = plugins.reduce((a, p) => a + p.yourTeam.calls, 0);
  const busiest = plugins.reduce<PluginRow | null>((a, p) => (!a || p.yourTeam.calls > a.yourTeam.calls ? p : a), null);
  const insights: Insight[] = [];
  if (busiest && busiest.yourTeam.calls) insights.push({ text: `${busiest.plugin} is the one your team used most: ${formatCount(busiest.yourTeam.calls)} of its ${formatCount(calls)} calls (${shareOf(busiest.yourTeam.calls, calls)}).`, evidence: `/plugins/${busiest.plugin}` });
  if (plugins.length) insights.push({ text: `The plugins: ${listed(plugins, (p) => `${p.plugin} (${p.required ? 'required' : 'optional'}; ${p.version ? `v${p.version}${p.release ? '' : ', not released'}` : 'no version'}; ${p.skills.length} ${plural(p.skills.length, 'skill')}; your team ${formatCount(p.yourTeam.calls)} ${plural(p.yourTeam.calls, 'call')}; score ${scoreSaid(p.score)}; ${p.comparability})`, 'see /plugins')}.` });
  if (plugins.length) insights.push({ text: `To install one: ${listed(plugins.filter((p) => !p.required), (p) => p.install, 'see /plugins', 6)}.` });
  return budgeted({
    view: 'plugins',
    title: 'Plugins',
    address: '/plugins',
    scope: 'every plugin in the catalog with its latest public score, and your active team\'s use of each',
    freshness: arrived(arrival),
    facts: [
      { label: 'Plugins', value: formatCount(plugins.length), change: `${required.length} required`, definition: 'What a person installs: a package\'s skills plus the MCP servers those skills call, under one declared version. A required one every client installs.' },
      { label: 'Skills', value: formatCount(skills), definition: 'Across every plugin.' },
      { label: 'Scored', value: formatCount(plugins.filter((p) => p.score).length), definition: 'Plugins with a public score, out of 10, against a protocol a person agreed.' },
      { label: 'Never run by your team', value: `${formatCount(neverRun)} ${plural(neverRun, 'skill')}`, definition: 'Skills shipped that your team never called.' },
    ],
    insights,
    unknowns: [
      'A score belongs to the protocol version it was scored against, and to the version that was measured, which is not necessarily the one on the shelf today.',
      'Calls, refusals and last runs are your team\'s alone; the catalog and the scores are the platform\'s.',
      'Nobody starts an evaluation from the console.',
      ...(plugins.length ? [] : ['The catalog holds no plugin.']),
    ],
  });
}

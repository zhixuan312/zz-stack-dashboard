/**
 * The Plugins catalog's shared context (decision 0011), its address and the read every plugin page makes on the
 * console's server: what the page and the assistant are both told about the plugins in view, each with whether it is
 * required, its version, its skills and gates, its latest public score with the protocol and date it was scored against
 * and the comparability statement exactly as the gateway answered it, and the command that installs it.
 *
 * The catalog and the scores are the platform's, the same for everybody; the calls are the active team's alone, and
 * every line that quotes one says so. The gateway selects the score and states whether its scores compare: nothing here
 * decides either, and nothing on any plugin page starts an evaluation.
 */
import type { PluginRow } from '@/lib/api-shapes';
import type { PluginScore } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, type Arrival } from './context';

/** The gateway's catalog: every plugin, the team's most recently used first. */
export const PLUGINS_PATH = '/plugins';

/** What `GET /plugins` answers. */
export type Catalog = { plugins: PluginRow[] };

/** How long the console's server waits for a plugin page's reads: half a second under five, for a phone to draw what it says. */
export const PLUGINS_BOUND_MS = 4_500;

/**
 * A read as the console's server made it: the answer with the moment it arrived (the catalog carries no cutoff of its
 * own), a failure in the gateway's words, or no answer in time.
 */
export type Served<T> =
  | { state: 'ok'; path: string; at: string; data: T }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** The catalog, as the console's server read it for the page. */
export type PluginsRead = Served<Catalog>;

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function readTrouble(read: { state: 'failed'; reason: string } | { state: 'slow' }): string {
  return read.state === 'slow' ? `The read did not answer within ${PLUGINS_BOUND_MS / 1000} seconds.` : read.reason;
}

/** What Plugins keeps in its address: the name the search narrows the list to, empty for every plugin. */
export type PluginsFilters = { plugin: string };

/** The address with nothing in it: every plugin. */
export const PLUGINS_DEFAULTS: PluginsFilters = { plugin: '' };

/** The search a page's address names, as Next hands a server page its search parameters: one value, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): PluginsFilters {
  const v = params.plugin;
  return { plugin: (Array.isArray(v) ? v[0] : v) ?? PLUGINS_DEFAULTS.plugin };
}

/** The plugins in view: every one, or those whose name holds what the search says, in the gateway's order. */
export function inView(plugins: PluginRow[], f: PluginsFilters): PluginRow[] {
  const q = f.plugin.trim().toLowerCase();
  return q ? plugins.filter((p) => p.plugin.toLowerCase().includes(q)) : plugins;
}

/** The console address of the list as `f` narrows it. */
const pluginsAddress = (f: PluginsFilters): string => addressOf(PLUGINS_PATH, f, PLUGINS_DEFAULTS);

/** The protocol a score was scored against: its key where the gateway sends it (the superadmin's alone), and its version. */
export const protocolSaid = (s: PluginScore): string => `protocol ${s.protocol.key ? `${s.protocol.key} ` : ''}v${s.protocol.version}`;

/** A public score as every view words it, 0 to 10, with the protocol it was scored against and when. */
export const scoreSaid = (s: PluginScore | null): string => (!s ? 'never scored'
  : `${s.standing === 'not_established' ? 'not established' : `${s.value.toFixed(1)} of 10 (${s.standing.replace(/_/g, ' ')})`}, ${protocolSaid(s)}, ${formatDate(s.scoredAt)}`);

/** A plugin's version as a reader is told it: the number it declares, and whether a release vouched for it. */
export const versionSaid = (p: PluginRow): string => (p.version ? `v${p.version} ${p.release ? 'released' : 'not released'}` : 'no version');

/** One row of the list, as the assistant is told it: the columns the table draws, in its order, then its install line. */
const rowSaid = (p: PluginRow): string =>
  `${p.plugin}: ${p.required ? 'required' : 'optional'}, ${versionSaid(p)}, ${formatCount(p.skills.length)} ${plural(p.skills.length, 'skill')}, ${formatCount(p.gates)} ${plural(p.gates, 'gate')}; score ${scoreSaid(p.score)}; ${p.comparability}; ${p.install}.`;

/** What the plugin pages and their tools say of evaluating a plugin: they read what an evaluation recorded, and start none. */
export const NO_EVALUATION = 'Nobody starts an evaluation from the console: it only reads what an evaluation recorded.';

/**
 * What the page and `view_plugins` say about the plugins `filters` keeps in view, most important first: each row in
 * the table's order, then the team's use of them, then the skills it never ran. Over its budget, the skills never run
 * go first, then the team's use, then the last rows.
 */
export function pluginsContext(plugins: PluginRow[], { filters = PLUGINS_DEFAULTS, ...arrival }: { filters?: PluginsFilters } & Arrival): SharedContext {
  const rows = inView(plugins, filters);
  const narrowed = rows.length !== plugins.length || filters.plugin.trim() !== '';
  const skills = rows.reduce((a, p) => a + p.skills.length, 0);
  const neverRun = rows.flatMap((p) => p.skills.filter((s) => !s.everRun).map((s) => `${p.plugin}/${s.name}`));
  const required = rows.filter((p) => p.required).length;
  const calls = rows.reduce((a, p) => a + p.yourTeam.calls, 0);
  const used = rows.filter((p) => p.yourTeam.calls > 0);
  // Each row's own page is `/plugins/<its name>`, so no row spends its share of the budget saying so.
  const insights: Insight[] = rows.map((p) => ({ text: rowSaid(p) }));
  if (used.length) {
    insights.push({ text: `Your team's own calls of these plugins' skills: ${listed(used, (p) => `${p.plugin} ${formatCount(p.yourTeam.calls)} (${shareOf(p.yourTeam.calls, calls)})`, 'see each plugin\'s page', 8)}; ${rows.length - used.length ? `never run by your team: ${listed(rows.filter((p) => !p.yourTeam.calls), (p) => p.plugin, 'see /plugins', 8)}` : 'every plugin in view has run'}.` });
  }
  if (neverRun.length) insights.push({ text: `Skills your team never ran: ${listed(neverRun, (s) => s, 'see each plugin\'s page', 10)}.` });
  return budgeted({
    view: 'plugins',
    title: 'Plugins',
    address: pluginsAddress(filters),
    scope: narrowed
      ? `the plugins in the catalog whose name holds "${filters.plugin.trim()}", with their latest public scores, and your active team's use of each`
      : 'every plugin in the catalog with its latest public score, and your active team\'s use of each',
    freshness: arrived(arrival),
    facts: [
      { label: 'Plugins', value: formatCount(rows.length), change: `${formatCount(required)} required, ${formatCount(rows.length - required)} optional`, definition: 'What a person installs: skills and the MCP servers they call, under one version; every client installs a required one.' },
      { label: 'Skills', value: formatCount(skills), definition: 'Shipped by the plugins in view.' },
      { label: 'Gates', value: formatCount(rows.reduce((a, p) => a + p.gates, 0)), definition: 'Documents their methods have a person approve.' },
      { label: 'Scored', value: `${formatCount(rows.filter((p) => p.score).length)} of ${formatCount(rows.length)}`, definition: 'With a public score out of 10.' },
      { label: 'Never run by your team', value: `${formatCount(neverRun.length)} ${plural(neverRun.length, 'skill')}`, definition: 'Skills of these plugins your active team never called.' },
    ],
    insights,
    unknowns: [
      'A score belongs to its protocol version and to the plugin version measured, not necessarily today\'s; whether scores compare is the gateway\'s statement, quoted as it is.',
      'Calls are your team\'s alone; the catalog and the scores are the platform\'s.',
      NO_EVALUATION,
      ...(plugins.length ? [] : ['The catalog holds no plugin.']),
      ...(plugins.length && !rows.length ? [`No plugin's name holds "${filters.plugin.trim()}".`] : []),
    ],
  });
}

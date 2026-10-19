import { redirect } from 'next/navigation';
import { GatewayError, answeredAt, gatewayGet, revisionsOf, type Revised } from '@/data/gateway';
import type { PluginEval, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import type { Evaluation } from '@/lib/platform-shapes';
import { SCORES_PATH, evalPath, historyOf, type EvalRead, type HistoryRead, type PluginRead } from '@/views/plugin-context';
import { PLUGINS_BOUND_MS, PLUGINS_PATH, type Catalog, type PluginsRead, type Served } from '@/views/plugins-context';
import { skillDetailPath, skillTextPath, skillsPath, type SkillRead } from '@/views/skill-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer the read.');

/**
 * `GET path` on the console's server, as the person, given `PLUGINS_BOUND_MS`: the answer with the moment it arrived,
 * the gateway's own sentence for a failure, or `slow` once the bound has passed. `refused` names the statuses that are
 * an answer in their own right rather than a failure. An answer and a refusal carry the revisions they were read at.
 * It never rejects, so the page's boundary never waits on it longer or falls to the error page, but for a session that
 * ended since the gate let it in, which goes to sign-in. Nothing it reads is kept for anyone else.
 */
async function bounded<T, R extends { path: string }>(path: string, next: string, refused: (status: number) => R | null = () => null): Promise<Revised<Served<T> | R>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<Served<T>>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), PLUGINS_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<T>(path).then((data): Revised<Served<T>> => ({ state: 'ok', path, at: new Date().toISOString(), data, revisions: answeredAt(data) })), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
    const answered = error instanceof GatewayError ? refused(error.status) : null;
    return answered ? { ...answered, revisions: (error as GatewayError).revisions } : { state: 'failed', path, reason: reasonOf(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** The catalog, for Plugins, or for the page at `next` that reads it beside its own. */
export const readPlugins = (next = '/plugins'): Promise<Revised<PluginsRead>> => bounded<Catalog, never>(PLUGINS_PATH, next);

/**
 * The plugin's scores in their series, from the platform's Evaluation read, which everybody who reads the platform may
 * make: only this plugin's, so the page is handed none of the others. A read that fails or is slow, or a plugin it
 * has no score of, is `none`, and the page quotes the catalog's statement alone; it never fails the page.
 */
async function readHistory(plugin: string, next: string): Promise<HistoryRead> {
  const read = await bounded<Evaluation, never>(SCORES_PATH, next);
  return historyOf(read.state === 'ok' ? read.data : null, plugin);
}

/**
 * A plugin's three reads, together: the catalog its row is in, the owning team's evaluation, which the gateway
 * refuses with a 403 to anybody but the superadmin and that team, and its scores' series, which name what its public
 * score compares with. The refusal is `withheld`, its absence for this reader, and never a failure. The page's
 * revisions are the catalog's and the evaluation's: the series only words the comparability line.
 */
export async function readPlugin(plugin: string): Promise<Revised<PluginRead>> {
  const next = `/plugins/${plugin}`;
  const path = evalPath(plugin);
  const [catalog, evaluation, history] = await Promise.all([
    readPlugins(next),
    bounded<PluginEval, EvalRead>(path, next, (status) => (status === 403 ? { state: 'withheld', path } : null)),
    readHistory(plugin, next),
  ]);
  return { catalog, evaluation, history, revisions: revisionsOf(catalog.revisions, evaluation.revisions) };
}

/** A skill's four reads, together. The text answering 404 is a skill its plugin does not ship: `missing`. */
export async function readSkill(plugin: string, skill: string): Promise<Revised<SkillRead>> {
  const next = `/plugins/${plugin}/${skill}`;
  const textPath = skillTextPath(plugin, skill);
  const [catalog, skills, detail, text] = await Promise.all([
    readPlugins(next),
    bounded<{ skills: Skill[] }, never>(skillsPath(plugin), next),
    bounded<SkillDetail, never>(skillDetailPath(skill), next),
    bounded<SkillText, { state: 'missing'; path: string }>(textPath, next, (status) => (status === 404 ? { state: 'missing', path: textPath } : null)),
  ]);
  return { catalog, skills, detail, text, revisions: revisionsOf(catalog.revisions, skills.revisions, detail.revisions, text.revisions) };
}

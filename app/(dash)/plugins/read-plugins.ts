import { redirect } from 'next/navigation';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { PluginEval, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { evalPath, type EvalRead, type PluginRead } from '@/views/plugin-context';
import { PLUGINS_BOUND_MS, PLUGINS_PATH, type Catalog, type PluginsRead, type Served } from '@/views/plugins-context';
import { skillDetailPath, skillTextPath, skillsPath, type SkillRead } from '@/views/skill-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer the read.');

/**
 * `GET path` on the console's server, as the person, given `PLUGINS_BOUND_MS`: the answer with the moment it arrived,
 * the gateway's own sentence for a failure, or `slow` once the bound has passed. `refused` names the statuses that are
 * an answer in their own right rather than a failure. It never rejects, so the page's boundary never waits on it longer
 * or falls to the error page, but for a session that ended since the gate let it in, which goes to sign-in. Nothing it
 * reads is kept for anyone else.
 */
async function bounded<T, R extends { path: string }>(path: string, next: string, refused: (status: number) => R | null = () => null): Promise<Served<T> | R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<Served<T>>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), PLUGINS_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<T>(path).then((data): Served<T> => ({ state: 'ok', path, at: new Date().toISOString(), data })), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
    const answered = error instanceof GatewayError ? refused(error.status) : null;
    return answered ?? { state: 'failed', path, reason: reasonOf(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** The catalog, for Plugins, or for the page at `next` that reads it beside its own. */
export const readPlugins = (next = '/plugins'): Promise<PluginsRead> => bounded<Catalog, never>(PLUGINS_PATH, next);

/**
 * A plugin's two reads, together: the catalog its row is in, and the owning team's evaluation, which the gateway
 * refuses with a 403 to anybody but the superadmin and that team. That refusal is `withheld`, its absence for this
 * reader, and never a failure.
 */
export async function readPlugin(plugin: string): Promise<PluginRead> {
  const next = `/plugins/${plugin}`;
  const path = evalPath(plugin);
  const [catalog, evaluation] = await Promise.all([
    readPlugins(next),
    bounded<PluginEval, EvalRead>(path, next, (status) => (status === 403 ? { state: 'withheld', path } : null)),
  ]);
  return { catalog, evaluation };
}

/** A skill's four reads, together. The text answering 404 is a skill its plugin does not ship: `missing`. */
export async function readSkill(plugin: string, skill: string): Promise<SkillRead> {
  const next = `/plugins/${plugin}/${skill}`;
  const textPath = skillTextPath(plugin, skill);
  const [catalog, skills, detail, text] = await Promise.all([
    readPlugins(next),
    bounded<{ skills: Skill[] }, never>(skillsPath(plugin), next),
    bounded<SkillDetail, never>(skillDetailPath(skill), next),
    bounded<SkillText, { state: 'missing'; path: string }>(textPath, next, (status) => (status === 404 ? { state: 'missing', path: textPath } : null)),
  ]);
  return { catalog, skills, detail, text };
}

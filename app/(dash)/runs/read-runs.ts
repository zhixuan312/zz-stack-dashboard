import { redirect } from 'next/navigation';
import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { Runs } from '@/lib/destination-shapes';
import { READ_BOUND_MS } from '@/views/context';
import { runsPath, skillPagesOf, type RunsFilters, type RunsRead, type SkillPages } from '@/views/runs-context';
import { readPlugins } from '../plugins/read-plugins';

/**
 * `GET /runs` for the address's skill and page, on the console's server, as the person, given `READ_BOUND_MS`, with
 * the revisions it was answered at: a read that fails says the gateway's own sentence, and one that does not answer by
 * then is said to be slow. It never rejects, so the page's boundary never waits on it longer or falls to the error
 * page, but for a session that ended since the gate let it in, which goes to sign-in. Nothing it reads is kept for
 * anyone else.
 */
export async function readRuns(filters: RunsFilters): Promise<Revised<RunsRead>> {
  const path = runsPath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<RunsRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), READ_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<Runs>(path).then((data): Revised<RunsRead> => ({ state: 'ok', path, data, revisions: answeredAt(data) })), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect('/login?next=%2Fruns');
    return { state: 'failed', path, reason: error instanceof Error ? error.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where each skill's own page is, from the catalog `GET /plugins` answers beside the runs: a run names its skill and
 * not the plugin that ships it, and a skill's page is under its plugin. Only the names and addresses are handed on,
 * never the catalog. A catalog that did not answer leaves every skill's row without a way on, and never fails the page.
 */
export async function readSkillPages(): Promise<SkillPages> {
  const read = await readPlugins('/runs');
  return read.state === 'ok' ? skillPagesOf(read.data) : {};
}

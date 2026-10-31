import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Runs } from '@/lib/destination-shapes';
import { bounded } from '@/lib/read-bound';
import { runsPath, skillPagesOf, type RunsFilters, type RunsRead, type SkillPages } from '@/logic/runs-context';
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
  try {
    return await bounded<Revised<RunsRead>>(gatewayGet<Runs>(path).then((data) => ({ state: 'ok', path, data, revisions: answeredAt(data) })), { state: 'slow', path });
  } catch (error) {
    await signInWhenEnded(error);
    return { state: 'failed', path, reason: error instanceof Error ? error.message : 'The gateway did not answer the read.' };
  }
}

/**
 * Where each skill's own page is, from the catalog `GET /plugins` answers beside the runs: a run names its skill and
 * not the plugin that ships it, and a skill's page is under its plugin. Only the names and addresses are handed on,
 * never the catalog. A catalog that did not answer leaves every skill's row without a way on, and never fails the page.
 */
export async function readSkillPages(): Promise<SkillPages> {
  const read = await readPlugins();
  return read.state === 'ok' ? skillPagesOf(read.data) : {};
}

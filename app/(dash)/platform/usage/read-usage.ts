import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Usage } from '@/lib/fleet-shapes';
import { bounded } from '@/lib/read-bound';
import type { UsageRead } from '@/logic/platform-usage-context';

/**
 * `GET /platform/usage` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails says the
 * gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so neither of the
 * page's boundaries waits on it longer or falls to the error page, but for a session that ended since the gate let the
 * person in, which goes to sign-in. Nothing is cached: the next request reads again, for
 * its own caller, whose role decides whether the weeks are split by team.
 */
export async function readUsage(): Promise<UsageRead> {
  try {
    return await bounded(gatewayGet<Usage>('/platform/usage').then((usage): UsageRead => ({ state: 'ok', usage })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}

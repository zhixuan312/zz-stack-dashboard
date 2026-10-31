import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Access } from '@/lib/destination-shapes';
import type { AccessRead } from '@/logic/access-context';
import { bounded } from '@/lib/read-bound';

/**
 * `GET /access` on the console's server, as the person, given `READ_BOUND_MS`, with the revisions it was answered at:
 * a read that fails says the gateway's own sentence, and one that does not answer by then is said to be slow. It never
 * rejects, so neither of the page's boundaries waits on it longer or falls to the error page, but for a session that
 * ended since the gate let it in, which goes to sign-in. Nothing is cached: the next request reads again, for its own
 * caller, and the answer is theirs alone whatever team they act for.
 */
export async function readAccess(): Promise<Revised<AccessRead>> {
  try {
    return await bounded<Revised<AccessRead>>(gatewayGet<Access>('/access').then((data) => ({ state: 'ok', access: data, revisions: answeredAt(data) })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}

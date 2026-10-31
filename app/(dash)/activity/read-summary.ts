import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { ActivitySummary } from '@/lib/destination-shapes';
import type { ActivityRead } from '@/logic/activity-context';
import { bounded } from '@/lib/read-bound';

/**
 * `GET /activity/summary` on the console's server, as the person, given `READ_BOUND_MS`, with the revisions it was
 * answered at: a read that fails says the gateway's own sentence, and one that does not answer by then is said to be
 * slow. It never rejects, so the page never waits on it longer or falls to the error page, but for a session that ended
 * since the gate let it in, which goes to sign-in; nothing it reads is kept for anyone else.
 */
export async function readSummary(): Promise<Revised<ActivityRead>> {
  try {
    return await bounded<Revised<ActivityRead>>(gatewayGet<ActivitySummary>('/activity/summary').then((data) => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}

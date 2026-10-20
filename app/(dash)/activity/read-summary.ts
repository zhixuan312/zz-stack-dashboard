import { redirect } from 'next/navigation';
import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { ActivitySummary } from '@/lib/destination-shapes';
import type { ActivityRead } from '@/views/activity-context';
import { READ_BOUND_MS } from '@/views/context';

/**
 * `GET /activity/summary` on the console's server, as the person, given `READ_BOUND_MS`, with the revisions it was
 * answered at: a read that fails says the gateway's own sentence, and one that does not answer by then is said to be
 * slow. It never rejects, so the page never waits on it longer or falls to the error page, but for a session that ended
 * since the gate let it in, which goes to sign-in; nothing it reads is kept for anyone else.
 */
export async function readSummary(): Promise<Revised<ActivityRead>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<ActivityRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), READ_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<ActivitySummary>('/activity/summary').then((data): Revised<ActivityRead> => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) })), bound]);
  } catch (e) {
    if (e instanceof GatewayError && e.status === 401) redirect('/login?next=%2Factivity');
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

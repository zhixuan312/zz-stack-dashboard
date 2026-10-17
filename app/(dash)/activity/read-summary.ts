import { gatewayGet } from '@/data/gateway';
import type { ActivitySummary } from '@/lib/destination-shapes';
import { ACTIVITY_BOUND_MS, type ActivityRead } from '@/views/activity-context';

/**
 * `GET /activity/summary` on the console's server, as the person, given `ACTIVITY_BOUND_MS`: a read that fails says the
 * gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so the page never
 * waits on it longer or falls to the error page; nothing it reads is kept for anyone else.
 */
export async function readSummary(): Promise<ActivityRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<ActivityRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), ACTIVITY_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<ActivitySummary>('/activity/summary').then((data): ActivityRead => ({ state: 'ok', data, at: new Date().toISOString() })), bound]);
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

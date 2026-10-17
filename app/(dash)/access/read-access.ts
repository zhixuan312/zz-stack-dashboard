import { gatewayGet } from '@/data/gateway';
import type { Access } from '@/lib/destination-shapes';
import { ACCESS_BOUND_MS, type AccessRead } from '@/views/access-context';

/**
 * `GET /access` on the console's server, as the person, given `ACCESS_BOUND_MS`: a read that fails says the gateway's own
 * sentence, and one that does not answer by then is said to be slow. It never rejects, so neither of the page's
 * boundaries waits on it longer or falls to the error page. Nothing is cached: the next request reads again, for its own
 * caller, and the answer is theirs alone whatever team they act for.
 */
export async function readAccess(): Promise<AccessRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<AccessRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), ACCESS_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<Access>('/access').then((access): AccessRead => ({ state: 'ok', access })), bound]);
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

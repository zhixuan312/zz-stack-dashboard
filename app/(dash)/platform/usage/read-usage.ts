import { gatewayGet } from '@/data/gateway';
import type { Usage } from '@/lib/fleet-shapes';
import { READ_BOUND_MS } from '@/views/context';
import type { UsageRead } from '@/views/platform-usage-context';

/**
 * `GET /platform/usage` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails says the
 * gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so neither of the
 * page's boundaries waits on it longer or falls to the error page. Nothing is cached: the next request reads again, for
 * its own caller, whose role decides whether the weeks are split by team.
 */
export async function readUsage(): Promise<UsageRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<UsageRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), READ_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<Usage>('/platform/usage').then((usage): UsageRead => ({ state: 'ok', usage })), bound]);
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

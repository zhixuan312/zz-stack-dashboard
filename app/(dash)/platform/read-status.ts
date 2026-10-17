import { gatewayGet } from '@/data/gateway';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { STATUS_BOUND_MS, statusRead, type StatusRead } from '@/views/platform-status-context';

/**
 * `GET /platform/status` on the console's server, as the person, given `STATUS_BOUND_MS`: a read that fails or does not
 * answer by then is said to be so. It never rejects, so neither of the page's boundaries waits on it longer or falls to
 * the error page. Nothing is cached: the next request reads again, for its own caller.
 */
export async function readStatus(): Promise<StatusRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<StatusRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), STATUS_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<PlatformStatus>('/platform/status').then(statusRead), bound]);
  } catch {
    return { state: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

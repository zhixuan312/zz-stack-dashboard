import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { bounded } from '@/lib/read-bound';
import { statusRead, type StatusRead } from '@/logic/platform-status-context';

/**
 * `GET /platform/status` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails or does not
 * answer by then is said to be so. It never rejects, so neither of the page's boundaries waits on it longer or falls to
 * the error page, but for a session that ended since the gate let the person in, which goes to sign-in. Nothing is cached: the next request reads again, for its own caller.
 */
export async function readStatus(): Promise<StatusRead> {
  try {
    return await bounded(gatewayGet<PlatformStatus>('/platform/status').then(statusRead), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed' };
  }
}

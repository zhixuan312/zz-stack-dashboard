import { chromeAccess } from '@/data/access';
import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Home } from '@/lib/work-shapes';
import { bounded } from '@/lib/read-bound';
import type { HomeRead } from '@/logic/home-context';

/**
 * `GET /home` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails or does not answer by
 * then is said to be so. It never rejects, so neither of the page's boundaries waits on it longer or falls to the error
 * page, but for a session that ended since the gate let it in, which goes to sign-in. The team is the one the gate's own
 * `/me` named, which the waiting strip's link opens the document under.
 */
export async function readHome(): Promise<HomeRead> {
  try {
    return await bounded(Promise.all([gatewayGet<Home>('/home'), chromeAccess()]).then(([home, { team }]): HomeRead => ({ state: 'ok', home, team: team ?? null })), { state: 'slow' });
  } catch (error) {
    await signInWhenEnded(error);
    return { state: 'failed' };
  }
}

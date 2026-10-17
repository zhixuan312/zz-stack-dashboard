import { redirect } from 'next/navigation';
import { chromeAccess } from '@/data/access';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { Home } from '@/lib/work-shapes';
import { HOME_BOUND_MS, type HomeRead } from '@/views/home-context';

/**
 * `GET /home` on the console's server, as the person, given `HOME_BOUND_MS`: a read that fails or does not answer by
 * then is said to be so. It never rejects, so neither of the page's boundaries waits on it longer or falls to the error
 * page, but for a session that ended since the gate let it in, which goes to sign-in. The team is the one the gate's own
 * `/me` named, which the waiting strip's link opens the document under.
 */
export async function readHome(): Promise<HomeRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<HomeRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), HOME_BOUND_MS); });
  const read = async (): Promise<HomeRead> => {
    const [home, { team }] = await Promise.all([gatewayGet<Home>('/home'), chromeAccess()]);
    return { state: 'ok', home, team: team ?? null };
  };
  try {
    return await Promise.race([read(), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect('/login?next=%2F');
    return { state: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

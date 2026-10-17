import { redirect } from 'next/navigation';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { Runs } from '@/lib/destination-shapes';
import { RUNS_BOUND_MS, runsPath, type RunsFilters, type RunsRead } from '@/views/runs-context';

/**
 * `GET /runs` for the address's skill and page, on the console's server, as the person, given `RUNS_BOUND_MS`: a read
 * that fails says the gateway's own sentence, and one that does not answer by then is said to be slow. It never
 * rejects, so the page's boundary never waits on it longer or falls to the error page, but for a session that ended
 * since the gate let it in, which goes to sign-in. Nothing it reads is kept for anyone else.
 */
export async function readRuns(filters: RunsFilters): Promise<RunsRead> {
  const path = runsPath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<RunsRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), RUNS_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<Runs>(path).then((data): RunsRead => ({ state: 'ok', path, data })), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect('/login?next=%2Fruns');
    return { state: 'failed', path, reason: error instanceof Error ? error.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

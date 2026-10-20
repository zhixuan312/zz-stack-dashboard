import { redirect } from 'next/navigation';
import { chromeAccess } from '@/data/access';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { RecordRead } from '@/lib/work-shapes';
import { READ_BOUND_MS } from '@/views/context';
import { recordPath, type RecordFilters, type RecordServed } from '@/views/record-context';

/**
 * `GET /record` for the address's period and page, on the console's server, as the person, given `READ_BOUND_MS`: a
 * read that fails or does not answer by then is said to be so. It never rejects, so the page's boundary never waits on
 * it longer or falls to the error page, but for a session that ended since the gate let it in, which goes to sign-in.
 * The team is the one the gate's own `/me` named, which a row of the record opens its initiative under.
 */
export async function readRecord(filters: RecordFilters): Promise<RecordServed> {
  const path = recordPath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<RecordServed>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), READ_BOUND_MS); });
  const read = async (): Promise<RecordServed> => {
    const [data, { team }] = await Promise.all([gatewayGet<RecordRead>(path), chromeAccess()]);
    return { state: 'ok', path, data, team: team ?? null };
  };
  try {
    return await Promise.race([read(), bound]);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 401) redirect('/login?next=%2Frecord');
    return { state: 'failed', path, reason: error instanceof Error ? error.message : 'The platform did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

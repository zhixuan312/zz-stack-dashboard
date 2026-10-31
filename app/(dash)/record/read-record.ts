import { chromeAccess } from '@/data/access';
import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { RecordRead } from '@/lib/work-shapes';
import { bounded } from '@/lib/read-bound';
import { recordPath, type RecordFilters, type RecordServed } from '@/logic/record-context';

/**
 * `GET /record` for the address's period and page, on the console's server, as the person, given `READ_BOUND_MS`: a
 * read that fails or does not answer by then is said to be so. It never rejects, so the page's boundary never waits on
 * it longer or falls to the error page, but for a session that ended since the gate let it in, which goes to sign-in.
 * The team is the one the gate's own `/me` named, which a row of the record opens its initiative under.
 */
export async function readRecord(filters: RecordFilters): Promise<RecordServed> {
  const path = recordPath(filters);
  try {
    return await bounded(Promise.all([gatewayGet<RecordRead>(path), chromeAccess()]).then(([data, { team }]): RecordServed => ({ state: 'ok', path, data, team: team ?? null })), { state: 'slow', path });
  } catch (error) {
    await signInWhenEnded(error);
    return { state: 'failed', path, reason: error instanceof Error ? error.message : 'The platform did not answer the read.' };
  }
}

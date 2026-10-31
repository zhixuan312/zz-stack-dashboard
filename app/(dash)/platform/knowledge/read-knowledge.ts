import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { bounded } from '@/lib/read-bound';
import type { KnowledgeHealthRead } from '@/logic/platform-knowledge-context';

/**
 * `GET /platform/knowledge` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails
 * says the gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so neither
 * of the page's boundaries waits on it longer or falls to the error page, but for a session that ended since the gate
 * let the person in, which goes to sign-in. Nothing is cached: the next request reads
 * again, for its own caller, whose role decides which shelves are named and whether the questions are in it.
 */
export async function readKnowledgeHealth(): Promise<KnowledgeHealthRead> {
  try {
    return await bounded(gatewayGet<KnowledgeHealth>('/platform/knowledge').then((health): KnowledgeHealthRead => ({ state: 'ok', health })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}

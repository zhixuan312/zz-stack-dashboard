import { gatewayGet } from '@/data/gateway';
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { READ_BOUND_MS } from '@/views/context';
import type { KnowledgeHealthRead } from '@/views/platform-knowledge-context';

/**
 * `GET /platform/knowledge` on the console's server, as the person, given `READ_BOUND_MS`: a read that fails
 * says the gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so neither
 * of the page's boundaries waits on it longer or falls to the error page. Nothing is cached: the next request reads
 * again, for its own caller, whose role decides which shelves are named and whether the questions are in it.
 */
export async function readKnowledgeHealth(): Promise<KnowledgeHealthRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<KnowledgeHealthRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), READ_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<KnowledgeHealth>('/platform/knowledge').then((health): KnowledgeHealthRead => ({ state: 'ok', health })), bound]);
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

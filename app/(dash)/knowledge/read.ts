import { gatewayGet } from '@/data/gateway';
import { KNOWLEDGE_BOUND_MS, type ServerRead } from '@/views/knowledge-context';

/**
 * One of Knowledge's first reads, on the console's server, as the person, given `KNOWLEDGE_BOUND_MS`: a read that fails
 * says the gateway's own sentence, and one that does not answer by then is said to be slow. It never rejects, so the
 * page never waits on it longer or falls to the error page; nothing it reads is kept for anyone else.
 */
export async function readFirst<T>(path: string): Promise<ServerRead<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<ServerRead<T>>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), KNOWLEDGE_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<T>(path).then((data): ServerRead<T> => ({ state: 'ok', data, at: new Date().toISOString() })), bound]);
  } catch (e) {
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

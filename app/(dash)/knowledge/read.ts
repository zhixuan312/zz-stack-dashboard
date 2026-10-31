import { answeredAt, gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import { bounded } from '@/lib/read-bound';
import type { ServerRead } from '@/logic/knowledge-context';

/**
 * One of Knowledge's first reads, on the console's server, as the person, given `READ_BOUND_MS`, with the revisions
 * it was answered at: a read that fails says the gateway's own sentence, and one that does not answer by then is said
 * to be slow. It never rejects, so the page never waits on it longer or falls to the error page, but for a session that
 * ended since the gate let it in, which goes to sign-in and back to the page; nothing it reads is kept for
 * anyone else.
 */
export async function readFirst<T>(path: string): Promise<ServerRead<T>> {
  try {
    return await bounded<ServerRead<T>>(gatewayGet<T>(path).then((data) => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) })), { state: 'slow' });
  } catch (e) {
    await signInWhenEnded(e);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  }
}

import { redirect } from 'next/navigation';
import { GatewayError, answeredAt, gatewayGet } from '@/data/gateway';
import { READ_BOUND_MS } from '@/views/context';
import type { ServerRead } from '@/views/knowledge-context';

/** The summary's read is Knowledge's own page; every other first read's path is the address of the page that makes it. */
const SUMMARY = '/knowledge/summary';

/**
 * One of Knowledge's first reads, on the console's server, as the person, given `READ_BOUND_MS`, with the revisions
 * it was answered at: a read that fails says the gateway's own sentence, and one that does not answer by then is said
 * to be slow. It never rejects, so the page never waits on it longer or falls to the error page, but for a session that
 * ended since the gate let it in, which goes to sign-in and back to the page that read it; nothing it reads is kept for
 * anyone else.
 */
export async function readFirst<T>(path: string): Promise<ServerRead<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<ServerRead<T>>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), READ_BOUND_MS); });
  try {
    return await Promise.race([gatewayGet<T>(path).then((data): ServerRead<T> => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) })), bound]);
  } catch (e) {
    if (e instanceof GatewayError && e.status === 401) redirect(`/login?next=${encodeURIComponent(path === SUMMARY ? '/knowledge' : path)}`);
    return { state: 'failed', reason: e instanceof Error ? e.message : 'The gateway did not answer the read.' };
  } finally {
    clearTimeout(timer);
  }
}

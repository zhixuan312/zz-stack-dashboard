import { redirect } from 'next/navigation';
import { GatewayError, answeredAt, gatewayGet } from '@/data/gateway';
import type { DocumentDetail } from '@/lib/api-shapes';
import type { Revisions } from '@/lib/live';
import { encodePath } from '@/lib/store-path';
import { INITIATIVES_BOUND_MS } from '@/views/initiatives-context';

/**
 * The document route's own read, on the console's server: the answer with the moment it answered, which the page's
 * freshness is told from; no document by that address, or a failure, a refusal included, each in the gateway's
 * sentence; or no answer in time. An answer, and an address with no document, carry the revisions they were read at.
 * The view imports this type alone: the read below reaches the request's cookies.
 */
export type DocumentRead =
  | { state: 'ok'; data: DocumentDetail; at: string; revisions?: Revisions }
  | { state: 'missing'; reason: string; revisions?: Revisions }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/**
 * `GET /document/:team/:slug/:path` as the person, given `INITIATIVES_BOUND_MS` as the initiative it belongs to is. It
 * never rejects but for a session that ended, which goes to sign-in and back to the document, so the page never waits
 * on it longer or falls to the error page. `rel` is the store path, carried segment by segment (`encodePath`), so a
 * name holding `#`, `?` or `%` is read, and returned to, as itself; the browser's later reads ask the same address.
 */
export async function readDocument(team: string, slug: string, rel: string): Promise<DocumentRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<DocumentRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), INITIATIVES_BOUND_MS); });
  const named = `${team}/${slug}/${encodePath(rel)}`;
  const read = gatewayGet<DocumentDetail>(`/document/${named}`).then(
    (data): DocumentRead => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) }),
    (err: unknown): DocumentRead => {
      if (err instanceof GatewayError && err.status === 401) redirect(`/login?next=${encodeURIComponent(`/initiatives/${named}`)}`);
      if (err instanceof GatewayError && err.status === 404) return { state: 'missing', reason: err.message, revisions: err.revisions };
      return { state: 'failed', reason: err instanceof Error ? err.message : 'The gateway did not answer.' };
    },
  );
  try {
    return await Promise.race([read, bound]);
  } finally {
    clearTimeout(timer);
  }
}

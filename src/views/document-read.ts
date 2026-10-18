import { redirect } from 'next/navigation';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { DocumentDetail } from '@/lib/api-shapes';
import { INITIATIVES_BOUND_MS } from '@/views/initiatives-context';

/**
 * The document route's own read, on the console's server: the answer with the moment it answered, which the page's
 * freshness is told from; no document by that address, or a failure, a refusal included, each in the gateway's
 * sentence; or no answer in time. The view imports this type alone: the read below reaches the request's cookies.
 */
export type DocumentRead =
  | { state: 'ok'; data: DocumentDetail; at: string }
  | { state: 'missing'; reason: string }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/**
 * `GET /document/:team/:slug/:path` as the person, given `INITIATIVES_BOUND_MS` as the initiative it belongs to is. It
 * never rejects but for a session that ended, which goes to sign-in and back to the document, so the page never waits
 * on it longer or falls to the error page. The path is the one the browser reads, so a later read in the browser
 * follows exactly this one.
 */
export async function readDocument(team: string, slug: string, rel: string): Promise<DocumentRead> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<DocumentRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow' }), INITIATIVES_BOUND_MS); });
  const read = gatewayGet<DocumentDetail>(`/document/${team}/${slug}/${rel}`).then(
    (data): DocumentRead => ({ state: 'ok', data, at: new Date().toISOString() }),
    (err: unknown): DocumentRead => {
      if (err instanceof GatewayError && err.status === 401) redirect(`/login?next=${encodeURIComponent(`/initiatives/${team}/${slug}/${rel}`)}`);
      if (err instanceof GatewayError && err.status === 404) return { state: 'missing', reason: err.message };
      return { state: 'failed', reason: err instanceof Error ? err.message : 'The gateway did not answer.' };
    },
  );
  try {
    return await Promise.race([read, bound]);
  } finally {
    clearTimeout(timer);
  }
}

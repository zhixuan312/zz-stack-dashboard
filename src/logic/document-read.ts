import { GatewayError, answeredAt, gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { DocumentDetail } from '@/lib/api-shapes';
import type { Revisions } from '@/lib/live';
import { encodePath } from '@/lib/store-path';
import { bounded } from '@/lib/read-bound';

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
 * `GET /document/:team/:slug/:path` as the person, given `READ_BOUND_MS` as the initiative it belongs to is. It
 * never rejects but for a session that ended, which goes to sign-in and back to the document, so the page never waits
 * on it longer or falls to the error page. `rel` is the store path, carried segment by segment (`encodePath`), so a
 * name holding `#`, `?` or `%` is read, and returned to, as itself; the browser's later reads ask the same address.
 * `team` and `slug` are the page's own segments as Next hands them, still escaped, and never `.` or `..`: the page
 * draws the missing page for those and reads nothing.
 */
export async function readDocument(team: string, slug: string, rel: string): Promise<DocumentRead> {
  return bounded(
    gatewayGet<DocumentDetail>(`/document/${team}/${slug}/${encodePath(rel)}`).then(
      (data): DocumentRead => ({ state: 'ok', data, at: new Date().toISOString(), revisions: answeredAt(data) }),
      async (err: unknown): Promise<DocumentRead> => {
        await signInWhenEnded(err);
        if (err instanceof GatewayError && err.status === 404) return { state: 'missing', reason: err.message, revisions: err.revisions };
        return { state: 'failed', reason: err instanceof Error ? err.message : 'The gateway did not answer.' };
      },
    ),
    { state: 'slow' },
  );
}

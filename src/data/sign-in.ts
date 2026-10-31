/**
 * Where sign-in sends a person back to, and the one rule for a session that ends after the page gate let it in.
 *
 * The gate (`src/console/gate.tsx`) sends a request with no session to sign-in. A session can also end between the
 * gate's `/me` and the page's own read, one request apart: every first read of a page, Work's and Platform's alike,
 * then sends the person to the same sign-in, back to the address and query this request asked for, rather than drawing
 * the read's failure with the gateway's sentence.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { GatewayError } from '@/data/gateway';
import { ownPath } from '@/lib/own-path';

// COUPLED: `proxy.ts` writes this header on every page request, over whatever the browser sent. The two move together.
const PATH_HEADER = 'x-zz-path';

/** Where sign-in sends the person back to: the address this request asked for, when `proxy.ts` said it and it is this site's. */
export async function signIn(): Promise<string> {
  const asked = (await headers()).get(PATH_HEADER);
  return asked !== null && ownPath(asked) ? `/login?next=${encodeURIComponent(asked)}` : '/login';
}

/** A read's failure that is a session ended since the gate goes to sign-in; any other is the caller's to say. */
export async function signInWhenEnded(err: unknown): Promise<void> {
  if (err instanceof GatewayError && err.status === 401) redirect(await signIn());
}

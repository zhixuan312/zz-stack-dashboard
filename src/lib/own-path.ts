/**
 * Whether an address is a path on this site, read the way a browser reads it: `//host` and `/\host` start with a slash
 * and are another site's, and so is anything with a scheme.
 *
 * Pure, so the sign-in address (`signInAddress`, written by `src/data/sign-in.ts` on the server and `src/lib/api.ts` in the
 * browser) and the sign-in page (`app/login/page.tsx`, which follows it) ask the one question the one way.
 */

/** Any origin that is nobody's: an address is this site's own when resolving it against this one stays here. */
const HERE = 'http://console.invalid';

export function ownPath(address: string): boolean {
  if (!address.startsWith('/')) return false;
  try {
    return new URL(address, HERE).origin === HERE;
  } catch {
    return false;
  }
}

/** Where sign-in is, sending the person back to `asked` once they are in, when it is a path on this site. */
export function signInAddress(asked: string | null): string {
  return asked !== null && ownPath(asked) ? `/login?next=${encodeURIComponent(asked)}` : '/login';
}

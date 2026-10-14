/**
 * Whether an address is a path on this site, read the way a browser reads it: `//host` and `/\host` start with a slash
 * and are another site's, and so is anything with a scheme.
 *
 * Pure, so the server's gate (`src/data/access.ts`, which writes `?next=`) and the sign-in page (`app/login/page.tsx`,
 * which follows it) ask the one question the one way.
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

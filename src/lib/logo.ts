/**
 * The logo a product sets in `app.logo`: a root-relative path to an SVG under `public/`, such as `/logo.svg`.
 *
 * Self-contained on purpose: the rail reads it in the browser and `scripts/check.ts` reads it under plain node.
 * Returns the path when it is one, and `null` for everything else (a URL, a relative path, a `..` segment, another
 * file type, a query string, a value that is not a string).
 */
const LOGO = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/;

export function logoSource(value: unknown): string | null {
  if (typeof value !== 'string' || !LOGO.test(value)) return null;
  return value.split('/').includes('..') ? null : value;
}

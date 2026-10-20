/**
 * A store path, carried through an address segment by segment — never as one string.
 *
 * `encodeURIComponent` on the whole path escapes its separators, so `sources/2026-10-06-call.md` becomes one segment
 * named `sources%2F2026-10-06-call.md` and the route's `[...path]` never splits it: the page then looks for a document
 * called `sources/2026-10-06-call.md` in the store's root and reports one that is not there. Encoding each segment and
 * rejoining keeps the slashes as slashes, which is what a path is.
 *
 * **This pair was written four times**, and then copied three times more: into the knowledge links, the search's
 * addresses and the document's server read, each because its first home was a `'use client'` module whose exports a
 * server module or a plain test cannot call. It lives here, in a module with no directive and no dependency, so the
 * server, the browser and a plain test import one rule. Empty segments are dropped, so a doubled slash names the same
 * path. The day someone "simplifies" it to one `encodeURIComponent`, the only place that would notice is a document
 * whose path has a directory in it.
 */
export function encodePath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/**
 * The other half: an address's path segments, as Next hands a page them (still escaped), back into the store path they
 * name; null where they name none. That is an escape that does not decode (`%zz`, a lone `%`), and a segment that
 * decodes to `.` or `..`: Next passes `..%2F` through inside one segment, and a read built from `../` is resolved
 * against the gateway's address by `fetch` (`..%2F..%2F..%2Fauth` under `/api/console/knowledge/atlas/` reached
 * `/api/auth`). zz-core writes no dot-prefixed segment, so no store path is lost.
 */
export function decodePath(segments: string[]): string | null {
  let path: string;
  try {
    path = segments.map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
  return path.split('/').some((s) => s === '.' || s === '..') ? null : path;
}

/**
 * What a URL in rendered markdown may become, for markdown a person wrote (a document, a comment, an agent's reply).
 *
 * Raw HTML is already inert: Prose renders through react-markdown with no raw-HTML plugin, so `<script>` is text, and
 * check.ts fails if rehype-raw ever arrives. The URL policy is the other half. Inert HTML stops script; it does not stop
 * a body from reaching out: `![](https://elsewhere/p.png)` is ordinary markdown, and the browser fetches it the moment
 * the page renders, telling its author who read it and when.
 *
 * So the rule is asymmetric. A link is navigation a reader chooses: relative or an http(s), mailto or tel address goes
 * through, and any other scheme (`javascript:`, `data:`, `vbscript:`) becomes nothing. An image is a fetch the reader
 * never agreed to: only a same-origin path goes through.
 *
 * The scheme is read the way a browser reads one, not the way it is written: see `safeMarkdownUrl`.
 */
const NAVIGABLE = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** The origin every image is resolved against. Any host nothing can reach does: only an address that lands back on it
 *  is kept, and the address is returned as it was written, never rewritten to this one. */
const THIS_ORIGIN = 'https://meridian.invalid';

/**
 * Whether an image's address is a path on this page (issue #92). Read by resolution, not by looking for `//`: a
 * backslash is a slash to the URL parser, so `\\host/p.png`, `/\host/p.png` and `\/host/p.png` are each `//host/p.png`
 * to the fetch — a third party — while a check that reads them as written sees a relative path. Resolving and comparing
 * the origin needs no list of the ways the parser folds one into the other, and a `//host` address resolves off-origin
 * by the same rule.
 */
function sameOrigin(url: string): boolean {
  try {
    return new URL(url.replace(/\\/g, '/'), `${THIS_ORIGIN}/`).origin === THIS_ORIGIN;
  } catch {
    return false;
  }
}

/** Returns the URL to use, or '' to drop it. `key` is the attribute being filled: `src` for an image, `href` for a link. */
export function safeMarkdownUrl(url: string, key: string): string {
  const raw = url.trim();
  if (raw === '') return '';
  // A scheme only counts before the first `/`, `?` or `#`, so `a/path:with-colon` is a path, not the scheme `a/path`.
  //
  // The scheme is read from a copy with the controls and spaces taken out, because that is what a browser does with a
  // URL before it reads one: `java\tscript:alert(1)` — and the same with a newline or a NUL — IS `javascript:` to the
  // browser, and a check that reads the raw string waves it through. Only the probe is stripped: a URL that passes is
  // returned exactly as it was written.
  const probe = raw.replace(/[\u0000- \u007F]/g, '');
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(probe.split(/[/?#]/, 1)[0] ?? '')?.[1];
  if (key === 'src') return scheme === undefined && sameOrigin(probe) ? raw : '';
  if (scheme === undefined) return raw;
  return NAVIGABLE.has(`${scheme.toLowerCase()}:`) ? raw : '';
}

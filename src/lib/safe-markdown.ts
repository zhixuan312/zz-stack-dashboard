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
 */
const NAVIGABLE = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Returns the URL to use, or '' to drop it. `key` is the attribute being filled: `src` for an image, `href` for a link. */
export function safeMarkdownUrl(url: string, key: string): string {
  // Normalised the way a URL parser does before it reads a scheme: tab, newline and carriage
  // return come out of anywhere in the string, and C0 controls and spaces come off the ends.
  // That is not tidiness — a browser reads `java\tscript:alert(1)` as `javascript:`, so a policy
  // that treats the tab as an ordinary path character hands the link straight through. Both the
  // scheme test below and React's own `javascript:` warning look for the scheme at the start.
  const raw = url.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (raw === '') return '';
  // `//host/p.png` has no scheme and is not relative: the browser supplies one and fetches a third party.
  const protocolRelative = raw.startsWith('//');
  // A scheme only counts before the first `/`, `?` or `#`, so `a/path:with-colon` is a path, not the scheme `a/path`.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw.split(/[/?#]/, 1)[0] ?? '')?.[1];
  if (key === 'src') return scheme !== undefined || protocolRelative ? '' : raw;
  if (scheme === undefined) return raw;
  return NAVIGABLE.has(`${scheme.toLowerCase()}:`) ? raw : '';
}

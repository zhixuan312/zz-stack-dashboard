/**
 * Normalize markdown for the `ProseBlock` renderer, and decide which URLs in it may be
 * fetched.
 *
 * Normalization is CRLF → LF and trim.
 * DELIBERATE: `<`/`>` are not escaped. `ProseBlock` renders through react-markdown with
 * remark-gfm and no raw-HTML plugin, so raw HTML is already inert text. A blanket escape
 * corrupts legitimate content: inside a code span CommonMark does not decode entities, so
 * `` `<projectId>` `` and `->` render as the literal `&lt;projectId&gt;` / `-&gt;`.
 *
 * The URL policy is the other half. Inert HTML stops script; it does not stop a document body
 * from reaching out. `![](https://someone-else/p.png)` is ordinary markdown and the browser
 * fetches it the moment the document renders, so the author learns the IP address and reading
 * time of everyone who opens it.
 *
 * The asymmetry is the rule: a link is navigation a reader chooses, so an external one is fine
 * and only dangerous schemes are refused. An image is a fetch the reader never agreed to, so
 * only a same-origin path is allowed.
 */
export function sanitizeUserVisibleMarkdown(input: string): string {
  return input.replace(/\r\n/g, '\n').trim();
}

/** Schemes a reader may be sent to by clicking. Anything else — `javascript:`, `data:`,
 *  `vbscript:`, a scheme nobody has heard of — resolves to nothing. */
const NAVIGABLE = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Decide what a URL in rendered markdown becomes. Returns `''` to drop it.
 *
 * `key` is the attribute react-markdown is filling in — `src` for an image, `href` for a link
 * — which is what lets one function hold both halves of the policy.
 */
export function safeMarkdownUrl(url: string, key: string): string {
  const raw = url.trim();
  if (raw === '') return '';

  // A protocol-relative URL (`//host/p.png`) has no scheme and is not relative: the browser
  // supplies the page's own and fetches a third party. Treated as absolute everywhere below.
  const protocolRelative = raw.startsWith('//');
  // A scheme is only a scheme if it comes before the first `/`, `?` or `#`. Without that
  // bound, `some/path:with-a-colon` parses as the scheme `some/path`.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw.split(/[/?#]/, 1)[0] ?? '')?.[1];

  if (key === 'src') {
    // An image is fetched without asking. Same-origin paths only: no scheme, no
    // protocol-relative host. `data:` is refused with the rest — it cannot beacon, but a
    // reader cannot tell it apart from the rest either, and nothing here needs it.
    if (scheme !== undefined || protocolRelative) return '';
    return raw;
  }

  // A link is a choice. Relative stays relative; absolute must be a scheme a person can be
  // sent to.
  if (scheme === undefined && !protocolRelative) return raw;
  if (protocolRelative) return raw;
  return NAVIGABLE.has(`${scheme?.toLowerCase()}:`) ? raw : '';
}

/**
 * Normalize markdown for the `ProseBlock` renderer, and decide which URLs in it may be
 * fetched.
 *
 * NORMALIZATION IS CRLF → LF AND TRIM. We deliberately do NOT escape `<`/`>`. `ProseBlock`
 * renders through react-markdown with remark-gfm and no raw-HTML plugin, so raw HTML is
 * already rendered as inert text — `<script>` never becomes a DOM node. A blanket `<`→`&lt;`
 * / `>`→`&gt;` escape corrupts legitimate content: inside a code span CommonMark does not
 * decode entities, so `` `<projectId>` `` and `->` render as the literal `&lt;projectId&gt;`
 * / `-&gt;`. Normalization is all that belongs there; safety is the renderer's job.
 *
 * THE URL POLICY IS THE OTHER HALF, and it was missing. Inert HTML stops script; it does not
 * stop a document body from reaching out. `![](https://someone-else/p.png)` is ordinary
 * markdown, and the browser fetches it the moment the document renders — so the author of a
 * document learns the IP address, the approximate location and the reading time of every
 * person who opens it, with no click and nothing on screen to notice. That is not a script
 * injection and no amount of HTML sanitising addresses it.
 *
 * The asymmetry below is the whole rule: a LINK is navigation a reader chooses, so an
 * external one is fine and only the dangerous schemes are refused. An IMAGE is a fetch the
 * reader never agreed to, so only a same-origin path is allowed and everything else is
 * dropped.
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
 * `key` is the attribute react-markdown is filling in — `src` for an image, `href` for a
 * link — which is what lets one function hold both halves of the policy.
 */
export function safeMarkdownUrl(url: string, key: string): string {
  const raw = url.trim();
  if (raw === '') return '';

  // A protocol-relative URL (`//host/p.png`) has no scheme and is NOT relative: the browser
  // supplies the page's own and fetches a third party. Treated as absolute everywhere below.
  const protocolRelative = raw.startsWith('//');
  // A scheme is only a scheme if it comes before the first `/`, `?` or `#`. Without that
  // bound, `some/path:with-a-colon` parses as the scheme `some/path`.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw.split(/[/?#]/, 1)[0] ?? '')?.[1];

  if (key === 'src') {
    // AN IMAGE IS FETCHED WITHOUT ASKING. Same-origin paths only: no scheme, no
    // protocol-relative host. `data:` is refused with the rest — it cannot beacon, but it
    // also cannot be told apart from the rest by a reader, and nothing here needs it.
    if (scheme !== undefined || protocolRelative) return '';
    return raw;
  }

  // A LINK IS A CHOICE. Relative stays relative; absolute must be a scheme a person can be
  // sent to.
  if (scheme === undefined && !protocolRelative) return raw;
  if (protocolRelative) return raw;
  return NAVIGABLE.has(`${scheme?.toLowerCase()}:`) ? raw : '';
}

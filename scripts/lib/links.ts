/**
 * Where a link leads, as a browser would follow it: `href` as the page writes it, resolved against the page's address.
 * Returns the path and search of a link to the page's own site, and null for what is not a fetch of this site: another
 * origin, `mailto:`, `tel:`, `javascript:` and a bare fragment of the page itself. Throws when `href` is not a URL
 * against that page.
 */
export function linkPath(href: string, page: string): string | null {
  const base = new URL(page);
  const url = new URL(href, base);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== base.origin) return null;
  if (href.trim().startsWith('#')) return null;
  return url.pathname + url.search;
}

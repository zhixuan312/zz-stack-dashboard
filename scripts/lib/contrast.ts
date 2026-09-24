/**
 * The WCAG relative-luminance formula, in one place.
 *
 * COUPLED: `scripts/design-metrics.ts` carries its own copy of `lum()` and `ratio()`, because
 * they live inside `measureInPage`, which Puppeteer serialises into the browser and a
 * serialised function cannot close over an import. `checks/contrast-formula-agrees.ts` asserts
 * the two copies agree on a fixed sample.
 */

/** sRGB channel → linear. */
const channel = (v: number): number => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** `#rrggbb` or `#rgb` → relative luminance. */
function lum(hex: string): number {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c: string) => c + c).join('');
  const n = parseInt(h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Contrast ratio between two hex colours, order-independent. */
export function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Read the custom properties declared in the first `:root { … }` block of a stylesheet and
 * resolve `var()` chains to literal hex.
 *
 * Only the first block: a stylesheet may redefine the same token under a media query or an
 * attribute selector, and the last declaration is whichever theme was written last rather than
 * the one that ships.
 */
export function readTokens(css: string): Record<string, string | null> {
  const start = css.indexOf(':root');
  if (start < 0) throw new Error('no :root block in stylesheet');
  const open = css.indexOf('{', start);
  let depth = 0, end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') { depth -= 1; if (!depth) { end = i; break; } }
  }
  const block = css.slice(open + 1, end);

  const raw: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) raw[m[1]] = m[2].trim();

  const seen = new Set<string>();
  const resolve = (name: string): string | null => {
    if (seen.has(name)) throw new Error('circular token: ' + name);
    const v = raw[name];
    if (v === undefined) return null;
    const ref = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
    if (!ref) return v;
    seen.add(name);
    const out = resolve(ref[1]);
    seen.delete(name);
    return out;
  };
  return Object.fromEntries(Object.keys(raw).map((k) => [k, resolve(k)]));
}

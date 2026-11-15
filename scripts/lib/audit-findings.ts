/**
 * The audit's findings, sorted by what a person can still do (`scripts/audit.ts` prints them, `scripts/browser.ts` reads
 * them back).
 *
 * Tier 1 fails the run: a page that answered an error, content that cannot be seen or reached *at all*, and an element a
 * person cannot use by mouse, touch, keyboard or screen reader. That is a route that served another page, a page that
 * rendered nothing, a custom element the audit could not look inside, a control with no accessible name, a focus ring that
 * never appears, focus landing on a control that draws nothing, two pieces of text drawn in the same place, and a table
 * wider than its frame — the last columns have no scroll container and nothing to scroll.
 *
 * Tier 2 is reported and exits nothing: something there and working that is awkward or that looks wrong. The rule names
 * a small target and low contrast, and a line cut but still visible — a truncated line, an ellipsis, a clipped edge — is
 * the look as well. Beside them: text drawn past a box that does not clip it, a page or a region that scrolls sideways, a
 * data page that does not fill its canvas, a heading that skips a level, a card that scrolls on its own, and a table head
 * that shows on a phone as stray words.
 *
 * The sort lives here, once, so the audit, the run that holds it and the closing line cannot each decide it differently.
 * A finding this file does not recognise is Tier 1: a new check is never reported by default, which is how a defect
 * arrives as a defect rather than as a line nobody reads.
 */

/** The reported kinds, matched against the line the audit prints, in the order they are tried. */
const REPORTED: readonly (readonly [RegExp, string])[] = [
  [/^contrast: /, 'contrast'],
  [/^touch target under 44px: /, 'touch target'],
  [/^heading skips a level: /, 'heading'],
  [/^scrollers: /, 'scrollers'],
  [/^clipped: /, 'clipped'],
  [/^truncated: /, 'truncated'],
  [/^spills: /, 'spills'],
  [/^a table head draws \d+px on a phone: /, 'table head'],
  // A page, a region or a strip that scrolls sideways is the look: the content is off screen and reachable by scrolling.
  // A table wider than its frame is not — its last columns have no scroller at all — and stays a Tier 1 failure.
  [/^sideways: (?!table )/, 'sideways'],
];

/** The reported kind a finding belongs to, or null for a finding that fails the run. */
export function kindOf(finding: string): string | null {
  for (const [pattern, kind] of REPORTED) if (pattern.test(finding)) return kind;
  return null;
}

/** 1 for content that cannot be seen or reached and an element a person cannot use, 2 for something there but awkward. */
export const tierOf = (finding: string): 1 | 2 => (kindOf(finding) ? 2 : 1);

/** Every finding the audit produced, in its own order, split into what fails the run and what it reports. */
export function partition(findings: readonly string[]): { blocking: string[]; reported: string[] } {
  const blocking: string[] = [];
  const reported: string[] = [];
  for (const f of findings) (tierOf(f) === 1 ? blocking : reported).push(f);
  return { blocking, reported };
}

/** How many of each reported kind: what the run's closing line counts, since a page can carry a dozen of one. */
export function countsOf(findings: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) {
    const kind = kindOf(f);
    if (kind) out[kind] = (out[kind] ?? 0) + 1;
  }
  return out;
}

/**
 * The audit's own line, read back by the browser run: `audit: {"blocking":0,"reported":{"contrast":12}}`. The human
 * summary (`audit: 0 issues across …`) is not one, and prints nothing here. What it found is named whether or not the
 * run is red, so a failure in one kind never hides a count of another.
 */
export function auditFindings(out: string): string[] {
  const line = /^audit: (\{.*\})$/m.exec(out)?.[1];
  if (!line) return [];
  let counts: Record<string, number>;
  try {
    counts = (JSON.parse(line) as { reported?: Record<string, number> }).reported ?? {};
  } catch {
    return [];
  }
  return Object.entries(counts)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => `${n} ${kind}`);
}

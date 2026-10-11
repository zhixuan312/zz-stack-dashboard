/**
 * Text the console did not write, and words the console writes about a count: `plural`, `count` and `sentence`.
 *
 * **All three live here because each was written where it was first needed and then missed everywhere else.** The
 * plural appeared hand-rolled in seventeen places while the fix for it sat in one; the dash for a count of nothing was
 * written once and re-derived in a second file, which also lost the thousands separator; and the borrowed sentence
 * began as a conditional at its first call site. A rule written twice is a rule that drifts; a rule written seventeen
 * times is a rule that is already wrong.
 *
 * The plural, the count and the dash are one subject — how a number becomes a phrase. `sentence` is here because it is
 * the same job in the other direction: text someone else wrote, made to sit inside a sentence this console did.
 */
import { formatCount } from '@/lib/format';

/**
 * The noun for a count, in the number it is.
 *
 * `plural(1, 'skill')` is "skill", `plural(0, 'skill')` is "skills" — English counts zero as a plural, and a reader
 * who sees "0 skill" reads a bug rather than a fact.
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/**
 * A count of nothing is a dash, not a zero: `0` reads as a measured result, and a team with no documents has not
 * measured anything. Written here rather than in the page that needed it first — it sat in `teams/page.tsx` while a
 * plugin's version count re-derived it as `s.versions || '—'`, which also lost the thousands separator that
 * `formatCount` puts in.
 *
 * This is a *count*. An absent value and an empty list read the same way on the page and are not the same rule — an
 * empty tag list has no number to format — so those stay where they are rather than being funnelled through here.
 */
export function count(n: number): string {
  return n ? formatCount(n) : '—';
}

/**
 * Text the console did not write, fitted into a sentence it did.
 *
 * The plugin and skill pages put a description an author wrote under their title, after a clause of the console's own
 * ending in a full stop. That description usually ends in one too, so appending one unconditionally read "…then close
 * and hand over.." — and an agent name, which never ends in a stop, is why the unconditional version looked right until
 * a plugin with a written description was rendered under it.
 */
export function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text : `${text}.`;
}

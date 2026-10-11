/**
 * Text the console did not write, and words the console writes about a count.
 *
 * Both rules live here because both were written where they were first needed and then missed everywhere else. A count
 * beside a fixed plural appeared in ten places — five phone cards, four notes and a version chain — while four other
 * files in this same repository already had the `n === 1 ? 'x' : 'xs'` idiom, and nobody notices the tenth. A rule
 * written twice is a rule that drifts; a rule written ten times is a rule that is already wrong.
 *
 * The count, the plural and the dash are one subject, so they live in one file.
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

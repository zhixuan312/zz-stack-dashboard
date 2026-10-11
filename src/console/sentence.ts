/**
 * Text the console did not write, fitted into a sentence it did.
 *
 * Two pages put a plugin's or a skill's own description under their title, after a clause of their own ending in a full
 * stop. The description is a sentence its author wrote and it usually ends in one too, so appending one unconditionally
 * read "…then close and hand over.." on the page — and an agent name, which never ends in a stop, is why the
 * unconditional version looked right until a plugin with a written description was rendered under it.
 *
 * Here rather than in either page: the rule is the same one, and a rule written twice is a rule that drifts. The last
 * time this repository wrote a count and a fixed plural beside each other in five places, all five were wrong.
 */
export function sentence(text: string): string {
  return /[.!?]$/.test(text.trim()) ? text : `${text}.`;
}

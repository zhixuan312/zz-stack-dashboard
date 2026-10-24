/**
 * A skill page's view, as its address names it (`?view=`).
 *
 * Not a client module, because the console's server chooses the view before the page renders, so the first paint is
 * the view the address asked for. A function exported from a client module is a client reference on the server: it
 * may be rendered or handed to a client component, never called, and calling `viewOf` from the page's client module
 * drew the error page for every skill (React #441).
 */

/** The page's three views: the runs are the default, because they are the reason to open a skill here. */
export type SkillViewName = 'cost' | 'read' | 'references';

/** The view an address names, as the console's server hands it to the page: anything else is the runs. */
export const viewOf = (asked: string | string[] | undefined): SkillViewName => {
  const v = Array.isArray(asked) ? asked[0] : asked;
  return v === 'read' || v === 'references' ? v : 'cost';
};

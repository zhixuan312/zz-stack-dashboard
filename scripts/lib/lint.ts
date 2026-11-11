/**
 * What a change's lint step reads: the source files a per-change run lints, so a lint error cannot reach master through
 * a run that checked types but never linted (one did: `react-hooks/refs` in the drawer, b54c5d7b). The whole repository
 * is still linted by `test:release`; this is the same tool over the files a change touched.
 */
const SOURCE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
/** Generated, installed or build output: never a person's change, and never what this lints. */
const NOT_SOURCE = /^(?:out|\.next|node_modules|\.meridian|cli\/payload|cli\/dist|cli\/test\/fixture[^/]*)\//;

/** The files of a change that eslint should read, in a stable order and without repeats. */
export function lintTargets(changed: string[]): string[] {
  return [...new Set(changed)].filter((f) => SOURCE.test(f) && !NOT_SOURCE.test(f)).sort();
}

/**
 * The names a hand run's list flag chose (`--tasks`, `--routes`, `--states`, `--as`), held to the names it may choose
 * from: null when the flag is absent, and a name that is none of them stops the run with exit 2 naming the valid ones.
 * A check whose only case was a typo otherwise runs nothing for it and passes. scripts/journeys.ts,
 * scripts/states-check.ts and scripts/primary-data.ts read their lists through it.
 */
export function named(script: string, args: readonly string[], flag: string, valid: readonly string[]): Set<string> | null {
  const i = args.indexOf(flag);
  if (i < 0) return null;
  const chosen = (args[i + 1] ?? '').split(',').filter(Boolean);
  const unknown = chosen.filter((n) => !valid.includes(n));
  if (unknown.length || !chosen.length) {
    console.error(`${script}: ${flag} ${chosen.length ? `names ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not` : 'names nothing; it takes'} one of ${valid.join(', ')}`);
    process.exit(2);
  }
  return new Set(chosen);
}

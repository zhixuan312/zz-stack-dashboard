/**
 * The values a Tier 2 table compares against before this project has a release of its own to compare with: the budgets in
 * `scripts/verify.config.ts`, plus the floors this repository's own suites hold. A project that never recorded a release
 * reads `Meridian's seed values, not this project's measurement` beside its table (`scripts/lib/tier2.ts`).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FIRST_LOAD_CAP_KB, budgetsOf, type BudgetsConfig } from './budgets.ts';
import type { Seed } from './tier2.ts';

export async function seedValues(root: string): Promise<Seed> {
  const config = ((await import(pathToFileURL(path.join(root, 'scripts', 'verify.config.ts')).href)) as { default?: BudgetsConfig }).default;
  const budgets = budgetsOf(config as BudgetsConfig);
  const warm = budgets.navigation.warm;
  return {
    'vitals.lcp': 2.5,
    'vitals.inp': 200,
    'vitals.cls': 0.1,
    'vitals.frames': 50,
    'sizes.first-load': budgets.firstLoadKb ?? FIRST_LOAD_CAP_KB,
    'nav.shell': warm.shellMs.desktop,
    'nav.data': warm.dataMs.desktop,
    'nav.interactive': warm.interactiveMs.desktop,
    'perf.shell': warm.shellMs.desktop,
    'perf.data': warm.dataMs.desktop,
    'perf.interactive': warm.interactiveMs.desktop,
    // The live cases' arrival (`scripts/live.ts`): a change a hint carries, and one only the safety refresh repairs.
    'live.two-tabs': 2000,
    'live.burst': 2000,
    'live.burst-send': 2000,
    'live.restart-before': 2000,
    'live.visibility': 5000,
    'live.offline': 5000,
    'live.suppressed': 5000,
    'live.restart-gone': 5000,
    'live.restart-after': 5000,
  };
}

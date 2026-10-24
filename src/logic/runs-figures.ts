/**
 * How a run's figures read wherever they are drawn, Runs and a skill's page alike, in a module of their own: a skill's
 * page importing Runs' context for one formatter carried that context's whole first load.
 */
import { formatCount } from '@/lib/format-units';

/** Calls per run, a mean: whole where it is whole, `96`, and to one place where it is not, `4.5`, never `96.0`. */
export const perRunOf = (n: number): string => formatCount(Math.round(n * 10) / 10);

/**
 * Runs' prepared query, `explore_runs`: the active team's runs and their observed output, each over Work's
 * `/work/query` (`src/data/prepared.ts`). The runs by skill, initiative, weekday and hour, and the observed output by
 * skill and initiative, a day, a week or a month at a time, down to the runs themselves with the page that lists them.
 * Its README lists the questions it answers.
 */
import type { PreparedQuery } from '@/lib/explore';
import { output, runs } from './tools/sources';

export const RUNS_EXPLORE: PreparedQuery = { sources: { runs, output } };

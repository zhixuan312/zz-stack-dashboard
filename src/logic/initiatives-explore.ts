/**
 * Initiatives' prepared queries: what an agent on `/initiatives` or on one initiative's page may count, group and compare.
 *
 * On the list, `explore_initiatives` counts the active team's closures by outcome and its openings, by flow, over any
 * window: the chart's closures by week and outcome, and what was opened beside them. On an initiative's page,
 * `explore_initiative` counts that initiative's words, approvals, runs and calls alone, every one held to the initiative
 * the page shows. Work is the active team's, so an initiative is named by its slug alone.
 */
import type { PreparedQuery } from '@/lib/explore';
import { approvals, calls, closures, opened, runs, words } from './tools/sources';

export const initiativesExplore: PreparedQuery = { sources: { closures, opened } };

export const initiativeExplore: PreparedQuery<{ slug: string }> = {
  sources: { words, approvals, runs, calls },
  fixed: async ({ slug }) => {
    const one = [{ field: 'initiative', op: 'eq' as const, value: slug }];
    return { words: one, approvals: one, runs: one, calls: one };
  },
};

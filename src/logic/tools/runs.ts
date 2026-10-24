/**
 * Runs' view tool, at `/runs`. Its arguments are spec version 8's: the skill the page narrows to and the recent runs'
 * page, `skill`, `limit` and `offset`, so it reads the `GET /runs` they name, as the page reads it. Its context is the
 * page's, at the page of ten the offset falls in.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Runs } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { PAGE_SIZE, runsContext, runsPath, type RunsFilters } from '../runs-context';
import { RUNS_EXPLORE } from '../runs-explore';
import { justRead, segment } from './shared';

export const runsTool = defineViewTool({
  name: 'runs',
  title: 'Runs',
  description: 'Every run the active team recorded since its first, or of one skill: how many, the observed output per run (the response bytes of its own calls, not what a model read and not a cost), the largest run, each skill\'s runs, calls per run, share refused, output per run and typical length, sorted by output per run, and a page of the recent runs with their initiative and their state. explore_runs counts the runs and their observed output over any window and lists them.',
  needs: FEATURES.runs.needs,
  page: '/runs',
  input: z.object({
    skill: segment('Only this skill\'s runs, by its name.').optional(),
    limit: z.number().int().min(1).max(100).optional().describe('How many recent runs, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).optional().describe('How many recent runs to skip, newest last call first; 0 when not given.'),
  }),
  async read({ skill = 'all', limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.runs.needs);
    const filters: RunsFilters = { skill, page: String(Math.floor(offset / PAGE_SIZE) + 1) };
    const read = { limit, offset };
    const data = await gatewayGet<Runs>(runsPath(filters, read));
    return { context: runsContext(data, { filters, read, ...justRead() }), data };
  },
  explore: RUNS_EXPLORE,
});

/** Runs' view tool, at `/runs`, and its prepared query over the team's runs and their observed output. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Runs } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { runsContext, runsPath } from '../runs-context';
import { justRead, segment } from './shared';
import { output, runs } from './sources';

export const runsTool = defineViewTool({
  name: 'runs',
  title: 'Runs',
  description: 'Every run the active team recorded since its first: how many, the observed output per run (the response bytes of its own calls, not what a model read and not a cost), the largest run, each skill\'s runs, calls, refusals, output and typical length, and the latest runs with their state.',
  needs: FEATURES.runs.needs,
  page: '/runs',
  input: z.object({ skill: segment('Only this skill\'s runs, by its name.').optional() }),
  async read({ skill = 'all' }) {
    await requireNeed(FEATURES.runs.needs);
    const data = await gatewayGet<Runs>(runsPath(skill));
    return { context: runsContext(data, { skill, ...justRead() }), data };
  },
  explore: { sources: { runs, output } },
});

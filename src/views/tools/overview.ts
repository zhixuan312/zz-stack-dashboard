/** Overview's view tool, at `/`, and its prepared query over the team's closures, openings and the caller's approvals. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Overview } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { overviewContext } from '../overview-context';
import { justRead, modeOf, period, withPeriod } from './shared';
import { approvals, closures, opened } from './sources';

export const overviewTool = defineViewTool({
  name: 'overview',
  title: 'Overview',
  description: 'How the platform is being used over a period: tool calls and their trend, how far open initiatives have got, what waits on a person, the knowledge shelf, context per run, and what refused.',
  needs: FEATURES.home.needs,
  page: '/',
  input: z.object({ period }),
  async read({ period: p = 'all' }) {
    await requireNeed(FEATURES.home.needs);
    const data = await gatewayGet<Overview>(withPeriod('/overview', p));
    return { context: overviewContext(data, { period: p, mode: await modeOf(), ...justRead() }), data };
  },
  explore: { sources: { closures, opened, approvals } },
});

/** Activity's view tool, at `/activity`, and its prepared query over the team's calls and refusals. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { ActivitySummary } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { activityContext } from '../activity-context';
import { justRead } from './shared';
import { calls, refusals } from './sources';

export const activityTool = defineViewTool({
  name: 'activity',
  title: 'Activity',
  description: 'The active team\'s real work by week: last week\'s calls and refusals, each refusal under one of four owners (a guardrail held, a malformed call, a tool failure, other) that sum to the total, the tool refused most, and the team\'s refusals grouped by owner, tool and message. explore_activity counts the calls and refusals of any window and lists them.',
  needs: FEATURES.activity.needs,
  page: '/activity',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.activity.needs);
    const data = await gatewayGet<ActivitySummary>('/activity/summary');
    return { context: activityContext({ summary: data, ...justRead() }), data };
  },
  explore: { sources: { calls, refusals } },
});

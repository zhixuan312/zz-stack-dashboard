/**
 * Usage's view tool, at `/platform/usage`. It takes no arguments, as spec version 8's tool table gives it none: it reads
 * `GET /platform/usage`, the same response its page reads on the server, and its context is the page's, from the same
 * `usageContext`. Its prepared query (`src/views/usage-explore.ts`) counts the calls, the refusals and the model calls.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Usage } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { usageContext } from '../platform-usage-context';
import { usageExplore } from '../usage-explore';

export const usageTool = defineViewTool({
  name: 'usage',
  title: 'Usage',
  description: 'How real work called the platform: last week\'s calls, share refused, slowest 5% of calls and sessions; calls by week (by team where the read names teams); the platform\'s own traffic and all refusals by population; refusals put right by week with median seconds, sessions continued and those that could not be judged; each tool\'s median call, first week against last; weekday by hour; the tools called most; calls per recorded approval; and the platform\'s model calls, whose cost is not recorded.',
  needs: FEATURES.usage.needs,
  page: '/platform/usage',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.usage.needs);
    const data = await gatewayGet<Usage>('/platform/usage');
    return { context: usageContext({ state: 'ok', usage: data }), data };
  },
  explore: usageExplore,
});

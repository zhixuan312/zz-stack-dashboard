/**
 * The platform's Status, at `/platform`: the same response its page reads on the server, reduced by the same
 * `statusRead`, and its prepared query (`src/views/platform-status-explore.ts`) over the platform's calls, refusals and
 * malformed calls, the rate per 1,000 a ratio of the malformed over the calls of the same window.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { platformStatusContext, statusRead } from '../platform-status-context';
import { platformStatusExplore } from '../platform-status-explore';

export const platformStatusTool = defineViewTool({
  name: 'platform_status',
  title: 'Status',
  description: 'What needs attention on the platform, malformed calls per 1,000 and refusals put right week by week, the eight measures against the week before, each door\'s fault days, what is running and the reader\'s own team\'s share.',
  needs: FEATURES['platform-status'].needs,
  page: '/platform',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES['platform-status'].needs);
    const data = await gatewayGet<PlatformStatus>('/platform/status');
    return { context: platformStatusContext(statusRead(data)), data };
  },
  explore: platformStatusExplore,
});

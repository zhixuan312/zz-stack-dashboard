/**
 * The platform's Status, at `/platform`: the same response its page reads on the server, reduced by the same
 * `statusRead`, and its prepared query over the platform's calls, refusals and malformed calls, the rate per 1,000 a
 * ratio of the malformed over the calls of the same window.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { platformStatusContext, statusRead } from '../platform-status-context';
import { malformed, platformCalls, platformRefusals } from './sources';

export const platformStatusTool = defineViewTool({
  name: 'platform_status',
  title: 'Status',
  description: 'How often real work called a tool the wrong way: malformed calls per 1,000 real-work calls in the last whole week, with the counts behind the figure and the week it is for.',
  needs: FEATURES['platform-status'].needs,
  page: '/platform',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES['platform-status'].needs);
    const data = await gatewayGet<PlatformStatus>('/platform/status');
    return { context: platformStatusContext(statusRead(data)), data };
  },
  explore: { sources: { malformed, calls: platformCalls(false), refusals: platformRefusals } },
});

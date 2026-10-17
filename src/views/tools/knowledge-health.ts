/**
 * Knowledge health's view tool, at `/platform/knowledge`. It takes no arguments, as spec version 8's tool table gives it
 * none: it reads `GET /platform/knowledge`, the same response its page reads on the server, projected to the caller by
 * the gateway, and its context is the page's, from the same `knowledgeHealthContext`. Its prepared query
 * (`src/views/knowledge-health-explore.ts`) counts the lessons made and the searches.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { knowledgeHealthExplore } from '../knowledge-health-explore';
import { knowledgeHealthContext } from '../platform-knowledge-context';

export const knowledgeHealthTool = defineViewTool({
  name: 'knowledge_health',
  title: 'Knowledge health',
  description: 'The knowledge store\'s health: the lessons adopted on every shelf, those made last week outside the import cohorts, last week\'s searches and the share with no result; each shelf\'s standing, superseded and imported lessons with its week (every team\'s by slug for a superadmin alone, a member\'s own shelf, the shared shelf and the totals); lessons made by week with what the import cohorts left out, exactly or by the day rule; the share of searches with no result by week with the share widened and the mean results; lessons by the week made with how many were superseded since; lessons by kind; and, for a superadmin alone, the questions the searches that found nothing asked.',
  needs: FEATURES['knowledge-health'].needs,
  page: '/platform/knowledge',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES['knowledge-health'].needs);
    const data = await gatewayGet<KnowledgeHealth>('/platform/knowledge');
    return { context: knowledgeHealthContext({ state: 'ok', health: data }), data };
  },
  explore: knowledgeHealthExplore,
});

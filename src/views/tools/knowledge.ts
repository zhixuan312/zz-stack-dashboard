/** Knowledge's view tool, at `/knowledge`, and its prepared query over the shelf, the lessons made and the searches. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { KNOWLEDGE_KINDS, PAGE_SIZE as KNOWLEDGE_PAGE, knowledgeContext, knowledgePath } from '../knowledge-context';
import { justRead, search } from './shared';
import { lessons, searches, shelf } from './sources';

export const knowledgeTool = defineViewTool({
  name: 'knowledge',
  title: 'Knowledge',
  description: 'The active team\'s knowledge shelf, filtered and paged by the gateway, ten to a page: its standing and superseded lessons, the imported among them, last week\'s searches and those that found nothing, the team\'s own questions that found nothing, searches with results by week, the newest lessons, and the lessons that match.',
  needs: FEATURES.knowledge.needs,
  page: '/knowledge',
  input: z.object({
    q: search.describe('Text in a lesson\'s title, tags or text.'),
    kind: z.enum(['all', ...KNOWLEDGE_KINDS]).optional().describe('One kind of lesson.'),
    page: z.number().int().min(1).max(10_000).optional().describe('The page, from 1.'),
  }),
  async read({ q = '', kind = 'all', page = 1 }) {
    await requireNeed(FEATURES.knowledge.needs);
    const filters = { q, kind };
    const [summary, list] = await Promise.all([gatewayGet<KnowledgeSummary>('/knowledge/summary'), gatewayGet<KnowledgeList>(knowledgePath(filters, { offset: (page - 1) * KNOWLEDGE_PAGE }))]);
    const data = { summary, list };
    return { context: knowledgeContext({ ...data, filters, page, ...justRead() }), data };
  },
  explore: { sources: { shelf, lessons, searches } },
});

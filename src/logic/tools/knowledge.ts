/**
 * Knowledge's view tool, at `/knowledge`, and its prepared query over the shelf, the lessons made and the searches. Its
 * arguments are spec version 8's: `q`, `kind`, `limit` and `offset`, each the shelf route's own, so `q` is the words
 * in a lesson's title, tags or text. It reads the summary the page's server reads and the shelf, and builds the page's
 * context from them. The ranked search the page leads with is `view_search`'s, not this tool's.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { KNOWLEDGE_KINDS, PAGE_SIZE, knowledgeContext, knowledgePath } from '../knowledge-context';
import { KNOWLEDGE_EXPLORE } from '../knowledge-explore';
import { justRead, search } from './shared';

export const knowledgeTool = defineViewTool({
  name: 'knowledge',
  title: 'Knowledge',
  description: 'The active team\'s knowledge, as its page shows it: the lessons adopted with the imported among them, the superseded, last week\'s searches and those that found nothing, the team\'s own questions that found nothing (most asked first), searches with results by week, the newest lessons, and the shelf\'s lessons, filtered and paged by the gateway, newest first. What a document or lesson says, and what the page\'s search ranked, is view_search\'s.',
  needs: FEATURES.knowledge.needs,
  page: '/knowledge',
  input: z.object({
    q: search.describe('Words in a lesson\'s title, tags or text, on the team\'s shelf.'),
    kind: z.enum(['all', ...KNOWLEDGE_KINDS]).optional().describe('One kind of lesson.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many lessons, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many lessons to skip, newest first; 0 when not given.'),
  }),
  async read({ q = '', kind = 'all', limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.knowledge.needs);
    const [summary, list] = await Promise.all([
      gatewayGet<KnowledgeSummary>('/knowledge/summary'),
      gatewayGet<KnowledgeList>(knowledgePath({ q, kind }, { limit, offset })),
    ]);
    const data = { summary, list };
    // The page's address for these rows: its kind, and the page of ten the offset falls in, with no question searched.
    const context = knowledgeContext({ ...data, filters: { q: '', kind }, page: Math.floor(offset / PAGE_SIZE) + 1, shelf: { q, limit, offset }, ...justRead() });
    return { context, data };
  },
  explore: KNOWLEDGE_EXPLORE,
});

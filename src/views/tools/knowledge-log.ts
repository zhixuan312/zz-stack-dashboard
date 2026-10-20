/**
 * The knowledge log's view tool, at `/knowledge/log`: the page's log, every node recorded or superseded, which the
 * destinations table keeps as a tab of Knowledge (FR-18). It offers Knowledge's own prepared query, so the log asks the
 * shelf, the lessons made and the searches what Knowledge asks them.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeLog } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { KNOWLEDGE_EXPLORE } from '../knowledge-explore';
import { knowledgeLogContext } from '../knowledge-log-context';
import { justRead } from './shared';

export const knowledgeLogTool = defineViewTool({
  name: 'knowledge_log',
  title: 'Knowledge log',
  description: 'Every node recorded on the shelf and every node superseded, newest first, with who did it: Knowledge\'s log.',
  needs: FEATURES.knowledge.needs,
  page: '/knowledge/log',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.knowledge.needs);
    const data = await gatewayGet<KnowledgeLog>('/knowledge/log');
    return { context: knowledgeLogContext(data, justRead()), data };
  },
  explore: KNOWLEDGE_EXPLORE,
});

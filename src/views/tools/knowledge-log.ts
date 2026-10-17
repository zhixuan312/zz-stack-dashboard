/** The knowledge log's view tool, at `/knowledge/log`, and its prepared query over the lessons made and the shelf. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { knowledgeLogContext } from '../knowledge-log-context';
import { justRead, modeOf } from './shared';
import { lessons, shelf } from './sources';

export const knowledgeLogTool = defineViewTool({
  name: 'knowledge_log',
  title: 'Knowledge log',
  description: 'Every node recorded on the shelf and every node superseded, newest first.',
  needs: FEATURES.knowledge.needs,
  page: '/knowledge/log',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.knowledge.needs);
    const data = await gatewayGet<{ entries: KnowledgeLogEntry[] }>('/knowledge/log');
    return { context: knowledgeLogContext(data.entries, { mode: await modeOf(), ...justRead() }), data };
  },
  explore: { sources: { lessons, shelf } },
});

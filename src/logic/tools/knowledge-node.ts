/**
 * One knowledge node's view tool, at `/knowledge/[team]/[...path]`, and its prepared query. The gateway's prepared query
 * keys no lesson by itself, so the node's record is its kind: every call is held to the lessons of that kind.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { KnowledgeBody } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { knowledgeNodeContext } from '../knowledge-node-context';
import { file, justRead, segment } from './shared';
import { lessons, shelf } from './sources';

export const knowledgeNodeTool = defineViewTool({
  name: 'knowledge_node',
  title: 'Knowledge node',
  description: 'One knowledge node: the lesson itself, its status, the initiative it was learned in, and the nodes that share a tag with it.',
  needs: FEATURES.knowledge.needs,
  page: '/knowledge/[team]/[...path]',
  input: z.object({ team: segment('The team whose shelf the node is on.'), path: file('The node\'s path, as the knowledge list gives it, such as nodes/0002-a-title.md.') }),
  async read({ team, path }) {
    await requireNeed(FEATURES.knowledge.needs);
    const data = await gatewayGet<KnowledgeBody>(`/knowledge/${team}/${path}`);
    return { context: knowledgeNodeContext(data, justRead()), data };
  },
  explore: {
    sources: { shelf, lessons },
    fixed: async ({ team, path }) => {
      const { type } = await gatewayGet<KnowledgeBody>(`/knowledge/${team}/${path}`);
      const kind = [{ field: 'kind', op: 'eq' as const, value: type }];
      return { shelf: kind, lessons: kind };
    },
  },
});

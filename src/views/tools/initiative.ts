/** One initiative's view tool, at `/initiatives/[team]/[slug]`, and its prepared query held to that initiative. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { InitiativeDetail } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { initiativeContext } from '../initiative-context';
import { justRead, segment } from './shared';
import { approvals, calls, runs, words } from './sources';

export const initiativeTool = defineViewTool({
  name: 'initiative',
  title: 'Initiative',
  description: 'One initiative: its state, where it is in its flow, its gates, its documents and their approval, and what waits on a person.',
  needs: FEATURES.initiatives.needs,
  page: '/initiatives/[team]/[slug]',
  input: z.object({ team: segment('The team\'s slug.'), slug: segment('The initiative\'s slug.') }),
  async read({ team, slug }) {
    await requireNeed(FEATURES.initiatives.needs);
    const data = await gatewayGet<InitiativeDetail>(`/initiatives/${team}/${slug}`);
    return { context: initiativeContext(data, justRead()), data };
  },
  explore: {
    sources: { words, approvals, runs, calls },
    // Work is the active team's, so the initiative is named by its slug alone.
    fixed: async ({ slug }) => {
      const one = [{ field: 'initiative', op: 'eq' as const, value: slug }];
      return { words: one, approvals: one, runs: one, calls: one };
    },
  },
});

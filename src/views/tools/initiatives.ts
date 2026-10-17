/** Initiatives' view tool, at `/initiatives`, and its prepared query over the team's closures and openings. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import type { InitiativeList } from '@/lib/work-shapes';
import { initiativesContext } from '../initiatives-context';
import { LIST_STATES, listPath, offsetOf } from '../initiatives-filter';
import { justRead, search } from './shared';
import { closures, opened } from './sources';

export const initiativesTool = defineViewTool({
  name: 'initiatives',
  title: 'Initiatives',
  description: 'The active team\'s work, filtered and paged by the gateway, ten to a page: how many match by state and flow over all of them, the open, waiting and closed counts, and each initiative in the page with where it goes next.',
  needs: FEATURES.initiatives.needs,
  page: '/initiatives',
  input: z.object({
    q: search.describe('Text in the slug.'),
    state: z.enum(['all', ...LIST_STATES]).optional().describe('waiting: a revision presented and not yet approved; quiet: open and untouched for 14 days or more.'),
    flow: z.string().max(100).optional().describe('A flow\'s name, exactly.'),
    page: z.number().int().min(1).max(10_000).optional().describe('The page, from 1.'),
  }),
  async read({ q = '', state = 'all', flow = 'all', page = 1 }) {
    await requireNeed(FEATURES.initiatives.needs);
    const filters = { q, state, flow };
    const data = await gatewayGet<InitiativeList>(listPath(filters, { offset: offsetOf(page) }));
    return { context: initiativesContext(data, { filters, page, ...justRead() }), data };
  },
  explore: { sources: { closures, opened } },
});

/**
 * Initiatives' view tool, at `/initiatives`. Its arguments are the route's own: `state`, `flow` and `q` filter the active
 * team's work as the page's filter bar does, and `limit` and `offset` page it, so it reads `GET /initiatives` as the
 * page does and answers the same `InitiativeList`. Its context is the page's, at the page of ten the offset falls in.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import type { InitiativeList } from '@/lib/work-shapes';
import { initiativesContext } from '../initiatives-context';
import { initiativesExplore } from '../initiatives-explore';
import { LIST_STATES, PAGE_SIZE, listPath, pageAt } from '../initiatives-filter';
import { justRead, search } from './shared';

export const initiativesTool = defineViewTool({
  name: 'initiatives',
  title: 'Initiatives',
  description: 'The active team\'s work, filtered and paged by the gateway, ten to a page when not told otherwise: how many match by state and flow over all of them, the open, waiting and closed counts, closures by week and outcome, and each initiative in the page with where it goes next.',
  needs: FEATURES.initiatives.needs,
  page: '/initiatives',
  input: z.object({
    state: z.enum(['all', ...LIST_STATES]).optional().describe('waiting: a revision presented and not yet approved; quiet: open and untouched for 14 days or more.'),
    flow: z.string().max(100).optional().describe('A flow\'s name, exactly.'),
    q: search.describe('Text in the slug.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many initiatives, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many initiatives to skip, waiting first; 0 when not given.'),
  }),
  async read({ state = 'all', flow = 'all', q = '', limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.initiatives.needs);
    const filters = { q, state, flow };
    const read = { limit, offset };
    const page = pageAt(offset);
    const data = await gatewayGet<InitiativeList>(listPath({ ...filters, page }, read));
    return { context: initiativesContext(data, { filters, page: Number(page), read, ...justRead() }), data };
  },
  explore: initiativesExplore,
});

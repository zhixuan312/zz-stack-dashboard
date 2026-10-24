/**
 * Approvals' view tool, at `/approvals`. Its arguments are spec version 8's: `tab`, `limit` and `offset`, the route's own,
 * so it reads `GET /approvals` as the page does, the waiting tab unless another is named, and answers the same
 * `Approvals`, both lists' summaries included. Its context is the page's, at the page of ten the offset falls in. It
 * approves nothing and takes nothing an approval is made of: a person approves on the document's own page.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import type { Approvals } from '@/lib/work-shapes';
import { APPROVALS_TABS, PAGE_SIZE, approvalsContext, approvalsPath, pageAt } from '../approvals-context';
import { APPROVALS_EXPLORE } from '../approvals-explore';
import { justRead } from './shared';

export const approvalsTool = defineViewTool({
  name: 'approvals',
  title: 'Approvals',
  description: 'The active team\'s revisions presented and not yet approved (Team approvals: nothing records who must decide one), and the approvals recorded in the caller\'s own name there, each with its exact version and content revision, when it was approved, where it was shown and the basis it was decided on, as the gateway classified them; the counts of both. It reads and never approves: a person approves on the document\'s own page.',
  needs: FEATURES.approvals.needs,
  page: '/approvals',
  input: z.object({
    tab: z.enum(APPROVALS_TABS).optional().describe('waiting: the team\'s revisions presented and not yet approved; history: the approvals recorded in your name. waiting when not given.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many rows of the tab, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many rows of the tab to skip, in its own order; 0 when not given.'),
  }),
  async read({ tab = 'waiting', limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.approvals.needs);
    const read = { limit, offset };
    const page = pageAt(offset);
    const data = await gatewayGet<Approvals>(approvalsPath({ tab, page }, read));
    return { context: approvalsContext(data, { tab, page: Number(page), read, ...justRead() }), data };
  },
  explore: APPROVALS_EXPLORE,
});

/**
 * Audit's view tool, at `/platform/audit`, the superadmin's alone. Its arguments are spec version 8's: `filter`, which
 * tab (`administration` or `all`, Everything), and the route's own `limit` and `offset`, so it reads
 * `GET /platform/audit` as the route pages it, newest first. It answers the same response its page reads, and its
 * context is the page's, from the same `auditContext` with the titles of the reports its acts name read as the page reads
 * them, at the page of ten the offset falls in. Its prepared query
 * (`src/views/audit-explore.ts`) counts the events by kind and team. It changes nothing.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Audit } from '@/lib/fleet-shapes';
import type { BugReport } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { auditExplore } from '../audit-explore';
import { AUDIT_FILTERS, PAGE_SIZE, auditContext, auditPath, pageAt, reportTitles } from '../platform-audit-context';
import { justRead } from './shared';

export const auditTool = defineViewTool({
  name: 'audit',
  title: 'Audit',
  description: 'The platform\'s recorded administration, the superadmin\'s alone: with filter administration, each act that changed who may do what or closed a report, as the sentence Audit shows; with filter all, every recorded event but page views as metadata (kind, team, actor, subject, result, origin), newest first, the latest 500. How an act arrived is not recorded.',
  needs: FEATURES.audit.needs,
  page: '/platform/audit',
  input: z.object({
    filter: z.enum(AUDIT_FILTERS).describe('administration for the acts of administration, as sentences; all for every recorded event but page views.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(499).optional().describe('How many to skip, newest first, within the latest 500; 0 when not given.'),
  }),
  async read({ filter, limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.audit.needs);
    const read = { limit, offset };
    const filters = pageAt(filter, offset);
    const data = await gatewayGet<Audit>(auditPath(filters, read));
    const reports = await reportTitles(data, (p) => gatewayGet<BugReport>(p));
    return { context: auditContext(data, { filters, read, reports, ...justRead() }), data };
  },
  explore: auditExplore,
});

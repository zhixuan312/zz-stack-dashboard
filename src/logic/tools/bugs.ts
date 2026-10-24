/**
 * Bugs' view tools. `view_bugs`, at `/platform/bugs`, takes spec version 8's arguments, `state`, `impact`, `surface`,
 * `limit` and `offset`, the route's own, so it reads `GET /platform/bugs` as the route filters and pages it, newest
 * first; its context is the page's, at the page of ten the offset falls in. `view_bug`, at `/platform/bugs/[id]`, reads
 * one report and its duplicate targets, as its page does, and is the superadmin's alone. Both offer the one prepared
 * query (`src/views/bugs-explore.ts`). Neither changes anything: a report is resolved on its page, by a person.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { BugReport, Bugs } from '@/lib/platform-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { bugsExplore } from '../bugs-explore';
import {
  BUGS_DEFAULTS, BUG_IMPACTS, BUG_STATES, PAGE_SIZE, bugContext, bugPath, bugsContext, bugsPath, duplicatesPath, pageAt, type BugDuplicates,
} from '../platform-bugs-context';
import { segment } from './shared';

export const bugsTool = defineViewTool({
  name: 'bugs',
  title: 'Bugs',
  description: 'Every real bug report: how many are open, the oldest open, reports per 1,000 calls and the median hours to resolve; reports filed and resolved by the week filed; the outcomes and the impacts; and the queue, newest first, filtered by state, impact and surface.',
  needs: FEATURES.bugs.needs,
  page: '/platform/bugs',
  input: z.object({
    state: z.enum(BUG_STATES).optional().describe('open or resolved; every report when not given.'),
    impact: z.enum(BUG_IMPACTS).optional().describe('blocks_work, wrong_result, confusing or cosmetic; every impact when not given.'),
    surface: z.string().regex(/^[a-z][a-z0-9_]*$/).max(64).optional().describe('A tool\'s name, a door (core, manage, eval) or console; every surface when not given.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many reports, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many reports to skip, newest first; 0 when not given.'),
  }),
  async read({ state, impact, surface, limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.bugs.needs);
    const read = { limit, offset };
    const filters = pageAt({ ...BUGS_DEFAULTS, state: state ?? 'all', impact: impact ?? 'all', surface: surface ?? 'all' }, offset);
    const data = await gatewayGet<Bugs>(bugsPath(filters, read));
    return { context: bugsContext(data, { filters, read }), data };
  },
  explore: bugsExplore,
});

export const bugTool = defineViewTool({
  name: 'bug',
  title: 'Bug report',
  description: 'One bug report, the superadmin\'s alone: its title and the reporter\'s own words, its impact, surface, team and version, what was decided, and the reports of its team it may be closed as a duplicate of.',
  needs: FEATURES.bug.needs,
  page: '/platform/bugs/[id]',
  input: z.object({ id: segment('The report\'s id, as its page\'s address names it: 0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01.') }),
  async read({ id }) {
    await requireNeed(FEATURES.bug.needs);
    const [report, duplicates] = await Promise.all([gatewayGet<BugReport>(bugPath(id)), gatewayGet<BugDuplicates>(duplicatesPath(id))]);
    return { context: bugContext(report, duplicates), data: { report, duplicates } };
  },
  explore: bugsExplore,
});

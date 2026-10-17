/**
 * Activity's view tool, at `/activity`. Its arguments are spec version 8's: the log's own four filters and its page,
 * `kind`, `tool`, `initiative`, `refused`, `limit` and `offset`, so it reads `GET /activity/summary` and the page of
 * `GET /activity` they name, as the page reads them. Its context is the page's, at the page of ten the offset falls in.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { ActivityLog, ActivitySummary } from '@/lib/destination-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { PAGE_SIZE, activityContext, activityPath, type ActivityFilters } from '../activity-context';
import { ACTIVITY_EXPLORE } from '../activity-explore';
import { justRead, segment } from './shared';

/** A name the log narrows by: a kind or a tool, as the log's own lists name them (`tool_call`, `core:document_edit`). */
const named = (what: string) => z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/).max(200).optional().describe(what);

export const activityTool = defineViewTool({
  name: 'activity',
  title: 'Activity',
  description: 'The active team\'s real work by week: last week\'s calls and refusals, each refusal under one of four owners (a guardrail held, a malformed call, a tool failure, other) that sum to the total, the tool refused most, the refusals by week and owner, the team\'s refusals grouped by owner, tool and message, and a page of its event log, newest first, narrowed by kind, tool, initiative and whether a call was refused. explore_activity counts the calls and refusals of any window and lists them.',
  needs: FEATURES.activity.needs,
  page: '/activity',
  input: z.object({
    kind: named('Only events of this kind, as the log names it (tool_call, document.patch).'),
    tool: named('Only calls of this tool, as the log names it (core:document_edit).'),
    initiative: segment('Only events of this initiative of the active team, by its slug.').optional(),
    refused: z.enum(['true', 'false']).optional().describe('true for refused calls alone, false for everything that was not refused.'),
    limit: z.number().int().min(1).max(100).optional().describe('How many events, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(499).optional().describe('How many events to skip, newest first; 0 when not given. The log reads the latest 500.'),
  }),
  async read({ kind, tool, initiative, refused, limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.activity.needs);
    const filters: ActivityFilters = { kind: kind ?? 'all', tool: tool ?? 'all', initiative: initiative ?? 'all', refused: refused ?? 'all' };
    const [summary, log] = await Promise.all([gatewayGet<ActivitySummary>('/activity/summary'), gatewayGet<ActivityLog>(activityPath(filters, { limit, offset }))]);
    const page = Math.floor(offset / PAGE_SIZE) + 1;
    return { context: activityContext({ summary, log, filters, page, read: { limit, offset }, ...justRead() }), data: { summary, log } };
  },
  explore: ACTIVITY_EXPLORE,
});

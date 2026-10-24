/**
 * Teams' view tool, at `/platform/teams`. Its arguments are spec version 8's: `limit` and `offset`, the route's own, so
 * it reads `GET /teams` as the route pages it, every team, latest real-work call first. Its context is the page's, at
 * the page of ten the offset falls in. The page's own filters (`q`, `status`) are its address's, not this tool's.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Teams } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { teamsContext } from '../teams-context';
import { teamsExplore } from '../teams-explore';
import { PAGE_SIZE, TEAMS_DEFAULTS, pageAt, teamsPath } from '../teams-filter';

export const teamsTool = defineViewTool({
  name: 'teams',
  title: 'Teams',
  description: 'Every team on the platform, latest real-work call first: its people, open work, revisions waiting and lessons, its sessions by week and its calls last week and the week before, each against its own past.',
  needs: FEATURES.teams.needs,
  page: '/platform/teams',
  input: z.object({
    limit: z.number().int().min(1).max(100).optional().describe('How many teams, 1 to 100; 10 when not given, as the page lists them.'),
    offset: z.number().int().min(0).max(1_000_000).optional().describe('How many teams to skip, latest real-work call first; 0 when not given.'),
  }),
  async read({ limit = PAGE_SIZE, offset = 0 }) {
    await requireNeed(FEATURES.teams.needs);
    const read = { limit, offset };
    const data = await gatewayGet<Teams>(teamsPath(TEAMS_DEFAULTS, read));
    return { context: teamsContext(data, { filters: pageAt(offset), read }), data };
  },
  explore: teamsExplore,
});

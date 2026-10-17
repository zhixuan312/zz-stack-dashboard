/** Teams' view tool, at `/teams`, and its prepared query over the teams and the platform's calls by team. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Team } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { teamsContext } from '../teams-context';
import { EVERY_ROW, justRead, search } from './shared';
import { platformCalls, teams } from './sources';

export const teamsTool = defineViewTool({
  name: 'teams',
  title: 'Teams',
  description: 'Every team on the platform, filtered: who is in each and what it holds.',
  needs: FEATURES.teams.needs,
  page: '/teams',
  input: z.object({ q: search.describe('Text in the slug or the name.'), status: z.enum(['all', 'active', 'archived']).optional() }),
  async read({ q = '', status = 'all' }) {
    await requireNeed(FEATURES.teams.needs);
    const data = await gatewayGet<{ teams: Team[]; total: number }>(`/teams?${EVERY_ROW}`);
    return { context: teamsContext(data.teams, data.total, { filters: { q, status }, ...justRead() }), data };
  },
  explore: { sources: { teams, calls: platformCalls(true) } },
});

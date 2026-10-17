/** One team's view tool, at `/teams/[slug]`, and its prepared query over that team's real-work calls. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { TeamDetail } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { teamContext } from '../team-context';
import { justRead, segment } from './shared';
import { platformCalls } from './sources';

export const teamTool = defineViewTool({
  name: 'team',
  title: 'Team',
  description: 'One team: what it holds, how much of its work is open and waiting, and its people. Its initiatives are its own to read, so they are not listed.',
  needs: FEATURES.teams.needs,
  page: '/teams/[slug]',
  input: z.object({ slug: segment('The team\'s slug.') }),
  async read({ slug }) {
    await requireNeed(FEATURES.teams.needs);
    // The team's own read, as its page builds it: the same counts as its row in the list.
    const team = await gatewayGet<TeamDetail>(`/teams/${slug}`);
    return { context: teamContext(slug, { team, ...justRead() }), data: team };
  },
  explore: {
    sources: { calls: platformCalls(false) },
    fixed: async ({ slug }) => ({ calls: [{ field: 'team', op: 'eq', value: slug }] }),
  },
});

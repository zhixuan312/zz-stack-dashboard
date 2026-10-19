/** One team's view tool, at `/platform/teams/[slug]`: the page's own read, and its prepared query over the team's calls. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { TeamDetail } from '@/lib/fleet-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { teamContext } from '../team-context';
import { teamExplore } from '../teams-explore';
import { segment } from './shared';

export const teamTool = defineViewTool({
  name: 'team',
  title: 'Team',
  description: 'One team: its people, open work, revisions waiting and lessons, its real-work calls by week and its members. Its initiatives are its own to read, so they are not listed.',
  needs: FEATURES.teams.needs,
  page: '/platform/teams/[slug]',
  input: z.object({ slug: segment('The team\'s slug.') }),
  async read({ slug }) {
    await requireNeed(FEATURES.teams.needs);
    const team = await gatewayGet<TeamDetail>(`/teams/${slug}`);
    return { context: teamContext(slug, { team }), data: team };
  },
  explore: teamExplore,
});

/**
 * Home's view tool, at `/`: the same `Home` its page reads on the server, told through the same `homeContext`, and its
 * prepared query over the team's closures, openings, words, the caller's approvals and the runs, every one of them
 * answered by Work's `/work/query`.
 */
import { z } from 'zod';
import { chromeAccess, requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import type { Home } from '@/lib/work-shapes';
import { homeContext } from '../home-context';
import { HOME_EXPLORE } from '../home-explore';

export const homeTool = defineViewTool({
  name: 'home',
  title: 'Home',
  description: 'The active team\'s last whole week: its title, what waits for approval, words added and approvals in the caller\'s name by week with their findings, the writing estimate, the runs active now, the next milestones, the open work with each initiative\'s next move, and what closed.',
  needs: FEATURES.home.needs,
  page: '/',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.home.needs);
    const [data, { team }] = await Promise.all([gatewayGet<Home>('/home'), chromeAccess()]);
    return { context: homeContext({ state: 'ok', home: data, team: team ?? null }), data };
  },
  explore: HOME_EXPLORE,
});

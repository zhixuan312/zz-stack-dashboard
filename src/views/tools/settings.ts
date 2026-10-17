/** Settings' view tool, at `/settings`, and its prepared query over the caller's own tokens. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Me, MyAccessToken, MyTeams } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { settingsContext } from '../settings-context';
import { justRead, modeOf } from './shared';
import { tokens } from './sources';

export const settingsTool = defineViewTool({
  name: 'settings',
  title: 'Settings',
  description: 'The person\'s own settings: who they are signed in as, the team this browser acts for, their teams and their tokens by label and date.',
  needs: FEATURES.settings.needs,
  page: '/settings',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.settings.needs);
    const [me, teams, list] = await Promise.all([gatewayGet<Me>('/me'), gatewayGet<MyTeams>('/settings/me/teams'), gatewayGet<MyAccessToken[]>('/settings/me/tokens')]);
    const data = { me, teams, tokens: list };
    return { context: settingsContext({ ...data, mode: await modeOf(), ...justRead() }), data };
  },
  explore: { sources: { tokens } },
});

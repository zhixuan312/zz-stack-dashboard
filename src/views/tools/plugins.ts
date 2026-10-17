/** Plugins' view tool, at `/plugins`, and its prepared query over the team's calls of each shipped skill. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { PluginRow } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { pluginsContext } from '../plugins-context';
import { justRead } from './shared';
import { skillCalls } from './sources';

export const pluginsTool = defineViewTool({
  name: 'plugins',
  title: 'Plugins',
  description: 'Every plugin in the catalog: whether it is required, its version, its skills and gates, the command that installs it, its latest public score with its protocol, date and whether its scores compare, and the active team\'s calls of it. Nobody starts an evaluation from the console.',
  needs: FEATURES.plugins.needs,
  page: '/plugins',
  input: z.object({}),
  async read() {
    await requireNeed(FEATURES.plugins.needs);
    const data = await gatewayGet<{ plugins: PluginRow[] }>('/plugins');
    return { context: pluginsContext(data.plugins, justRead()), data };
  },
  explore: { sources: { skillCalls } },
});

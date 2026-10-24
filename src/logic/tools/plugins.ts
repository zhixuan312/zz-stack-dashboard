/**
 * Plugins' view tool, at `/plugins`. Its one argument is spec version 8's, `plugin`, which is the page's own search:
 * the list narrowed to the plugins whose name holds it, as the address `?plugin=` narrows the table. It reads the
 * `GET /plugins` the page reads, and its context is the page's for the same plugins in view. Nobody starts an
 * evaluation from it, or from the page.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import { defineViewTool } from '@/lib/shared-context';
import { PLUGINS_DEFAULTS, PLUGINS_PATH, pluginsContext, type Catalog } from '../plugins-context';
import { PLUGINS_EXPLORE } from '../plugins-explore';
import { justRead } from './shared';

export const pluginsTool = defineViewTool({
  name: 'plugins',
  title: 'Plugins',
  description: 'Every plugin in the catalog, the active team\'s most recently used first: whether it is required, its version, its skills and gates, its latest public score out of 10 with the protocol and date it was scored against and whether its scores compare, the command that installs it, and the active team\'s own calls of it. Nobody starts an evaluation from the console.',
  needs: FEATURES.plugins.needs,
  page: '/plugins',
  input: z.object({
    plugin: z.string().trim().max(100).optional().describe('Only the plugins whose name holds this, as the page\'s search narrows the list; every plugin when not given.'),
  }),
  async read({ plugin = PLUGINS_DEFAULTS.plugin }) {
    await requireNeed(FEATURES.plugins.needs);
    const data = await gatewayGet<Catalog>(PLUGINS_PATH);
    return { context: pluginsContext(data.plugins, { filters: { plugin }, ...justRead() }), data };
  },
  explore: PLUGINS_EXPLORE,
});

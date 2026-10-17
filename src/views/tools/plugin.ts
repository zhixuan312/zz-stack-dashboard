/**
 * One plugin's view tool, at `/plugins/[plugin]`: the catalog and the owning team's evaluation, the two reads its page
 * makes, told through the page's context. The evaluation is the superadmin's and the owning team's alone, and the
 * gateway refuses it to anybody else with a 403; that is its absence for this reader, as on the page, never an error.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { GatewayError, gatewayGet } from '@/data/gateway';
import type { PluginEval } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { evalPath, pluginContext } from '../plugin-context';
import { PLUGINS_PATH, type Catalog } from '../plugins-context';
import { PLUGIN_EXPLORE } from '../plugins-explore';
import { justRead, segment } from './shared';

/** The evaluation, or null when the gateway withholds it from this reader. */
const evaluationOf = (plugin: string): Promise<PluginEval | null> =>
  gatewayGet<PluginEval>(evalPath(plugin)).catch((err: unknown) => {
    if (err instanceof GatewayError && err.status === 403) return null;
    throw err;
  });

export const pluginTool = defineViewTool({
  name: 'plugin',
  title: 'Plugin',
  description: 'One plugin: what it ships and governs, whether it is required and the command that installs it, its public score out of 10 with its protocol, date and whether its scores compare, the active team\'s calls of its skills, and, for the superadmin and the plugin\'s owning team, its evaluation with its score by dimension, guardrails, findings and candidates for change. Nobody starts an evaluation from the console.',
  needs: FEATURES.plugins.needs,
  page: '/plugins/[plugin]',
  input: z.object({ plugin: segment('The plugin\'s name.') }),
  async read({ plugin }) {
    await requireNeed(FEATURES.plugins.needs);
    const [catalog, evaluation] = await Promise.all([gatewayGet<Catalog>(PLUGINS_PATH), evaluationOf(plugin)]);
    const data = { plugin: catalog.plugins.find((p) => p.plugin === plugin), evaluation };
    return { context: pluginContext(plugin, { ...data, ...justRead() }), data };
  },
  explore: PLUGIN_EXPLORE,
});

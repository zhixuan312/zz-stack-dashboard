/** One plugin's view tool, at `/plugins/[plugin]`, and its prepared query held to that plugin. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { PluginEval, PluginRow } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { pluginContext } from '../plugin-context';
import { justRead, segment } from './shared';
import { findings, scores, skillCalls } from './sources';

export const pluginTool = defineViewTool({
  name: 'plugin',
  title: 'Plugin',
  description: 'One plugin: what it ships and governs, how to install it, how much the active team used it, its public score, and its evaluation with its score by dimension, guardrails, findings and candidates for change.',
  needs: FEATURES.plugins.needs,
  page: '/plugins/[plugin]',
  input: z.object({ plugin: segment('The plugin\'s name.') }),
  async read({ plugin }) {
    await requireNeed(FEATURES.plugins.needs);
    const [list, evaluation] = await Promise.all([gatewayGet<{ plugins: PluginRow[] }>('/plugins'), gatewayGet<PluginEval>(`/plugins/${plugin}/eval`)]);
    const data = { plugin: list.plugins.find((p) => p.plugin === plugin), evaluation };
    return { context: pluginContext(plugin, { ...data, ...justRead() }), data };
  },
  explore: {
    sources: { skillCalls, findings, scores },
    fixed: async ({ plugin }) => {
      const one = [{ field: 'plugin', op: 'eq' as const, value: plugin }];
      return { skillCalls: one, findings: one, scores: one };
    },
  },
});

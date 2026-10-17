/** One skill's view tool, at `/plugins/[plugin]/[skill]`, and its prepared query held to that skill. */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { PluginRow, Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { skillContext } from '../skill-context';
import { justRead, segment } from './shared';
import { output, runs, skillCalls } from './sources';

export const skillTool = defineViewTool({
  name: 'skill',
  title: 'Skill',
  description: 'One skill a plugin ships: how the active team\'s runs of it went (runs, calls, duration, refusals and observed output, the response bytes of its calls), where it sits in the plugin\'s method, and what it is for.',
  needs: FEATURES.plugins.needs,
  page: '/plugins/[plugin]/[skill]',
  input: z.object({ plugin: segment('The plugin\'s name.'), skill: segment('The skill\'s name.') }),
  async read({ plugin, skill }) {
    await requireNeed(FEATURES.plugins.needs);
    const [plugins, skills, detail, text] = await Promise.all([
      gatewayGet<{ plugins: PluginRow[] }>('/plugins'),
      gatewayGet<{ skills: Skill[] }>(`/skills?plugin=${plugin}`),
      gatewayGet<SkillDetail>(`/skills/${skill}`),
      gatewayGet<SkillText>(`/plugins/${plugin}/skills/${skill}`),
    ]);
    const data = { plugin: plugins.plugins.find((p) => p.plugin === plugin), skill: skills.skills.find((s) => s.name === skill), detail, text };
    return { context: skillContext(plugin, skill, { ...data, ...justRead() }), data };
  },
  explore: {
    sources: { skillCalls, runs, output },
    fixed: async ({ plugin, skill }) => {
      const one = [{ field: 'skill', op: 'eq' as const, value: skill }];
      return { skillCalls: [...one, { field: 'plugin', op: 'eq', value: plugin }], runs: one, output: one };
    },
  },
});

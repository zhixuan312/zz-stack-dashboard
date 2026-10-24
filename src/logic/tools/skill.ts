/**
 * One skill's view tool, at `/plugins/[plugin]/[skill]`: the four reads its page makes, the skill's text
 * (`GET /plugins/:plugin/skills/:skill`, spec version 8's route for it) with the catalog, the team's runs and the
 * skill's calls by door beside it, told through the page's context.
 */
import { z } from 'zod';
import { requireNeed } from '@/data/access';
import { FEATURES } from '@/data/features';
import { gatewayGet } from '@/data/gateway';
import type { Skill, SkillDetail, SkillText } from '@/lib/api-shapes';
import { defineViewTool } from '@/lib/shared-context';
import { PLUGINS_PATH, type Catalog } from '../plugins-context';
import { SKILL_EXPLORE } from '../plugins-explore';
import { skillContext, skillDetailPath, skillTextPath, skillsPath } from '../skill-context';
import { justRead, segment } from './shared';

export const skillTool = defineViewTool({
  name: 'skill',
  title: 'Skill',
  description: 'One skill a plugin ships: how the active team\'s runs of it went (runs, calls, duration, refusals and observed output, the response bytes of its calls), where it sits in the plugin\'s method, and what it is for.',
  needs: FEATURES.plugins.needs,
  page: '/plugins/[plugin]/[skill]',
  input: z.object({ plugin: segment('The plugin\'s name.'), skill: segment('The skill\'s name.') }),
  async read({ plugin, skill }) {
    await requireNeed(FEATURES.plugins.needs);
    const [catalog, skills, detail, text] = await Promise.all([
      gatewayGet<Catalog>(PLUGINS_PATH),
      gatewayGet<{ skills: Skill[] }>(skillsPath(plugin)),
      gatewayGet<SkillDetail>(skillDetailPath(skill)),
      gatewayGet<SkillText>(skillTextPath(plugin, skill)),
    ]);
    const data = { plugin: catalog.plugins.find((p) => p.plugin === plugin), skill: skills.skills.find((s) => s.name === skill), detail, text };
    return { context: skillContext(plugin, skill, { ...data, ...justRead() }), data };
  },
  explore: SKILL_EXPLORE,
});

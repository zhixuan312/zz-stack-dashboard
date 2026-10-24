/**
 * The plugin pages' prepared queries: what an agent on Plugins, on one plugin or on one skill may count, group and
 * compare. Every source is one the pages' own reads stand on, declared once in `./tools/sources`.
 *
 * On the list, `explore_plugins` counts the active team's calls of each shipped skill over Work's `/work/query`, by
 * plugin or by skill, over any window. On a plugin's page, `explore_plugin` counts that plugin's skill calls, its
 * findings and its established scores, every call held to the plugin the page shows; the findings and the scores are
 * Platform's `/platform/query`, in the form the caller reads them. On a skill's page, `explore_skill` counts that
 * skill's calls, runs and observed output, every call held to the skill. None of them starts, or can start, an
 * evaluation: they read what was recorded.
 */
import type { PreparedQuery } from '@/lib/explore';
import { findings, output, runs, scores, skillCalls } from './tools/sources';

export const PLUGINS_EXPLORE: PreparedQuery = { sources: { skillCalls } };

export const PLUGIN_EXPLORE: PreparedQuery<{ plugin: string }> = {
  sources: { skillCalls, findings, scores },
  fixed: async ({ plugin }) => {
    const one = [{ field: 'plugin', op: 'eq' as const, value: plugin }];
    return { skillCalls: one, findings: one, scores: one };
  },
};

export const SKILL_EXPLORE: PreparedQuery<{ plugin: string; skill: string }> = {
  sources: { skillCalls, runs, output },
  fixed: async ({ plugin, skill }) => {
    const one = [{ field: 'skill', op: 'eq' as const, value: skill }];
    return { skillCalls: [...one, { field: 'plugin', op: 'eq', value: plugin }], runs: one, output: one };
  },
};

/**
 * Every view's tool, in one list (decision 0011): the console's assistant offers each as a read-only `view_<name>`
 * tool, so it can open another period, filter or record without the person navigating, and the page the person is on
 * as its prepared query, `explore_<view>`. Server only: each read is a gateway read made as the person asking
 * (`src/data/gateway.ts`), and each builds its context with the same function its page does, so the model's figures and
 * the screen's are one.
 *
 * One module a view under `src/views/tools/`, each with its `page` and its prepared query beside it. Where two views
 * share a page, the first is the one its page offers: Search declares Knowledge's, after Knowledge.
 */
import type { ViewTool } from '@/lib/shared-context';
import { activityTool } from './tools/activity';
import { documentTool } from './tools/document';
import { homeTool } from './tools/home';
import { initiativeTool } from './tools/initiative';
import { initiativesTool } from './tools/initiatives';
import { knowledgeTool } from './tools/knowledge';
import { knowledgeLogTool } from './tools/knowledge-log';
import { knowledgeNodeTool } from './tools/knowledge-node';
import { peopleTool } from './tools/people';
import { platformStatusTool } from './tools/platform-status';
import { pluginTool } from './tools/plugin';
import { pluginsTool } from './tools/plugins';
import { recordTool } from './tools/record';
import { releaseTool, releasesTool } from './tools/releases';
import { runsTool } from './tools/runs';
import { searchTool } from './tools/search';
import { settingsTool } from './tools/settings';
import { skillTool } from './tools/skill';
import { teamTool } from './tools/team';
import { teamsTool } from './tools/teams';

export const viewTools: ViewTool[] = [
  homeTool, recordTool, teamsTool, teamTool, initiativesTool, initiativeTool, documentTool, knowledgeTool, knowledgeNodeTool,
  knowledgeLogTool, searchTool, peopleTool, pluginsTool, pluginTool, skillTool, runsTool, activityTool, settingsTool,
  platformStatusTool, releasesTool, releaseTool,
] as ViewTool[];

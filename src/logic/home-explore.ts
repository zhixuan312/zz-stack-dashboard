/**
 * What an agent may count, group and compare on Home (`explore_home`): Work's own measures over `/work/query`, the five
 * Home's figures are made of. Closures and openings are the team's work, words what its documents' and lessons'
 * revisions added, approvals the caller's own, and runs the team's agents'. Its README lists the questions it answers.
 */
import type { PreparedQuery } from '@/lib/explore';
import { approvals, closures, opened, runs, words } from './tools/sources';

export const HOME_EXPLORE: PreparedQuery = { sources: { closures, opened, words, approvals, runs } };

/**
 * What an agent may count, group and compare on Record (`explore_record`): Work's own measures over `/work/query`, the
 * five its slices are made of. Closures are the team's work, words what its documents' and lessons' revisions added,
 * approvals the caller's own, lessons those the team made outside an import, and runs the team's agents'. Its README
 * lists the questions it answers.
 */
import type { PreparedQuery } from '@/lib/explore';
import { approvals, closures, lessons, runs, words } from './tools/sources';

export const RECORD_EXPLORE: PreparedQuery = { sources: { closures, words, approvals, lessons, runs } };

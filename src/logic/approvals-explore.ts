/**
 * What an agent may count, group and compare on Approvals (`explore_approvals`): the approvals recorded in the caller's
 * own name for the active team, over Work's `/work/query`, by where each revision was shown and the basis it was decided
 * on, as the gateway classified them, and by initiative. What waits for a decision is no approval and is not counted
 * here; its count is the page's own. Its README lists the questions it answers.
 */
import type { PreparedQuery } from '@/lib/explore';
import { approvals } from './tools/sources';

export const APPROVALS_EXPLORE: PreparedQuery = { sources: { approvals } };

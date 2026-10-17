import { useConsole } from '@/lib/api';
import type { Approvals } from '@/lib/work-shapes';

/** The most of the queue the bell lists: the route's own page ceiling. */
const BELL_ROWS = 100;

/** Approvals' Waiting as the bell reads it: the active team's revisions presented and not yet approved, oldest first.
 *
 *  DELIBERATE: Approvals' own answer, the one pending rule, rather than a projection of the bell's own. The bell is
 *  inside the console frame, which wraps every route, so it asks for one page of the waiting list and nothing of the
 *  history it does not draw.
 *
 *  In a module of its own: the frame imports this hook, and a bundle carries a module whole, so it carries no table,
 *  badge or column of the pages that list approvals. */
export function useWaitingApprovals(enabled = true) {
  return useConsole<Approvals>(enabled ? `/approvals?tab=waiting&limit=${BELL_ROWS}` : null);
}

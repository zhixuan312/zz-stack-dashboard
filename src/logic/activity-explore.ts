/**
 * Activity's prepared query, `explore_activity`: the active team's real-work calls and its refusals, each over Work's
 * `/work/query` (`src/data/prepared.ts`). The calls by tool, initiative and whether each was refused; the refusals by
 * their four owners, by tool and by initiative, a day, a week or a month at a time, down to the events with their page.
 * Its README lists the questions it answers.
 */
import type { PreparedQuery } from '@/lib/explore';
import { calls, refusals } from './tools/sources';

export const ACTIVITY_EXPLORE: PreparedQuery = { sources: { calls, refusals } };

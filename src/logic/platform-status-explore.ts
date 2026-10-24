/**
 * Status's prepared query, `explore_platform_status`: the platform's real-work calls, its refusals by owner and its
 * malformed calls, each over `/platform/query` as Status counts them, with the rate per 1,000 a `ratio` of the malformed
 * calls over the calls of the same window. A member's calls have no team split, as the page draws none.
 *
 * The calls are the source `calls`, because the rate names its base as `calls.calls`.
 */
import type { PreparedQuery } from '@/lib/explore';
import { malformed, platformCalls, platformRefusals } from './tools/sources';

export const platformStatusExplore: PreparedQuery = {
  sources: { malformed, calls: platformCalls(false), refusals: platformRefusals },
};

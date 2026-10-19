/**
 * Bugs' prepared query, `explore_bugs`, and a report's page's, `explore_bug`: the reports filed and the reports resolved,
 * each over `/platform/query` in the form the caller reads them, with reports per 1,000 calls a `ratio` of the reports
 * filed over the calls of the same window. The calls are the source `calls`, because the rate names its base as
 * `calls.calls`; a member's calls have no team split, as the page draws none.
 *
 * A drilled report is the address the gateway hands back, the queue for everyone: a member's row is the safe one, a
 * title built from its impact, surface and filed day, and only the superadmin opens a report's own page from the queue. A report's page
 * asks the same questions as the queue and holds nothing to its own id: the route has no dimension of one.
 */
import type { PreparedQuery, Source } from '@/lib/explore';
import { BUG_IMPACTS, BUG_STATES } from './platform-bugs-context';
import { platformCalls } from './tools/sources';

const DAYS = ['day', 'week', 'month', 'weekday'] as const;
const eq = { ops: ['eq'] as ['eq'] };
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';
const CHOICE = 'A report is filed by choice: a count of reports is not a count of distinct defects, and fewer is not better.';
const FORM = 'As the queue answers the caller: a member reads each report by a title built from its impact, surface and filed day, never its own words or its team.';

const filed: Source = {
  collection: 'bugs_filed', date: 'at',
  filters: { impact: { ...eq, values: BUG_IMPACTS }, state: { ...eq, values: BUG_STATES }, surface: eq },
  facets: ['impact', 'state', 'surface'], buckets: [...DAYS],
  measures: {
    filed: { label: 'Reports filed', unit: 'reports', definition: 'Real bug reports filed in the window, open or resolved.', agg: 'count' },
    per1000: { label: 'Reports per 1,000 calls', unit: 'per 1,000 calls', definition: 'Reports filed for each 1,000 real-work tool calls in the same window.', derive: 'ratio', of: ['filed', 'calls.calls'], scale: 0.001 },
  },
  drill: { columns: ['id', 'title', 'impact', 'surface', 'status', 'filedAt', 'resolvedAt'], address: (r) => String(r.address) },
  none: { surface: 'no surface named' },
  labels: { impact: { blocks_work: 'blocks work', wrong_result: 'wrong result', confusing: 'confusing', cosmetic: 'cosmetic' } },
  cannot: `${CHOICE} ${FORM} ${WINDOW}`,
};

const resolved: Source = {
  collection: 'bugs_resolved', date: 'at',
  filters: { outcome: { ...eq, values: ['fixed', 'not_a_bug', 'duplicate'] }, impact: { ...eq, values: BUG_IMPACTS } },
  facets: ['outcome', 'impact'], buckets: [...DAYS],
  measures: { resolved: { label: 'Reports resolved', unit: 'reports', definition: 'Real bug reports since resolved, dated by the day each was filed, not the day it was resolved.', agg: 'count' } },
  drill: { columns: ['id', 'title', 'outcome', 'impact', 'surface', 'filedAt', 'resolvedAt'], address: (r) => String(r.address) },
  labels: { outcome: { fixed: 'fixed', not_a_bug: 'not a bug', duplicate: 'duplicate' } },
  cannot: `A window holds the reports filed in it that are resolved now, whenever each was resolved. ${CHOICE} ${FORM} ${WINDOW}`,
};

export const bugsExplore: PreparedQuery = { sources: { filed, resolved, calls: platformCalls(false) } };

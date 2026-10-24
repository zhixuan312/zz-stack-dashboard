/**
 * Releases' prepared query, `explore_releases`, and a release's page's, `explore_release`: the releases recorded, the
 * migrations applied and the malformed calls, each over `/platform/query` as Releases counts them, with the rate per
 * 1,000 a `ratio` of the malformed calls over the calls of the same window. The calls are the source `calls`, because
 * the rate names its base as `calls.calls`; a member's calls have no team split, as the page draws none.
 *
 * A drilled release is its own page. The route has no dimension of a release's version, so a release's page asks the
 * same questions as the list and holds nothing to its own version: its windows are on the page and in its context.
 */
import type { PreparedQuery, Source } from '@/lib/explore';
import { releasePath } from './platform-releases-context';
import { malformed, platformCalls } from './tools/sources';

const DAYS = ['day', 'week', 'month', 'weekday'] as const;
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';

const releases: Source = {
  collection: 'releases', date: 'at', filters: {}, facets: [], buckets: [...DAYS],
  measures: { releases: { label: 'Releases', unit: 'releases', definition: 'Releases recorded in the window, each at the time its tag was made.', agg: 'count' } },
  drill: { columns: ['version', 'releasedAt', 'summary', 'clientAction', 'consoleVersion'], address: (r) => releasePath(String(r.version)) },
  cannot: `A release's time is when its tag was made, not when it reached a deployment. A count of releases says nothing of what any of them did. ${WINDOW}`,
};

const migrations: Source = {
  collection: 'migrations', date: 'at', filters: {}, facets: [], buckets: [...DAYS],
  measures: { migrations: { label: 'Migrations applied', unit: 'migrations', definition: 'Migrations the platform\'s database records as applied in the window.', agg: 'count' } },
  drill: { columns: ['at', 'migrations'], address: () => '/platform/releases' },
  cannot: `Migrations are counted, never listed: Releases (/platform/releases) counts them and lists none. ${WINDOW}`,
};

export const releasesExplore: PreparedQuery = { sources: { releases, migrations, malformed, calls: platformCalls(false) } };

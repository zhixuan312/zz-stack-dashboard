/**
 * Teams' prepared queries: what an agent on `/platform/teams` or on one team's page may count, group and compare.
 *
 * On the list, `explore_teams` counts the teams by status, a stock, and the platform's real-work calls by team over any
 * window, each team's own calls beside its own past. On a team's page, `explore_team` counts that team's calls alone,
 * every call held to the team the page shows. Both are the superadmin's, as both pages are; the gateway refuses anybody
 * else the teams and the split of calls by team.
 */
import type { PreparedQuery, Source } from '@/lib/explore';
import { platformCalls } from './tools/sources';

/** The teams, a stock counted as of a window's last day, each drilled row the team's page. */
const teams: Source = {
  collection: 'teams', date: 'at',
  filters: { status: { ops: ['eq'], values: ['active', 'archived'] } }, facets: ['status'],
  measures: { teams: { label: 'Teams', unit: 'teams', definition: 'Every team made by the window\'s last day, as it stands now.', agg: 'count' } },
  drill: { columns: ['slug', 'name', 'status', 'created', 'people'], address: (r) => `/platform/teams/${String(r.slug)}` },
  cannot: 'Teams are a stock: a window\'s start changes nothing. A team is set beside its own past, never ranked against another. A window holds complete days of the reporting time zone, so today is in none.',
};

export const teamsExplore: PreparedQuery = { sources: { teams, calls: platformCalls(true) } };

export const teamExplore: PreparedQuery<{ slug: string }> = {
  sources: { calls: platformCalls(false) },
  fixed: async ({ slug }) => ({ calls: [{ field: 'team', op: 'eq', value: slug }] }),
};

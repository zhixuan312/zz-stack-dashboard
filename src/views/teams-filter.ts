/**
 * The Teams list's filters and page, and the one gateway address they are read at. The gateway filters and pages the
 * list, so the page's first read on the console's server, the page's later reads in the browser, its shared context and
 * `view_teams` all ask this module for the address, and none of them filters a page of rows itself.
 */

/** The statuses the route filters by, in the order a filter lists them. */
export const TEAM_STATUSES = ['active', 'archived'] as const;

/** The rows one page of the list holds, as the Records template pages. */
export const PAGE_SIZE = 10;

/** The filters and the page the Teams list keeps in its address; `all` is no status filter, `1` the first page. */
export type TeamsFilters = { q: string; status: string; page: string };

/** The address with nothing in it: every team, the first page. */
export const TEAMS_DEFAULTS: TeamsFilters = { q: '', status: 'all', page: '1' };

/** The page asked for, from 1, whatever the address holds. */
export const pageOf = (f: TeamsFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/**
 * The gateway address of the list for `f`: the ten rows of its page unless `rows` names others, as `view_teams` may by
 * the route's own `limit` and `offset`.
 */
export function teamsPath(f: TeamsFilters, rows: TeamsRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if ((TEAM_STATUSES as readonly string[]).includes(f.status)) p.set('status', f.status);
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/teams?${p}`;
}

/** Rows of the list by the route's own arguments: `limit` of them from `offset`. */
export type TeamsRows = { limit: number; offset: number };

/** The page's address for rows read from `offset`: every team, on the page of ten the offset falls in. */
export const pageAt = (offset: number): TeamsFilters => ({ ...TEAMS_DEFAULTS, page: String(Math.floor(offset / PAGE_SIZE) + 1) });

/** The list's address read back from a gateway path `teamsPath` wrote: its filters, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): TeamsFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { ...pageAt(Math.max(0, Number(q.get('offset')) || 0)), q: q.get('q') ?? '', status: q.get('status') ?? 'all' };
}

/** Whether any filter narrows the list. */
export const narrowed = (f: TeamsFilters): boolean => f.q.trim() !== '' || f.status !== 'all';

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): TeamsFilters {
  const one = (k: keyof TeamsFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? TEAMS_DEFAULTS[k];
  };
  return { q: one('q'), status: one('status'), page: one('page') };
}

/**
 * The People list's filters and page, and the one gateway address they are read at. The gateway filters and pages the
 * list, so the page's first read on the console's server, the page's later reads in the browser, its shared context and
 * `view_people` all ask this module for the address, and none of them filters a page of rows itself.
 */

/** The states the route filters by, in the order a filter lists them. */
export const PERSON_STATES = ['active', 'deactivated'] as const;

/** The rows one page of the list holds, as the Records template pages. */
export const PAGE_SIZE = 10;

/** The filters and the page the People list keeps in its address; `all` is no state filter, `1` the first page. */
export type PeopleFilters = { q: string; state: string; page: string };

/** The address with nothing in it: everybody, the first page. */
export const PEOPLE_DEFAULTS: PeopleFilters = { q: '', state: 'all', page: '1' };

/** The page asked for, from 1, whatever the address holds. */
export const pageOf = (f: PeopleFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** Rows of the list by the route's own arguments: `limit` of them from `offset`. */
export type PeopleRows = { limit: number; offset: number };

/**
 * The gateway address of the list for `f`: the ten rows of its page unless `rows` names others, as `view_people` may by
 * the route's own `limit` and `offset`.
 */
export function peoplePath(f: PeopleFilters, rows: PeopleRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if ((PERSON_STATES as readonly string[]).includes(f.state)) p.set('state', f.state);
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/people?${p}`;
}

/** The page's address for rows read from `offset`: everybody, on the page of ten the offset falls in. */
export const pageAt = (offset: number): PeopleFilters => ({ ...PEOPLE_DEFAULTS, page: String(Math.floor(offset / PAGE_SIZE) + 1) });

/** The list's address read back from a gateway path `peoplePath` wrote: its filters, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): PeopleFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { ...pageAt(Math.max(0, Number(q.get('offset')) || 0)), q: q.get('q') ?? '', state: q.get('state') ?? 'all' };
}

/** Whether any filter narrows the list. */
export const narrowed = (f: PeopleFilters): boolean => f.q.trim() !== '' || f.state !== 'all';

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): PeopleFilters {
  const one = (k: keyof PeopleFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? PEOPLE_DEFAULTS[k];
  };
  return { q: one('q'), state: one('state'), page: one('page') };
}

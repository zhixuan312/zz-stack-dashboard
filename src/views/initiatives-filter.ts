/**
 * The Initiatives list's filters and page, and the one gateway address they are read at. The server filters and pages
 * the list, so the page's first read on the console's server, the page's later reads in the browser, its shared context
 * and `view_initiatives` all ask this module for the address, and none of them filters a page of rows itself.
 */
import type { InitiativeRow } from '@/lib/work-shapes';

/** The states the route filters by, in the order a filter lists them. */
export const LIST_STATES = ['open', 'waiting', 'quiet', 'accepted', 'delivered', 'abandoned'] as const satisfies readonly InitiativeRow['state'][];

/** How each state reads on screen, on the list and on the initiative's own page alike. */
export const STATE_LABEL: Record<InitiativeRow['state'], string> = {
  open: 'Open', waiting: 'Waiting', quiet: 'Quiet', accepted: 'Accepted', delivered: 'Delivered', abandoned: 'Abandoned',
};

/** What the state words mean, where a reader is told. */
export const STATE_DEFINITION = 'Waiting: a revision of it waits for a person\'s approval. Quiet: open, and nothing of it written for 14 days or more. Open otherwise. Closed, it is its outcome.';

/** The rows one page of the list holds, as the Records template pages. */
export const PAGE_SIZE = 10;

/** The filters and the page the Initiatives list keeps in its address; `all` is no filter, `1` the first page. */
export type InitiativesFilters = { q: string; state: string; flow: string; page: string };

/** The address with nothing in it: every initiative, the first page. */
export const INITIATIVES_DEFAULTS: InitiativesFilters = { q: '', state: 'all', flow: 'all', page: '1' };

/** The page asked for, from 1, whatever the address holds. */
export const pageOf = (f: Pick<InitiativesFilters, 'page'>): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** Rows of the list by the route's own arguments: `limit` of them from `offset`. */
export type InitiativesRows = { limit: number; offset: number };

/**
 * The gateway address of the list for `f`: the ten rows of its page unless `rows` names others, as `view_initiatives`
 * may by the route's own `limit` and `offset`.
 */
export function listPath(f: InitiativesFilters, rows: InitiativesRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams();
  if (f.state !== 'all') p.set('state', f.state);
  if (f.flow !== 'all') p.set('flow', f.flow);
  if (f.q.trim()) p.set('q', f.q.trim());
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/initiatives?${p}`;
}

/** The page of ten `offset` falls in, from 1. */
export const pageAt = (offset: number): string => String(Math.floor(offset / PAGE_SIZE) + 1);

/** The list's address read back from a gateway path `listPath` wrote: its filters, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): InitiativesFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { q: q.get('q') ?? '', state: q.get('state') ?? 'all', flow: q.get('flow') ?? 'all', page: pageAt(Math.max(0, Number(q.get('offset')) || 0)) };
}

/** Whether any filter narrows the list. */
export const narrowed = (f: Pick<InitiativesFilters, 'q' | 'state' | 'flow'>) => f.q.trim() !== '' || f.state !== 'all' || f.flow !== 'all';

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): InitiativesFilters {
  const one = (k: keyof InitiativesFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? INITIATIVES_DEFAULTS[k];
  };
  return { q: one('q'), state: one('state'), flow: one('flow'), page: one('page') };
}

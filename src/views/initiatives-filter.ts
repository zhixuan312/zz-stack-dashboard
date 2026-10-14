/**
 * The Initiatives list's filters and page, and the one gateway address they are read at. The server filters and pages
 * the list, so the page, its shared context, the `view_initiatives` tool and the `initiatives` collection all ask this
 * function for the address and none of them filters a page of rows itself.
 */
import type { InitiativeRow } from '@/lib/work-shapes';

/** The states the route filters by, in the order a filter lists them. */
export const LIST_STATES = ['open', 'waiting', 'quiet', 'accepted', 'delivered', 'abandoned'] as const satisfies readonly InitiativeRow['state'][];

/** How each state reads on screen. */
export const STATE_LABEL: Record<InitiativeRow['state'], string> = {
  open: 'Open', waiting: 'Waiting', quiet: 'Quiet', accepted: 'Accepted', delivered: 'Delivered', abandoned: 'Abandoned',
};

/** The rows one page of the list holds, as the Records template pages. */
export const PAGE_SIZE = 10;

/** The filters the Initiatives list keeps in its address; `all` is no filter. */
export type InitiativesFilters = { q: string; state: string; flow: string };

/** The gateway address of the list for `f`, `limit` rows from `offset`: one page of 10 from the first unless asked. */
export function listPath(f: InitiativesFilters, { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams();
  if (f.state !== 'all') p.set('state', f.state);
  if (f.flow !== 'all') p.set('flow', f.flow);
  if (f.q.trim()) p.set('q', f.q.trim());
  p.set('limit', String(limit));
  p.set('offset', String(offset));
  return `/initiatives?${p}`;
}

/** Where `page` (from 1) of the list starts. */
export const offsetOf = (page: number) => (Math.max(1, page) - 1) * PAGE_SIZE;

/** Whether any filter narrows the list. */
export const narrowed = (f: InitiativesFilters) => f.q.trim() !== '' || f.state !== 'all' || f.flow !== 'all';

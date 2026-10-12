/** The Initiatives list's window and filter, shared by the page that draws the rows and the context that describes them. */
import { initiativeState, waitingOnYou } from '@/console/initiative-state';
import type { Initiative } from '@/lib/api-shapes';
import { periodCutoff, type Period } from '@/lib/period';

/** The filters the Initiatives list keeps in its address. */
export type InitiativesFilters = { q: string; team: string; flow: string; state: string; show: string };

/** The initiatives last touched inside the period: the window says which the page is about at all. */
export function inPeriod(all: Initiative[], period: Period, now: Date = new Date()): Initiative[] {
  const since = periodCutoff(period, now);
  return since ? all.filter((i) => new Date(i.updated) >= since) : all;
}

/** The rows the list shows for `f`, within the window: the page's own filter. */
export function filterInitiatives(inWindow: Initiative[], f: InitiativesFilters): Initiative[] {
  const needle = f.q.trim().toLowerCase();
  return inWindow.filter((i) =>
    (!needle || i.slug.toLowerCase().includes(needle) || i.team.includes(needle) || (i.flow ?? '').includes(needle))
    && (f.team === 'all' || i.team === f.team)
    && (f.flow === 'all' || (i.flow ?? 'No flow') === f.flow)
    && (f.state === 'all' || initiativeState(i) === f.state)
    && (f.show === 'all' || waitingOnYou(i)));
}

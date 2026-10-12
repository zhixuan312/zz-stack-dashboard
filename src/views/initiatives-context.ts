/**
 * The Initiatives list's shared context (decision 0011): what the page and the assistant are both told about where
 * each piece of work is in its flow and what waits on a person.
 */
import { INITIATIVE_STATES, initiativeState, waitingGates, waitingOnYou } from '@/console/initiative-state';
import type { Initiative } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { PERIOD_LABEL, periodCutoff, type Period } from '@/lib/period';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, whose, type Arrival, type ViewMode } from './context';

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

/** An initiative as a list names it: its team and its slug, a very long slug cut. */
const named = (i: { team: string; slug: string }) => `${i.team}/${clip(i.slug)}`;

export function initiativesContext(all: Initiative[], { filters, period, mode, ...arrival }: { filters: InitiativesFilters; period: Period; mode: ViewMode } & Arrival): SharedContext {
  const inWindow = inPeriod(all, period, new Date(arrival.now));
  const rows = filterInitiatives(inWindow, filters);
  const narrowed = Object.entries(filters).some(([k, v]) => (k === 'q' ? v !== '' : v !== 'all'));
  const byState = INITIATIVE_STATES.map((s) => [s, rows.filter((i) => initiativeState(i) === s).length] as const).filter(([, n]) => n);
  const waiting = rows.filter(waitingOnYou);
  const open = rows.filter((i) => !i.closed);
  const insights: Insight[] = [];
  if (byState.length) insights.push({ text: `By state: ${byState.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ')}.` });
  if (waiting.length) insights.push({ text: `Waiting on a person: ${listed(waiting, (i) => `${named(i)} (${waitingGates(i).join(', ')})`, 'show Waiting on you on /initiatives', 12)}.`, evidence: '/initiatives?show=waiting' });
  const corrected = waiting.filter((i) => i.closed);
  if (corrected.length) insights.push({ text: `${corrected.length} of those ${corrected.length === 1 ? 'is' : 'are'} already closed: ${listed(corrected, named, 'see /initiatives?show=waiting', 8)}. A closing document changed after the close and awaits approval again, so the State column still reads the outcome while the initiative is listed as waiting.` });
  const stalest = open.reduce<Initiative | null>((a, i) => (!a || i.updated < a.updated ? i : a), null);
  if (stalest && open.length > 1) insights.push({ text: `The open initiative untouched longest is ${named(stalest)}, last touched ${formatDate(stalest.updated)}${stalest.of ? ` at stage ${stalest.at} of ${stalest.of}${stalest.stage ? ` (${stalest.stage})` : ''}` : ', with no flow declared'}.`, evidence: `/initiatives/${stalest.team}/${stalest.slug}` });
  const flows = [...new Set(rows.map((i) => i.flow ?? 'No flow'))].map((f) => `${f} ${rows.filter((i) => (i.flow ?? 'No flow') === f).length}`);
  if (flows.length > 1) insights.push({ text: `By flow: ${flows.join(', ')}.` });
  if (rows.length) insights.push({ text: `The initiatives listed: ${listed(rows, (i) => `${named(i)} (${initiativeState(i)}${i.of ? `, stage ${i.at} of ${i.of}` : ''})`, 'filter or search on /initiatives', 12)}.` });
  const said = [filters.team !== 'all' ? `team ${filters.team}` : '', filters.flow !== 'all' ? `flow ${filters.flow}` : '', filters.state !== 'all' ? `state ${filters.state}` : '', filters.show !== 'all' ? 'waiting on you only' : '', filters.q ? `matching "${filters.q}"` : ''].filter(Boolean);
  return budgeted({
    view: 'initiatives',
    title: 'Initiatives',
    address: addressOf('/initiatives', { period, ...filters }, { period: 'all', team: 'all', flow: 'all', state: 'all', show: 'all' }),
    scope: `${period === 'all' ? 'all time' : `last touched in the ${PERIOD_LABEL[period].toLowerCase()}`}, ${whose(mode)}${said.length ? `; filtered to ${said.join(', ')}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Initiatives', value: `${formatCount(rows.length)}${narrowed ? ` of ${formatCount(inWindow.length)}` : ''}`, definition: 'Pieces of work, open or closed. An initiative starts with initiative_open, and every document written afterwards lands under it.' },
      { label: 'Open', value: formatCount(open.length), definition: 'No outcome recorded yet.' },
      { label: 'Waiting on you', value: formatCount(waiting.length), definition: 'A gate document is written and nobody has approved it, a closed initiative\'s corrected closing document among them. A gate nobody has drafted waits on the agent, not on a person.' },
      { label: 'Closed', value: formatCount(rows.length - open.length), definition: 'Closed as accepted, delivered or abandoned; close() records exactly one.' },
    ],
    insights,
    unknowns: [
      ...(period === 'all' ? [] : ['The period windows on when an initiative was last touched, not on when it was opened.']),
      ...(rows.length ? [] : [narrowed || inWindow.length < all.length ? 'No initiative matches this period and these filters.' : 'No initiative has been opened yet.']),
    ],
  });
}

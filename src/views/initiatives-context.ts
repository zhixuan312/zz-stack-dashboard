/**
 * The Initiatives list's shared context (decision 0011): what the page and the assistant are both told about the active
 * team's work, from the one `InitiativeList` the gateway answered. The rows are the page in view; the counts are the
 * summary the gateway computed over the whole filtered population, so a context never grows with the data and never
 * counts one page as if it were all of it.
 */
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import type { InitiativeList, InitiativeRow } from '@/lib/work-shapes';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';
import { LIST_STATES, PAGE_SIZE, STATE_LABEL, narrowed, type InitiativesFilters } from './initiatives-filter';

/** Where a row goes next, in the words zz-core's `next_move` answers. */
const move = (r: InitiativeRow): string => (r.nextMove ? `${r.nextMove.action}${r.nextMove.document ? ` ${r.nextMove.document}` : ''}` : 'unknown');
/** That, and who it waits on, as a row's flow position reads. */
export const nextOf = (r: InitiativeRow): string => (r.nextMove ? `${move(r)}${r.nextMove.waitingOn ? `, waiting on ${r.nextMove.waitingOn}` : ''}` : 'next move unavailable');

export function initiativesContext(list: InitiativeList, { filters, page, ...arrival }: { filters: InitiativesFilters; page: number } & Arrival): SharedContext {
  const summary = list.summary.state === 'ok' ? list.summary.data : null;
  const first = (page - 1) * PAGE_SIZE;
  const insights: Insight[] = [];
  if (summary) {
    const byState = LIST_STATES.filter((st) => summary.byState[st]).map((st) => `${summary.byState[st]} ${STATE_LABEL[st].toLowerCase()}`);
    if (byState.length) insights.push({ text: `By state: ${byState.join(', ')}.` });
  }
  if (list.rows.length) {
    insights.push({
      text: `Rows ${first + 1} to ${first + list.rows.length} of ${list.total}, waiting first: ${listed(list.rows, (r) => `${clip(r.slug)} (${STATE_LABEL[r.state].toLowerCase()}, ${r.gates.of ? `${r.gates.passed} of ${r.gates.of} gates` : 'no gates'}, touched ${formatDate(r.lastTouched)}; next: ${move(r)})`, 'page or filter on /initiatives', PAGE_SIZE)}.`,
      evidence: addressOf('/initiatives', { ...filters, page: String(page) }, { state: 'all', flow: 'all', page: '1' }),
    });
  }
  if (summary && summary.byFlow.length > 1) insights.push({ text: `By flow: ${summary.byFlow.map((f) => `${f.flow ?? 'no flow'} ${f.count}`).join(', ')}.` });
  const said = [filters.state !== 'all' ? `state ${filters.state}` : '', filters.flow !== 'all' ? `flow ${filters.flow}` : '', filters.q.trim() ? `matching "${filters.q.trim()}"` : ''].filter(Boolean);
  const closed = list.tiles.closed;
  return budgeted({
    view: 'initiatives',
    title: 'Initiatives',
    address: addressOf('/initiatives', { ...filters, page: String(page) }, { state: 'all', flow: 'all', page: '1' }),
    scope: `your active team's work${said.length ? `, filtered to ${said.join(', ')}` : ''}; page ${page} of ${Math.max(1, Math.ceil(list.total / PAGE_SIZE))}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Initiatives', value: formatCount(list.total), definition: narrowed(filters) ? 'All that these filters match, not this page.' : 'Every piece of work the team has opened.' },
      { label: 'Open', value: formatCount(list.tiles.open), definition: 'No outcome yet, the waiting and quiet among them; the whole team\'s.' },
      { label: 'Waiting', value: formatCount(list.tiles.waiting), definition: 'A revision presented and not yet approved.' },
      { label: 'Closed', value: formatCount(closed.accepted + closed.delivered + closed.abandoned), change: `${closed.accepted} accepted, ${closed.delivered} delivered, ${closed.abandoned} abandoned` },
    ],
    insights,
    unknowns: [
      'Work is your active team\'s alone; another team\'s initiatives are not in this list.',
      ...(summary ? [] : ['The counts by state and flow could not be read; the rows and the total stand.']),
      ...(list.nextMoveState === 'ok' ? [] : [list.nextMoveState === 'partial' ? 'zz-core did not answer for some rows, so their next move is unknown.' : 'zz-core did not answer, so no row\'s next move is known.']),
      ...(list.rows.length ? [] : [narrowed(filters) ? 'No initiative matches these filters.' : page > 1 ? 'This page is past the last initiative.' : 'No initiative has been opened yet.']),
    ],
  });
}

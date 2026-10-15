/**
 * The Knowledge shelf's shared context (decision 0011): what the page and the assistant are both told about what the
 * active team's earlier initiatives settled, from the `KnowledgeSummary` and the one page of `KnowledgeList` the gateway
 * answered. The counts are the gateway's over the whole shelf and the whole filtered population, so a context never
 * counts one page as if it were all of it; and the shelf, its filters and its page are read at one address, built here,
 * which the page, `view_knowledge` and the `knowledge` collection all ask for.
 */
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** The kinds a lesson may be, as the store's own check allows them; the shelf filters by one of them. */
export const KNOWLEDGE_KINDS = ['decision', 'design', 'process', 'knowledge', 'behavior', 'style'] as const;

/** The rows one page of the shelf holds. */
export const PAGE_SIZE = 10;

/** The filters the shelf keeps in its address; `all` is no kind. */
type KnowledgeFilters = { q: string; kind: string };

/** The gateway address of the shelf for `f`, `limit` lessons from `offset`: one page of 10 from the first unless asked. */
export function knowledgePath(f: KnowledgeFilters, { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.kind !== 'all') p.set('kind', f.kind);
  p.set('limit', String(limit));
  p.set('offset', String(offset));
  return `/knowledge?${p}`;
}

/** Whether any filter narrows the shelf. */
export const narrowed = (f: KnowledgeFilters) => f.q.trim() !== '' || f.kind !== 'all';

const percent = (v: number | null) => (v === null ? 'no search' : `${Math.round(v)}%`);

export function knowledgeContext({ summary, list, filters, page, ...arrival }: { summary?: KnowledgeSummary; list: KnowledgeList; filters: KnowledgeFilters; page: number } & Arrival): SharedContext {
  const first = (page - 1) * PAGE_SIZE;
  const insights: Insight[] = [];
  const questions = summary?.questions.state === 'ok' ? summary.questions.data : null;
  if (questions?.rows.length) {
    insights.push({ text: `The team's own questions that found nothing, most asked first (${formatCount(questions.total)} in all): ${listed(questions.rows, (q) => `"${clip(q.question, 80)}" ${q.asked}×, last ${formatDate(q.lastAsked)}`, 'see /knowledge', 5)}.` });
  }
  if (list.rows.length) {
    insights.push({
      text: `Lessons ${first + 1} to ${first + list.rows.length} of ${list.total}, newest first: ${listed(list.rows, (n) => `${n.num} ${clip(n.title, 48)} (${n.type}, ${n.status})`, 'page or filter on /knowledge', PAGE_SIZE)}.`,
      evidence: addressOf('/knowledge', { ...filters, page: String(page) }, { kind: 'all', page: '1' }),
    });
  }
  const kinds = Object.entries(list.summary.byKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (kinds.length) insights.push({ text: `By kind: ${kinds.map(([k, n]) => `${k} ${n}`).join(', ')}.` });
  // The last four weeks: the running one, and three whole ones to read it against.
  const weeks = summary?.weeks.state === 'ok' ? summary.weeks.data.slice(-4) : [];
  if (weeks.length) insights.push({ text: `Searches with results by week: ${weeks.map((w) => `${formatDate(w.window.from)} ${percent(w.figure.value)}${w.denominator ? ` of ${w.denominator}` : ''}${w.window.complete ? '' : ' (running)'}`).join(', ')}.` });
  const newest = summary?.newest.state === 'ok' ? summary.newest.data : [];
  if (newest.length) insights.push({ text: `The newest lessons: ${listed(newest, (n) => `${clip(n.title, 48)} (${n.kind}${n.imported ? ', imported' : ''}, ${formatDate(n.createdAt)})`, 'see /knowledge', 3)}.`, evidence: knowledgeNodeHref(newest[0].team, newest[0].path) });
  const said = [filters.kind !== 'all' ? `kind ${filters.kind}` : '', filters.q.trim() ? `matching "${filters.q.trim()}"` : ''].filter(Boolean);
  const tiles = summary?.tiles;
  return budgeted({
    view: 'knowledge',
    title: 'Knowledge',
    address: addressOf('/knowledge', { ...filters, page: String(page) }, { kind: 'all', page: '1' }),
    scope: `your active team's knowledge shelf${said.length ? `, filtered to ${said.join(', ')}` : ''}; page ${page} of ${Math.max(1, Math.ceil(list.total / PAGE_SIZE))}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Lessons', value: formatCount(list.total), definition: narrowed(filters) ? 'All that these filters match, not this page.' : 'Every lesson on the team\'s shelf, standing or superseded.' },
      ...(tiles ? [
        { label: 'Standing', value: formatCount(tiles.standing.value), change: `${formatCount(tiles.standing.imported)} imported`, definition: 'Lessons on the shelf now, as of the cutoff; an imported one was brought in rather than learned by an initiative.' },
        { label: 'Superseded', value: formatCount(tiles.superseded.value), definition: 'Replaced by a later lesson, and still readable.' },
        { label: 'Searches last week', value: formatCount(tiles.searches.figure.value), change: `${formatCount(tiles.noResult.figure.value)} found nothing`, definition: 'The team\'s searches in the last whole week, from the page, the assistant and MCP alike.' },
      ] : []),
    ],
    insights,
    unknowns: [
      'A search that found something found text to read, which is retrieval coverage: it says nothing about whether the question was answered.',
      'The platform\'s shared shelf is searched beside the team\'s, and is not on this list.',
      ...(summary ? [] : ['The shelf\'s standing, its searches and its questions could not be read; the lessons listed stand.']),
      ...(list.rows.length ? [] : [narrowed(filters) ? 'No lesson matches these filters.' : page > 1 ? 'This page is past the last lesson.' : 'Nothing is on the shelf yet.']),
    ],
  });
}

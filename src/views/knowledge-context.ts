/**
 * The Knowledge page's shared context (decision 0011): what the page and the assistant are both told about what the
 * active team's earlier initiatives settled and how its searches went, from the `KnowledgeSummary` the console's server
 * read, the page of `KnowledgeList` and the search answer the browser read. The counts are the gateway's over the whole
 * shelf and the whole filtered population, so a context never counts one page as if it were all of it; and the page,
 * `view_knowledge` and the `shelf` collection read the shelf at the one address built here.
 *
 * The page leads with the platform's ranked search, so the question the person searched and the results in view come
 * first; the team's own questions that found nothing, its searches by week and its newest lessons follow, and the
 * roster of the shelf's page is last, where the budget cuts first.
 */
import type { SearchAnswer, SearchHit } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import type { Figure } from '@/lib/platform-shapes';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** The kinds a lesson may be, as the store's own check allows them; the shelf filters by one of them. */
export const KNOWLEDGE_KINDS = ['decision', 'design', 'process', 'knowledge', 'behavior', 'style'] as const;

/** The rows one page of the shelf holds. */
export const PAGE_SIZE = 10;

/** The ranked results the page's search asks for: one table's ceiling, so the list needs no paging. */
const SEARCH_LIMIT = 10;

/** How long the console's server waits for a Knowledge page's first read before the page says it did not answer. */
export const KNOWLEDGE_BOUND_MS = 5_000;

/**
 * What the page keeps in its address: the question it searched, and the shelf's kind and page. `all` is no kind. The
 * question is the search's alone: the shelf beside the newest lessons is filtered by its kind and paged, never by it.
 */
type KnowledgeFilters = { q: string; kind: string };

/**
 * The shelf as `view_knowledge` reads it, by the route's own arguments (spec version 8's tool table): `q` is the
 * route's words in a lesson's title, tags or text, and the rows are `limit` from `offset`. The page has no words filter
 * and pages by ten, so a read with words, or rows off its pages, has no address on it that shows exactly them.
 */
type ShelfRead = { q: string; limit: number; offset: number };

/**
 * A Knowledge page's first read as the console's server made it, given `KNOWLEDGE_BOUND_MS`: the gateway's answer and
 * when it came, the gateway's sentence for a read that failed, or a read that did not answer in time. Knowledge's is
 * the summary, the log's its entries and a node's its body.
 */
export type ServerRead<T> =
  | { state: 'ok'; data: T; at: string }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** Why a first read is not on the page, in words: the gateway's sentence, or the bound it missed. */
export const troubleOf = (read: Exclude<ServerRead<unknown>, { state: 'ok' }>): string =>
  (read.state === 'slow' ? `It did not answer within ${KNOWLEDGE_BOUND_MS / 1000} seconds.` : read.reason);

/**
 * The gateway address of the shelf for `f`, `limit` lessons from `offset`: one page of 10 from the first unless asked.
 * `q` is the route's words filter, which only `view_knowledge` sends: the page never filters the shelf by words.
 */
export function knowledgePath(f: { q?: string; kind: string }, { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.kind !== 'all') p.set('kind', f.kind);
  p.set('limit', String(limit));
  p.set('offset', String(offset));
  return `/knowledge?${p}`;
}

/** The gateway address of the platform's ranked search for `q`, as many results as one list shows. */
export const searchPath = (q: string, limit = SEARCH_LIMIT) => `/search?${new URLSearchParams({ q: q.trim(), limit: String(limit) })}`;

/** Whether a kind narrows the shelf. */
export const narrowed = (f: Pick<KnowledgeFilters, 'kind'>) => f.kind !== 'all';

/** A figure as the tiles write it: the count, or why there is none. A figure nobody read is never a zero. */
export const figureText = (f: Figure): string => (f.value !== null ? formatCount(f.value) : f.why === 'no_data' ? 'no data' : 'not measured');

/** Which shelf a result is on, in the words the page uses beside it. */
export const shelfOf = (hit: Pick<SearchHit, 'shelf'>): string => (hit.shelf === 'platform' ? 'the shared shelf' : 'your team\'s shelf');

const percent = (v: number | null) => (v === null ? 'no search' : `${Math.round(v)}%`);

/** The results in view, best first: what each is, where it stands and which shelf holds it, without its excerpt. */
function resultsInsight(search: SearchAnswer, address: string): Insight {
  if (!search.results.length) return { text: `The search for "${clip(search.query, 120)}" found nothing.${search.note ? ` ${search.note}` : ''}`, evidence: address };
  const say = (h: SearchHit) => `${h.kind === 'node' ? 'lesson' : 'document'} "${clip(h.title, 60)}" (${shelfOf(h)}${h.superseded_by ? `, superseded by ${h.kind === 'node' ? `node ${h.superseded_by}` : h.superseded_by}` : ''})`;
  return {
    text: `The search for "${clip(search.query, 120)}" ranked ${formatCount(search.ranked_total)}; in view, best first: ${listed(search.results, say, 'view_search reads each excerpt and address', SEARCH_LIMIT)}.`,
    evidence: address,
  };
}

export function knowledgeContext({ summary, list, filters, page, search, shelf, failure, ...arrival }: {
  summary?: KnowledgeSummary;
  list?: KnowledgeList;
  filters: KnowledgeFilters;
  page: number;
  /** The search answer for `filters.q`, when the person searched and it answered. */
  search?: SearchAnswer;
  /** How `view_knowledge` read the shelf, when it did; the page's own shelf is its kind and page. */
  shelf?: ShelfRead;
  /** Why the summary could not be read, when it could not. */
  failure?: string;
} & Arrival): SharedContext {
  const q = filters.q.trim();
  const address = addressOf('/knowledge', { q, kind: filters.kind, page: String(page) }, { kind: 'all', page: '1' });
  const first = shelf ? shelf.offset : (page - 1) * PAGE_SIZE;
  const words = shelf?.q.trim() ?? '';
  // Rows the page's address shows exactly: its own ten a page, by kind alone.
  const onPage = !shelf || (!words && shelf.limit === PAGE_SIZE && shelf.offset % PAGE_SIZE === 0);
  const insights: Insight[] = [];
  if (search) insights.push(resultsInsight(search, address));
  const questions = summary?.questions.state === 'ok' ? summary.questions.data : null;
  if (questions?.rows.length) {
    insights.push({ text: `The team's own questions that found nothing, most asked first (${formatCount(questions.total)} in all): ${listed(questions.rows, (x) => `"${clip(x.question, 80)}" ${x.asked}×, last ${formatDate(x.lastAsked)}`, 'see /knowledge', 4)}.` });
  }
  // The last four weeks: the running one, and three whole ones to read it against.
  const weeks = summary?.weeks.state === 'ok' ? summary.weeks.data.slice(-4) : [];
  if (weeks.length) insights.push({ text: `Searches with results by week: ${weeks.map((w) => `${formatDate(w.window.from)} ${percent(w.figure.value)}${w.denominator ? ` of ${w.denominator}` : ''}${w.window.complete ? '' : ' (running)'}`).join(', ')}.` });
  const newest = summary?.newest.state === 'ok' ? summary.newest.data : [];
  if (newest.length) insights.push({ text: `The newest lessons: ${listed(newest, (n) => `${clip(n.title, 48)} (${n.kind}${n.imported ? ', imported' : ''}, ${formatDate(n.createdAt)})`, 'see /knowledge', 3)}.`, evidence: knowledgeNodeHref(newest[0].team, newest[0].path) });
  const kinds = list ? Object.entries(list.summary.byKind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : [];
  if (kinds.length) insights.push({ text: `By kind: ${kinds.map(([k, n]) => `${k} ${n}`).join(', ')}.` });
  if (list?.rows.length) {
    insights.push({
      // Each row's kind is in the count by kind above, and a row's standing is said only where it is not the usual one.
      text: `Lessons ${first + 1} to ${first + list.rows.length} of ${list.total}, newest first: ${listed(list.rows, (n) => `${n.num} ${clip(n.title, 44)}${n.status === 'adopted' ? '' : ` (${n.status})`}`, 'page or filter on /knowledge', PAGE_SIZE)}.`,
      evidence: address,
    });
  }
  const tiles = summary?.tiles;
  const facts: Fact[] = [
    ...(search ? [{ label: 'Results', value: search.results.length ? `${search.results.length} of ${formatCount(search.ranked_total)} ranked` : 'none', definition: `What the platform's own search ranked for "${clip(q, 80)}", best first, over the team's documents and lessons and the shared shelf.` }] : []),
    ...(list ? [{ label: 'Lessons', value: formatCount(list.total), definition: narrowed(filters) || words ? 'All that these filters match, not this page.' : 'Every lesson on the team\'s shelf, standing or superseded.' }] : []),
    ...(tiles ? [
      { label: 'Lessons adopted', value: figureText(tiles.standing), change: `${formatCount(tiles.standing.imported)} imported`, definition: 'Standing on the shelf as of the cutoff; an imported one was brought in, not learned by an initiative.' },
      { label: 'Superseded', value: figureText(tiles.superseded), definition: 'Replaced by a later lesson, and still readable.' },
      { label: 'Searches last week', value: figureText(tiles.searches.figure), definition: 'The team\'s searches in the last whole week, from any door.' },
      { label: 'Searches with no result', value: figureText(tiles.noResult.figure), change: tiles.noResult.denominator === null ? 'not measured last week' : `of ${formatCount(tiles.noResult.denominator)} last week`, definition: 'Those of last week\'s searches that found nothing.' },
    ] : []),
  ];
  const said = [filters.kind !== 'all' ? `kind ${filters.kind}` : '', words ? `lessons matching "${clip(words, 80)}"` : '', q ? `searched for "${clip(q, 80)}"` : ''].filter(Boolean);
  return budgeted({
    view: 'knowledge',
    title: 'Knowledge',
    address,
    scope: `your active team's knowledge shelf${said.length ? `, ${said.join(', ')}` : ''}; page ${page} of ${Math.max(1, Math.ceil((list?.total ?? 0) / PAGE_SIZE))}`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns: [
      'A search that found something found text to read: retrieval coverage, which does not settle the question.',
      'The platform\'s shared shelf is searched beside the team\'s, and is not on the shelf listed here.',
      ...(onPage ? [] : [`The page lists the shelf ten a page, by kind alone${words ? ', with no words filter' : ''}, so ${address} does not show exactly these lessons.`]),
      ...(summary ? [] : [`The shelf's standing, its searches and its questions could not be read${failure ? `: ${failure}` : ''}.`]),
      ...(!list ? ['The shelf\'s lessons have not been read.'] : list.rows.length ? [] : [narrowed(filters) || words ? 'No lesson matches these filters.' : first > 0 ? 'These rows are past the last lesson.' : 'Nothing is on the shelf yet.']),
    ],
  });
}

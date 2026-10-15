/**
 * The fake gateway's Knowledge: what `GET /api/console/knowledge/summary` and `GET /api/console/knowledge?q&kind&limit&
 * offset` answer, the lessons a node read opens, and the platform's shared shelf the search reads beside a team's.
 *
 * Two fixtures. The shelf is every team's lessons (`KNOWLEDGE` in work.ts, and the ones added here), each standing or
 * superseded, some of them imported rather than made by an initiative. The searches are every team's `knowledge.search`
 * questions, each with whether it found anything. Both are read for the caller's active team alone: its standing and
 * superseded lessons as of the cutoff, its own questions that found nothing, its searches by week, its newest lessons,
 * and its shelf filtered and paged. A question is answered only to the team that asked it.
 *
 * Atlas, which both people act for, holds more than ten lessons so its shelf pages, one of them superseded and two
 * imported; it asked one question three times with no result (once in other capitals and spacing) and more than ten
 * others once, so the questions say their total. The shared shelf holds two lessons, which a search finds among a
 * team's own, the list never answers, and anyone signed in opens by the node route, marked shared.
 *
 * COUPLED: zz-stack's `checks/console-work-knowledge.ts` imports this file with plain `node` and compares its key sets
 * with the real routes' answers. So nothing here is imported through the console's path alias.
 */
import type { KnowledgeBody, KnowledgeNode, Me } from '../../src/lib/api-shapes.ts';
import type { KnowledgeList, KnowledgeSummary } from '../../src/lib/destination-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { ago } from './clock.ts';
import { INITIATIVES, KNOWLEDGE, knowledgeBody } from './work.ts';
import { NO_TEAM, pageParams } from './work-activity.ts';
import { LAST_WEEK, WEEKS, counted, inWeek, iso, workMeta } from './work-initiatives.ts';

type Answer = [status: number, body: unknown];

/** The kinds a lesson may be, as the store's own check allows them. */
const KINDS = ['decision', 'design', 'process', 'knowledge', 'behavior', 'style'];
/** The team whose shelf every team's search reads beside its own. */
export const SHARED_TEAM = 'zz-platform';

/** `[team, number, kind, title, tags, initiative it came out of, hours before the cutoff, imported]`. */
type Seed = [team: string, num: string, kind: string, title: string, tags: string[], evidence: string | null, hours: number, imported: boolean];
const SEEDS: Seed[] = [
  ['atlas', '0007', 'knowledge', 'Latency budgets are per hop, not per request', ['latency'], '2026-10-02-query-latency', 30, false],
  ['atlas', '0008', 'design', 'Explanations quote the index, never paraphrase it', ['search', 'explanations'], '2026-10-08-result-explanations', 20, false],
  ['atlas', '0009', 'behavior', 'People stop reading a result list after the fifth row', ['search', 'research'], null, 800, true],
  ['atlas', '0010', 'style', 'Name a figure by what it counts', ['writing'], null, 820, true],
  ['atlas', '0011', 'decision', 'Re-index nightly, never on write', ['index'], '2026-10-04-index-rebuild', 10, false],
  ['atlas', '0012', 'process', 'A person reads a snippet before it ships', ['search'], '2026-10-06-snippet-quality', 6, false],
  [SHARED_TEAM, '0001', 'process', 'Search the shelf before you write a lesson: recency is no reason to record one twice', ['knowledge', 'search'], null, 1200, false],
  [SHARED_TEAM, '0002', 'decision', 'A gate is a person approving, never a check passing', ['gates'], null, 1500, false],
];
const nodePath = (num: string, title: string) => `nodes/${num}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/-$/, '')}.md`;

const ADDED: KnowledgeNode[] = SEEDS.map(([team, num, type, title, tags, evidence, hours]) => ({
  key: `${team}/${nodePath(num, title)}`, num, team, path: nodePath(num, title), type, status: 'adopted', title, tags, updated: ago(hours),
  bytes: 1_400 + Number(num) * 230, excerpt: `${title}. The evidence and the reasoning, as the initiative that learned it wrote them down.`,
  evidence: evidence ? [evidence] : null, superseded_by: null,
}));
/** Every lesson on every shelf, the shared one's among them. */
export const SHELF: KnowledgeNode[] = [...KNOWLEDGE, ...ADDED];
/** The lessons brought in by an import rather than made by an initiative. */
const IMPORTED = new Set(SEEDS.filter((s) => s[7]).map(([team, num, , title]) => `${team}/${nodePath(num, title)}`));

/** One lesson, whole: the work fixture's own, or one added here. `own` is the one team a member is held to, whose
 *  shelf is theirs to open beside the shared shelf, which is everybody's; the superadmin opens any. */
export function lesson(team: string, path: string, own: string | null = null): KnowledgeBody | null {
  const known = knowledgeBody(team, path, own);
  if (known) return known;
  const n = ADDED.find((x) => x.team === team && x.path === path);
  if (!n || (own !== null && team !== own && team !== SHARED_TEAM)) return null;
  const shelf = own === null ? SHELF : SHELF.filter((x) => x.team === own);
  return {
    team, path, type: n.type, status: n.status, title: n.title, tags: n.tags, updated: n.updated, num: n.num,
    body: `\n${n.title}.\n\n- **What happened.** The initiative found it the slow way, and wrote down how.\n- **What to do.** Check it before you build on it.\n`,
    evidence: n.evidence, superseded_by: null,
    evidence_in: n.evidence?.map((name) => ({ name, team: INITIATIVES.find((i) => i.slug === name)?.team ?? null })) ?? null,
    related: shelf.filter((x) => x.key !== n.key && (x.tags ?? []).some((t) => (n.tags ?? []).includes(t))),
    multi_team: new Set(shelf.map((x) => x.team)).size > 1,
    shelf: team === SHARED_TEAM ? 'shared' : 'team',
  };
}

/** `[team, question as typed, weeks back, hours into that week, found anything]`. */
type Search = [team: string, question: string, back: number, hours: number, found: boolean];
const NOTHING = ['billing export format', 'who owns the crawler', 'p99 for cold caches', 'spanish stemming', 'synonyms for sku', 'boost rules for pdf',
  'how long are logs kept', 'rate limit on the index api', 'typo tolerance setting', 'ranking for empty queries', 'facet counts are wrong'];
const SEARCHES: Search[] = [
  ['atlas', 'how do we rotate the signing key', 3, 20, false],
  ['atlas', 'How do we  rotate the signing KEY', 1, 30, false],
  ['atlas', 'how do we rotate the signing key', 0, 0, false],
  ['atlas', 'where is the ranking eval', 1, 50, false],
  ...NOTHING.map((q, i): Search => ['atlas', q, 5 - (i % 5), 10 + i * 9, false]),
  // Searches that found something: a few each week, more in the last whole one.
  ...WEEKS.flatMap((_, i): Search[] => Array.from({ length: 4 + i * 2 }, (__, k): Search => ['atlas', `recency ${k}`, WEEKS.length - 1 - i, 3 + k * 6, true])),
  ['beacon', 'chargeback dispute window for amex', 1, 40, false],
  ['beacon', 'refund ledger entries', 1, 41, true],
];

/** The team's searches: when, the question normalised for case and spacing, and whether it found anything. */
const searchesOf = (team: string) => SEARCHES.filter(([t]) => t === team)
  .map(([, question, back, hours, found]) => ({ at: iso(inWeek(back, hours)), question: question.trim().replace(/\s+/g, ' ').toLowerCase(), found }));
const within = (at: string, i: number) => at >= WEEKS[i].from && at < WEEKS[i].to;

/** `GET /knowledge/summary`, as `who`: the active team's shelf and its own searches. */
export function knowledgeSummary(who: Me): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const shelf = SHELF.filter((n) => n.team === team);
  const standing = shelf.filter((n) => n.status === 'adopted');
  const searches = searchesOf(team);
  const last = searches.filter((s) => within(s.at, LAST_WEEK));
  const empty = searches.filter((s) => !s.found);
  const asked = [...new Set(empty.map((s) => s.question))].map((question) => {
    const times = empty.filter((s) => s.question === question);
    return { question, asked: times.length, lastAsked: times.reduce((a, s) => (s.at > a ? s.at : a), times[0].at) };
  }).sort((a, b) => b.asked - a.asked || b.lastAsked.localeCompare(a.lastAsked));
  const lastEmpty = last.filter((s) => !s.found).length;
  const answer: KnowledgeSummary = {
    meta: workMeta('active-team', `${team}'s knowledge shelf and its own searches, the shared shelf left out`),
    tiles: {
      standing: { ...counted(standing.length), imported: standing.filter((n) => IMPORTED.has(n.key)).length },
      superseded: counted(shelf.filter((n) => n.status === 'superseded').length),
      searches: { window: WEEKS[LAST_WEEK], figure: counted(last.length), numerator: last.length, denominator: null },
      noResult: { window: WEEKS[LAST_WEEK], figure: counted(lastEmpty), numerator: lastEmpty, denominator: last.length },
    },
    questions: { state: 'ok', data: { rows: asked.slice(0, 10), total: asked.length } },
    weeks: { state: 'ok', data: WEEKS.map((window, i): PeriodFigure => {
      const here = searches.filter((s) => within(s.at, i));
      const found = here.filter((s) => s.found).length;
      return { window, figure: here.length ? { value: (100 * found) / here.length, why: null } : { value: null, why: 'no_data' }, numerator: found, denominator: here.length };
    }) },
    newest: { state: 'ok', data: [...shelf].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 5)
      .map((n) => ({ team: n.team, path: n.path, title: n.title, kind: n.type, createdAt: n.updated, imported: IMPORTED.has(n.key) })) },
  };
  return [200, answer];
}

/** `GET /knowledge?q&kind&limit&offset`, as `who`: the active team's shelf, text in a title, a tag or the text and a
 *  kind, newest first and paged; 400 for a kind the store has no such lesson of, or a page it does not take. */
export function knowledgeList(who: Me, q: URLSearchParams): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const page = pageParams(q, ['q', 'kind']);
  if (typeof page === 'string') return [400, { error: page }];
  const kind = q.get('kind');
  if (kind !== null && !KINDS.includes(kind)) return [400, { error: `kind must be one of ${KINDS.join(', ')}` }];
  const text = (q.get('q') ?? '').trim().toLowerCase();
  const rows = SHELF.filter((n) => n.team === team && (kind === null || n.type === kind)
    && (!text || [n.title, n.excerpt, ...(n.tags ?? [])].some((t) => t.toLowerCase().includes(text))))
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.key.localeCompare(b.key));
  const byKind: Record<string, number> = {};
  for (const n of rows) byKind[n.type] = (byKind[n.type] ?? 0) + 1;
  const answer: KnowledgeList = {
    meta: workMeta('active-team', `${team}'s knowledge shelf, the shared shelf left out`),
    rows: rows.slice(page.offset, page.offset + page.limit),
    total: rows.length,
    summary: { byKind, standing: rows.filter((n) => n.status === 'adopted').length, superseded: rows.filter((n) => n.status === 'superseded').length },
  };
  return [200, answer];
}

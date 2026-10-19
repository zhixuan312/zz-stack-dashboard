/**
 * Knowledge health's shared context (decision 0011), and the words its cards are drawn with: what the page and the
 * assistant are both told about the knowledge store, from the one `GET /platform/knowledge` the console's server read.
 * A superadmin's shelves are every team's, by slug, beside the questions the searches that found nothing asked; a
 * member's are their own team's shelf, the shared shelf and every shelf's totals, and no question at all.
 *
 * Every figure is the gateway's, and none is judged: more lessons or fewer searches are never said to be better or
 * worse. An import stays in every inventory and in its cohort, and in no week's lessons made; a week the gateway could
 * not count is missing, never zero.
 */
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Figure, PeriodFigure, Window } from '@/lib/platform-shapes';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { budgeted, clip, pendingContext } from './context';

/** How long the console's server waits for the read: half a second under five, for a phone to draw what it says. */
export const KNOWLEDGE_HEALTH_BOUND_MS = 4_500;

/** What the page's one read came back as: the whole response, the gateway's sentence, or no answer within the bound. */
export type KnowledgeHealthRead = { state: 'ok'; health: KnowledgeHealth } | { state: 'failed'; reason: string } | { state: 'slow' };

type Ok<P> = P extends { state: 'ok'; data: infer D } ? D : never;
export type ShelfRow = Ok<KnowledgeHealth['shelves']>['rows'][number];
export type MadeWeek = Ok<KnowledgeHealth['made']>['weeks'][number];
export type SearchWeek = Ok<KnowledgeHealth['searches']>['weeks'][number];
type Cohort = Ok<KnowledgeHealth['cohorts']>['rows'][number];
export type Question = Ok<NonNullable<KnowledgeHealth['questions']>>['rows'][number];

/** Why the read is not on the page, in words. */
export function knowledgeHealthTrouble(read: Exclude<KnowledgeHealthRead, { state: 'ok' }>): { title: string; detail: string } {
  if (read.state === 'slow') return { title: 'Knowledge health is unavailable', detail: `The read did not answer within ${KNOWLEDGE_HEALTH_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: 'Knowledge health did not load', detail: `${read.reason.replace(/\.?$/, '.')} Nothing on this page was read.` };
}

type Kind = 'count' | 'share' | 'mean';
const ONE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
/** A value in its unit, at the precision the page prints it. */
export const valueIn = (kind: Kind, n: number): string => (kind === 'share' ? `${ONE.format(n)}%` : kind === 'mean' ? ONE.format(n) : formatCount(n));

/** The word a figure with no value reads as: a week the gateway could not count is unavailable, one with nothing in it no data. */
const wordFor = (f: Figure): string | null => (f.value !== null ? null : f.why === 'unavailable' ? 'Unavailable' : 'No data');
/** A figure as a cell prints it: its value, with `too few` beside a share or a mean under the thirty searches it needs. */
export const figureText = (kind: Kind, f: Figure): string => wordFor(f) ?? `${valueIn(kind, f.value!)}${f.why === 'insufficient' ? ', too few' : ''}`;

/** A week's figure as its column in a chart reads it: the chart has one word, `No data`, for any week with no figure. */
const columnText = (kind: Kind, f: Figure): string => (f.value === null ? 'No data' : figureText(kind, f));

/** A shelf's share with no result in its table cell: as any share is, but a week with no search is `No searches`. */
export const noResultCell = (f: Figure): string => (f.value === null && f.why === 'no_data' ? 'No searches' : figureText('share', f));

/**
 * A shelf's searches last week as a sentence says them, with the share that found nothing: `28 searches, 10.7% with no
 * result, too few to judge`, or `no searches`.
 */
export function searchesSaid(r: ShelfRow): string {
  if (!r.searchesLastWeek) return 'no searches';
  const f = r.noResult.figure;
  const share = f.value === null
    ? (f.why === 'unavailable' ? 'the share with no result unavailable' : null)
    : `${valueIn('share', f.value)} with no result${f.why === 'insufficient' ? ', too few to judge' : ''}`;
  return `${formatCount(r.searchesLastWeek)} ${plural(r.searchesLastWeek, 'search', 'searches')}${share ? `, ${share}` : ''}`;
}

/** A week as a person reads it: `week of 5 Oct`. */
export const weekOf = (w: Window): string => `week of ${formatDay(w.from)}`;

/** Whether the read is the superadmin's: every shelf by name, and the questions. */
export const isFleet = (h: KnowledgeHealth): boolean => h.meta.scope === 'platform-admin';

/** The tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  standing: { label: 'Lessons adopted', kind: 'count', definition: 'Lessons standing on every shelf now, imports included.' },
  madeLastWeek: { label: 'Made last week', kind: 'count', definition: 'Lessons made on every shelf in the last whole week, outside the import cohorts.' },
  searches: { label: 'Searches last week', kind: 'count', definition: 'Real-work searches that recorded their results in the last whole week.' },
  noResult: { label: 'Share with no result', kind: 'share', definition: 'Those searches that found nothing; under thirty searches it is too few.' },
} as const satisfies Record<keyof Ok<KnowledgeHealth['tiles']>, { label: string; kind: Kind; definition: string }>;
export type WeeklyTile = Exclude<keyof typeof TILES, 'standing'>;
export const WEEKLY_TILES: WeeklyTile[] = ['madeLastWeek', 'searches', 'noResult'];

type Pair = { last: PeriodFigure; previous: PeriodFigure };

/** A week's change on the week before, as a fraction, or null when either has no figure that stands beside the other. */
export function changeOf({ last, previous }: Pair): number | null {
  const [a, b] = [last.figure, previous.figure];
  return a.value === null || b.value === null || b.value === 0 || a.why || b.why ? null : (a.value - b.value) / b.value;
}

/** A share's change on the week before in points, the difference of the two shares, as Status gives one; null where
 *  `changeOf` is. A share's change is never a percentage of itself, which a reader takes for points. */
export function pointsOf({ last, previous }: Pair): number | null {
  const [a, b] = [last.figure, previous.figure];
  return a.value === null || b.value === null || a.why || b.why ? null : a.value - b.value;
}
/** A change in points, its direction left to the arrow or the word before it: `5.0 pts`. */
export const pointsIn = (n: number): string => `${ONE.format(Math.abs(n))} pts`;

/** A tile's change as the context says it, beside the tile's own: a share's in points, a count's as a percentage. */
function changeSaid(kind: Kind, t: Pair): string {
  const before = `vs the ${weekOf(t.previous.window)} (${figureText(kind, t.previous.figure)})`;
  const points = kind === 'share' ? pointsOf(t) : null;
  const change = kind === 'share' ? (points === null ? null : points / 100) : changeOf(t);
  if (change === null) return `the week before ${figureText(kind, t.previous.figure)}`;
  if (Math.abs(change) < 0.0005) return `unchanged ${before}`;
  return `${change > 0 ? 'up' : 'down'} ${kind === 'share' ? pointsIn(points!) : `${ONE.format(Math.abs(change * 100))}%`} ${before}`;
}

/** A shelf as a person reads it: a member's by what each is, never by a team's name; a superadmin's by slug. */
export function shelfName(r: ShelfRow, fleet: boolean): string {
  if (r.kind === 'all') return 'All shelves';
  if (!fleet) return r.kind === 'own' ? 'Your team\'s shelf' : 'The shared shelf';
  return r.kind === 'own' ? `${r.shelf} (your team)` : r.kind === 'shared' ? `${r.shelf} (shared)` : r.shelf;
}

/** The last whole week a series holds, by its index: the week the cards are about. */
export function lastWhole<T extends { window: Window }>(weeks: T[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].window.complete) return i;
  return -1;
}

/** The week from which an import is told exactly, by the lesson its event names, and what is told before it. */
export function exactSince(made: Ok<KnowledgeHealth['made']>): string {
  if (made.exactFrom === null) return 'No import has named its lessons yet, so every import is told by the day rule and labelled imported, by day';
  const at = Date.parse(made.exactFrom);
  const week = made.weeks.find((w) => Date.parse(w.window.from) <= at && at < Date.parse(w.window.to));
  return `Imports are told exactly from the ${week ? weekOf(week.window) : `day of ${formatDay(made.exactFrom)}`}; before it, by the day rule, labelled imported, by day`;
}

/** What a week of lessons made left out as imports, told exactly and by the day rule, in words; empty for none. */
export const leftOut = (w: MadeWeek): string =>
  [w.importedExact ? `${formatCount(w.importedExact)} told exactly` : '', w.importedByDay ? `${formatCount(w.importedByDay)} by the day rule` : ''].filter(Boolean).join(', ');

/** One week of lessons made, as the line under its chart says it. */
export function madeLine(w: MadeWeek): { label: string; value: string }[] {
  return [
    { label: 'Made', value: w.made.value === null ? figureText('count', w.made) : `${formatCount(w.made.value)} ${plural(w.made.value, 'lesson')}` },
    { label: 'Imported, exactly', value: `${formatCount(w.importedExact)} left out` },
    { label: 'Imported, by day', value: `${formatCount(w.importedByDay)} left out` },
  ];
}

/** One week of searches, as the line under its chart says it: the share with no result, the share widened, the mean results. */
export function searchLine(w: SearchWeek): { label: string; value: string }[] {
  const over = (p: PeriodFigure) => (p.denominator ? ` of ${formatCount(p.denominator)} ${plural(p.denominator, 'search', 'searches')}` : '');
  return [
    { label: 'No result', value: `${figureText('share', w.noResult.figure)}${over(w.noResult)}` },
    { label: 'Widened', value: `${figureText('share', w.widened.figure)}${over(w.widened)}` },
    { label: 'Mean results', value: `${figureText('mean', w.meanResults)}${w.meanResults.value === null ? '' : ' a search'}` },
  ];
}

/** A cohort's imports as its label says them: `96 imported, by day` when any rests on the day rule. */
const importedText = (c: Cohort): string | null =>
  (c.basis === null || !c.imported ? null : `${formatCount(c.imported)} imported${c.basis === 'by_day' ? ', by day' : ''}`);

/** A week's cohort past its count, in words: the import labelled, and how many have been superseded since. */
export function cohortNote(c: Cohort): string {
  const imported = importedText(c);
  return `${imported ? `${imported} · ` : ''}${formatCount(c.supersededSince)} superseded since`;
}

/** A week's cohort in words: how many were made, the import labelled, and how many have been superseded since. */
export const cohortText = (c: Cohort): string => `${formatCount(c.made)} made · ${cohortNote(c)}`;

/** The question the Ask on the shelves hands the assistant. */
export const askOf = (fleet: boolean): string => (fleet
  ? 'What stands on each team\'s shelf, and how did each team\'s searches go last week?'
  : 'How do my team\'s shelf and the shared shelf stand beside every shelf\'s totals?');

/** The read's own cutoff, as the masthead says it. */
export const asOfLine = (h: KnowledgeHealth): string => `As of ${formatDateTime(h.meta.asOf)}`;

/** How many of a series' latest weeks the context states; the page draws them all, and the prepared query counts any. */
const RECENT = 8;

/** A series' latest weeks, from the first of them, oldest first, the running week said to be so far. */
function byWeek<T extends { window: Window }>(weeks: T[], say: (w: T) => string, between = ', '): string {
  if (!weeks.length) return 'no week yet';
  const recent = weeks.slice(-RECENT);
  return `${recent.length < weeks.length ? `the last ${recent.length} weeks` : 'every week'} from the ${weekOf(recent[0].window)}, oldest first: ${recent.map((w) => `${say(w)}${w.window.complete ? '' : ' so far'}`).join(between)}`;
}

const VIEW = { view: 'knowledge_health', title: 'Knowledge health', address: '/platform/knowledge' } as const;

/**
 * The context the page shares and `view_knowledge_health` answers with, from the same read. The tiles are facts; the
 * shelves, the weeks, the questions, the cohorts and the kinds are insights in that order, so when the budget is tight
 * the kinds go first and the shelves last.
 */
export function knowledgeHealthContext(read: KnowledgeHealthRead): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = knowledgeHealthTrouble(read);
    return pendingContext({ ...VIEW, scope: 'the knowledge store across the platform' }, `${title}. ${detail}`);
  }
  const h = read.health;
  const fleet = isFleet(h);
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  const unavailable = (part: string, reason: string) => unknowns.push(`${part} could not be read (${reason}).`);
  let week: Window | null = null;

  if (h.tiles.state === 'ok') {
    const t = h.tiles.data;
    week = t.searches.last.window;
    facts.push({ label: TILES.standing.label, value: formatCount(t.standing), definition: TILES.standing.definition });
    for (const k of WEEKLY_TILES) {
      const { kind, label, definition } = TILES[k];
      facts.push({ label, value: figureText(kind, t[k].last.figure), change: changeSaid(kind, t[k]), definition });
    }
  } else unavailable('The tiles', h.tiles.reason);

  if (h.shelves.state === 'ok') {
    // The totals first, so a long list of shelves cut short keeps them.
    const rows = [...h.shelves.data.rows].sort((a, b) => Number(b.kind === 'all') - Number(a.kind === 'all'));
    const line = (r: ShelfRow) => `${shelfName(r, fleet)} ${formatCount(r.standing)}/${formatCount(r.superseded)}/${formatCount(r.imported)}, `
      + `${formatCount(r.madeLastWeek)}/${formatCount(r.searchesLastWeek)}/${noResultCell(r.noResult.figure)}`;
    insights.push({ text: `Each shelf as its standing/superseded/imported lessons, then the last whole week's lessons made/searches/share with no result: ${listed(rows, line, 'the table on /platform/knowledge', 8)}.` });
  } else unavailable('The shelves', h.shelves.reason);

  if (h.made.state === 'ok') {
    const made = h.made.data;
    const outs = made.weeks.filter((w) => leftOut(w)).map((w) => `the ${weekOf(w.window)} ${leftOut(w)}`);
    insights.push({ text: `Lessons made outside the import cohorts by week, ${byWeek(made.weeks, (w) => columnText('count', w.made))}. ${exactSince(made)}.${outs.length ? ` Left out as imported: ${listed(outs, (o) => o, 'the chart on /platform/knowledge', 4)}.` : ''}` });
  } else unavailable('The lessons made by week', h.made.reason);

  if (h.searches.state === 'ok') {
    const weeks = h.searches.data.weeks;
    const at = lastWhole(weeks);
    const shown = at >= 0 ? ` In the ${weekOf(weeks[at].window)}: ${searchLine(weeks[at]).map((l) => `${l.label.toLowerCase()} ${l.value}`).join('; ')}.` : '';
    insights.push({ text: `Share of searches with no result by week, ${byWeek(weeks, (w) => columnText('share', w.noResult.figure), '; ')}.${shown}` });
  } else unavailable('The searches by week', h.searches.reason);

  if (h.questions !== null) {
    if (h.questions.state === 'ok') {
      const q = h.questions.data;
      const say = (r: Question) => `"${clip(r.question, 60)}" (${r.shelf}, ${formatCount(r.asked)} ${plural(r.asked, 'time')})`;
      insights.push({ text: `Questions the searches that found nothing asked since ${formatDay(q.window.from)}, most asked first: ${q.rows.length ? listed(q.rows, say, `the list on /platform/knowledge, ${formatCount(q.total)} in all`, 5) : 'none'}.` });
    } else unavailable('The questions with no result', h.questions.reason);
  }

  if (h.cohorts.state === 'ok') {
    // Ranked as the page's Bar list ranks them: the weeks that made the most first.
    const rows = h.cohorts.data.rows.filter((c) => c.made > 0).sort((a, b) => b.made - a.made);
    insights.push({ text: `Lessons by the week made, imports included, the most first: ${rows.length ? listed(rows, (c) => `${formatDay(c.window.from)} ${cohortText(c)}`, 'the list on /platform/knowledge', 4) : 'none made yet'}.` });
  } else unavailable('The lessons by the week made', h.cohorts.reason);

  if (h.byKind.state === 'ok') {
    insights.push({ text: `Standing lessons by kind: ${h.byKind.data.map((k) => `${k.kind} ${formatCount(k.standing)}`).join(', ')}.` });
  } else unavailable('The lessons by kind', h.byKind.reason);

  unknowns.push(
    'These are observations: more lessons or fewer searches are not better or worse, and a week with no figure is missing, not zero.',
    'An import stays in every inventory and its cohort, and in no week\'s lessons made; nothing records when a lesson was superseded.',
  );
  if (!fleet) unknowns.push('No other team\'s shelf is named here, and no question a search that found nothing asked is in this read.');
  return budgeted({
    ...VIEW,
    scope: `${fleet ? 'every shelf on the platform, each team\'s by slug' : 'your team\'s shelf, the shared shelf and every shelf\'s totals'}${week ? `; last whole week: the ${weekOf(week)}` : ''}`,
    freshness: `${asOfLine(h)}.`,
    facts, insights, unknowns,
  });
}

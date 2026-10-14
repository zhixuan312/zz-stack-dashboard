/**
 * The fake gateway's knowledge health: what `GET /api/console/platform/knowledge` answers, to everyone signed in.
 *
 * One fixture, every shelf by name and the questions that found nothing, as the superadmin reads them. A member's
 * answer is derived from it by the gateway's projection rule and never written by hand: their own shelf, the shared
 * shelf and the platform's totals, named `own`, `shared` and `all`, no other shelf at all, and no questions.
 *
 * The figures cover the states the page draws: a cohort imported by maintenance before lessons named themselves, so it
 * is told by the day rule and labelled `imported, by day`, and one imported after, told exactly; a week with no
 * searches, one before the share widened was recorded, and the running week; lessons since superseded; and every kind
 * a lesson may have. The weeks and the searches are the status fixture's, and each team's lessons the work fixture's
 * adopted nodes; both imports landed on the shared shelf.
 *
 * COUPLED: zz-stack's `checks/console-platform-knowledge.ts` imports this file with plain `node` and compares its key
 * sets with the real route's answer. So nothing here is imported through the console's path alias, and every part
 * is `ok`.
 */
import type { KnowledgeHealth } from '../../src/lib/fleet-shapes.ts';
import type { Figure, PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { ago } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';

const SHARED = 'zz-platform';
const SEARCHES = PLATFORM_STATUS.measures.find((m) => m.key === 'searches_with_results_pct')!;
/** The status fixture's weeks, oldest first, the running one last; `LAST` is the last complete week. */
const WEEKS = SEARCHES.weeks.map((w) => w.window);
const LAST = WEEKS.length - 2;

const stands = (value: number): Figure => ({ value, why: null });
const tally = (i: number, n: number): PeriodFigure => ({ window: WEEKS[i], figure: stands(n), numerator: n, denominator: null });
/** A share of searches, in percent; no searches is no share, and under thirty it is kept as insufficient. */
function share(i: number, numerator: number, denominator: number): PeriodFigure {
  return {
    window: WEEKS[i], numerator, denominator,
    figure: denominator === 0 ? { value: null, why: 'no_data' } : { value: (100 * numerator) / denominator, why: denominator < 30 ? 'insufficient' : null },
  };
}

/* Lessons made by week, oldest first: outside the import cohorts, imported exactly (named by their `knowledge.add`
 * event), imported by the day rule, and how many of the week's are superseded since. The first event that named its
 * lesson was in week 3, so the cohort in week 1 rests on the day rule and the one in week 4 is exact. */
const MADE = [2, 0, 1, 2, 3, 1];
const IMPORTED_EXACT = [0, 0, 0, 0, 24, 0];
const IMPORTED_BY_DAY = [0, 96, 0, 0, 0, 0];
const SUPERSEDED_SINCE = [1, 9, 0, 0, 1, 0];
const EXACT_FROM = Date.parse(WEEKS[3].from) + 30 * 3_600_000;

/* Searches by week: the status fixture's completed searches, those that found nothing, and the mean results; its
 * first week precedes the record of searches, and its second held none. */
const NO_RESULT = [0, 0, 2, 9, 4, 0];
const MEAN_RESULTS = [null, null, 4.1, 5.2, 5.6, 6];

type Shelf = { shelf: string; standing: number; superseded: number; imported: number; madeLastWeek: number; searchesLastWeek: number; noResultLastWeek: number };
/** Every shelf, its last complete week's figures; lessons made are those outside the import cohorts. Each team's standing
 *  lessons are the work fixture's adopted nodes. */
const SHELVES: Shelf[] = [
  { shelf: 'atlas', standing: 5, superseded: 1, imported: 0, madeLastWeek: 1, searchesLastWeek: 28, noResultLastWeek: 3 },
  { shelf: 'beacon', standing: 2, superseded: 0, imported: 0, madeLastWeek: 0, searchesLastWeek: 12, noResultLastWeek: 1 },
  { shelf: 'cinder', standing: 1, superseded: 0, imported: 0, madeLastWeek: 0, searchesLastWeek: 0, noResultLastWeek: 0 },
  { shelf: SHARED, standing: 128, superseded: 14, imported: 120, madeLastWeek: 2, searchesLastWeek: 0, noResultLastWeek: 0 },
];
const total = (of: (s: Shelf) => number) => SHELVES.reduce((n, s) => n + of(s), 0);
const ALL: Shelf = {
  shelf: 'all', standing: total((s) => s.standing), superseded: total((s) => s.superseded), imported: total((s) => s.imported),
  madeLastWeek: total((s) => s.madeLastWeek), searchesLastWeek: total((s) => s.searchesLastWeek), noResultLastWeek: total((s) => s.noResultLastWeek),
};

/** Standing lessons by kind, every kind a lesson may have; they add up to every shelf's standing lessons. */
const BY_KIND = [
  { kind: 'decision', standing: 41 }, { kind: 'process', standing: 38 }, { kind: 'knowledge', standing: 29 },
  { kind: 'design', standing: 12 }, { kind: 'behavior', standing: 9 }, { kind: 'style', standing: 7 },
];

/** The questions that found nothing, over the weeks the charts show, the running one included: by question and the
 *  shelf of the team that asked, most asked first. The superadmin's alone. */
const QUESTIONS = [
  { question: 'how do we roll back a schema migration', shelf: 'atlas', asked: 4, lastAskedAt: ago(30) },
  { question: 'chargeback window for card-not-present refunds', shelf: 'beacon', asked: 2, lastAskedAt: ago(60) },
  { question: 'who owns the nightly reindex', shelf: 'atlas', asked: 2, lastAskedAt: ago(200) },
  { question: 'retention period for audit events', shelf: 'beacon', asked: 1, lastAskedAt: ago(5) },
];

/**
 * `GET /platform/knowledge`. `own` is the team the reader acts for, as the identity resolved it. The superadmin reads
 * every shelf by slug, their own marked `own`, and the questions; a member reads their own shelf, the shared shelf and
 * the totals, and no questions.
 */
export function knowledge(admin: boolean, own: string | null): KnowledgeHealth {
  const asOf = ago(0);
  const row = (s: Shelf, shelf: string, kind: 'own' | 'shared' | 'team' | 'all') => ({
    shelf, kind, standing: s.standing, superseded: s.superseded, imported: s.imported, madeLastWeek: s.madeLastWeek,
    searchesLastWeek: s.searchesLastWeek, noResult: share(LAST, s.noResultLastWeek, s.searchesLastWeek),
  });
  const kindOf = (s: Shelf) => (s.shelf === SHARED ? 'shared' as const : s.shelf === own ? 'own' as const : 'team' as const);
  const mine = SHELVES.find((s) => s.shelf === own && s.shelf !== SHARED);
  const shelves = admin
    ? [...SHELVES.map((s) => row(s, s.shelf, kindOf(s))), row(ALL, 'all', 'all')]
    : [...(mine ? [row(mine, 'own', 'own')] : []), row(SHELVES.find((s) => s.shelf === SHARED)!, 'shared', 'shared'), row(ALL, 'all', 'all')];
  const searches = SEARCHES.weeks.map((w) => w.denominator ?? 0);
  return {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: WEEKS[0].from, to: asOf }, scope: admin ? 'platform-admin' : 'platform-public',
      population: 'standing lessons on every shelf, imports included; lessons made outside import cohorts; real-work searches' },
    tiles: { state: 'ok', data: {
      standing: ALL.standing,
      madeLastWeek: { last: tally(LAST, MADE[LAST]), previous: tally(LAST - 1, MADE[LAST - 1]) },
      searches: { last: tally(LAST, searches[LAST]), previous: tally(LAST - 1, searches[LAST - 1]) },
      noResult: { last: share(LAST, NO_RESULT[LAST], searches[LAST]), previous: share(LAST - 1, NO_RESULT[LAST - 1], searches[LAST - 1]) },
    } },
    shelves: { state: 'ok', data: { rows: shelves } },
    made: { state: 'ok', data: {
      exactFrom: new Date(EXACT_FROM).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      weeks: WEEKS.map((window, i) => ({ window, made: stands(MADE[i]), importedExact: IMPORTED_EXACT[i], importedByDay: IMPORTED_BY_DAY[i] })),
    } },
    // A week before searches were recorded has no shares at all; the status measure says which.
    searches: { state: 'ok', data: { weeks: SEARCHES.weeks.map((w, i) => {
      const before = w.figure.why === 'unavailable';
      const unavailable = { window: w.window, figure: { value: null, why: 'unavailable' as const }, numerator: null, denominator: null };
      const mean = MEAN_RESULTS[i];
      return {
        window: w.window,
        noResult: before ? unavailable : share(i, NO_RESULT[i], searches[i]),
        widened: SEARCHES.widened![i],
        meanResults: before ? { value: null, why: 'unavailable' as const } : mean === null || searches[i] === 0 ? { value: null, why: 'no_data' as const }
          : { value: mean, why: searches[i] < 30 ? 'insufficient' as const : null },
      };
    }) } },
    cohorts: { state: 'ok', data: { rows: WEEKS.map((window, i) => {
      const imported = IMPORTED_EXACT[i] + IMPORTED_BY_DAY[i];
      return {
        window, made: MADE[i] + imported, supersededSince: SUPERSEDED_SINCE[i], imported,
        basis: IMPORTED_EXACT[i] ? 'exact' as const : IMPORTED_BY_DAY[i] ? 'by_day' as const : null,
      };
    }) } },
    byKind: { state: 'ok', data: BY_KIND },
    questions: admin ? { state: 'ok', data: {
      window: { ...WEEKS[0], to: WEEKS.at(-1)!.to, observedThrough: WEEKS.at(-1)!.observedThrough, complete: false },
      rows: QUESTIONS, total: QUESTIONS.length,
    } } : null,
  };
}

/**
 * Knowledge health's prepared query, `explore_knowledge_health`: the lessons made on the shelves, imports told apart,
 * and the platform's real-work searches, each over `/platform/query` as Knowledge health counts them, a day, a week, a
 * month or a weekday at a time.
 *
 * Caller-projected as the page is: a superadmin groups the lessons by every team's shelf, by slug, and a member by their
 * own team's shelf and the shared one, every other shelf unnamed. The searches that found nothing are drilled to the
 * questions they asked for a superadmin alone (`drill.needs` in `src/data/prepared.ts`); a member is told the counts and
 * refused the rows. Lessons are counted and never listed. Its README lists the questions it answers. What the model is
 * handed says what the caller's read holds and never who else reads more (reconciliation 77): the same words go to
 * both people.
 */
import type { Measure, PreparedQuery, Source } from '@/lib/explore';
import { KNOWLEDGE_KINDS } from './knowledge-context';

const PAGE = '/platform/knowledge';
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';
const eq = { ops: ['eq' as const] };
const count = (label: string, unit: string, definition: string, where?: [string, string]): Measure =>
  ({ label, unit, definition, agg: 'count', ...(where ? { where: [{ field: where[0], op: 'eq' as const, value: where[1] }] } : {}) });

/** The lessons made, by the day each was made, on the shelves the caller reads: counted, never listed. */
const lessons: Source = {
  collection: 'platform_lessons', date: 'at',
  filters: { shelf: eq, kind: { ...eq, values: KNOWLEDGE_KINDS }, imported: { ...eq, values: ['imported', 'not_imported'] } },
  facets: ['shelf', 'kind', 'imported'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: {
    lessons: count('Lessons made', 'lessons', 'Lessons made in the window, imports included, standing or superseded since.'),
    made: count('Made outside imports', 'lessons', 'Lessons made in the window outside the import cohorts, as Knowledge health draws them by week.', ['imported', 'not_imported']),
    imported: count('Imported', 'lessons', 'Lessons an import made in the window: they stand in every inventory and in no week\'s lessons made.', ['imported', 'imported']),
  },
  drill: { columns: ['kind', 'lessons'], address: () => PAGE },
  // A member's own team's shelf and the shared one, as the route keys them for a member; a superadmin's are slugs.
  labels: { shelf: { own: 'your team\'s shelf', shared: 'the shared shelf' }, imported: { imported: 'imported', not_imported: 'not imported' } },
  none: { shelf: 'other teams\' shelves' },
  cannot: 'Lessons are counted, never listed: Knowledge health (/platform/knowledge) counts them and lists none. A lesson superseded since '
    + 'still counts as made, and nothing records when it was superseded. Before lessons named themselves an import is told by the day rule. '
    + `A shelf is named as the caller's read names it, their own team's and the shared one always; a shelf it leaves unnamed reads as other teams' shelves. ${WINDOW}`,
};

/** The real-work searches that recorded their results, by whether each found something and was widened. */
const searches: Source = {
  collection: 'platform_searches', date: 'at',
  filters: { found: { ...eq, values: ['found', 'nothing'] }, widened: { ...eq, values: ['widened', 'not_widened'] } },
  facets: ['found', 'widened'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: {
    searches: count('Searches', 'searches', 'Real-work searches in the window that recorded their results, on every shelf, from any door.'),
    nothing: count('Found nothing', 'searches', 'Those searches that found nothing at all.', ['found', 'nothing']),
    widened: count('Widened', 'searches', 'Those searches the engine widened because the first pass found too little.', ['widened', 'widened']),
    noResult: { label: 'Share with no result', unit: '%', definition: 'The searches that found nothing, as a share of the searches in the same window.', derive: 'ratio', of: ['nothing', 'searches'], scale: 0.01 },
  },
  drill: { columns: ['question', 'shelf', 'asked', 'lastAskedAt'], address: (r) => String(r.address) },
  labels: { found: { found: 'found something', nothing: 'found nothing' }, widened: { widened: 'widened', not_widened: 'not widened' } },
  none: { widened: 'widening not recorded' },
  cannot: 'A search that found something is retrieval, not an answer. The searches that found nothing drill to the questions they asked and '
    + 'the slug of the team that asked each where the caller\'s read holds the questions, and are counts alone where it does not. A share '
    + `over fewer than thirty searches is too few to compare. ${WINDOW}`,
};

export const knowledgeHealthExplore: PreparedQuery = { sources: { lessons, searches } };

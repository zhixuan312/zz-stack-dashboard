/**
 * Audit's prepared query, `explore_audit`: the platform's recorded events, page views left out, counted over
 * `/platform/query` by kind and team, a day, a week, a month or a weekday at a time, and drilled to the events
 * themselves as Audit lists them. It is the superadmin's, as the page is; the gateway refuses anybody else.
 *
 * Metadata only: a drilled event is its id, when, its kind, team, actor, subject, result and who a refusal is put down
 * to, never a sentence the page did not show, a body, a refusal's text or how it arrived. Its README lists the questions
 * it answers.
 */
import type { PreparedQuery, Source } from '@/lib/explore';

const PAGE = '/platform/audit';
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';

const events: Source = {
  collection: 'audit', date: 'at',
  filters: { kind: { ops: ['eq'] }, team: { ops: ['eq'] } }, facets: ['kind', 'team'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { events: { label: 'Events', unit: 'events', definition: 'Recorded events in the window, page views left out, platform maintenance included.', agg: 'count' } },
  drill: { columns: ['id', 'at', 'kind', 'team', 'actor', 'subject', 'ok', 'refusalOwner'], address: () => PAGE },
  none: { team: 'no team' },
  cannot: 'Events are metadata only: no document, lesson, label, question or refusal text, and no subject that could be free text. '
    + 'How an event arrived (the console, a door or a script) is not recorded, and an actor nobody recorded is not guessed. '
    + `Page views are left out. Some acts of administration leave no event at all: Audit names them. ${WINDOW}`,
};

export const auditExplore: PreparedQuery = { sources: { events } };

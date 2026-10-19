/**
 * The fake gateway's Activity: what `GET /api/console/activity/summary` and `GET /api/console/activity?kind&tool&
 * initiative&refused&limit&offset` answer.
 *
 * One fixture, every team's recorded events over the status fixture's weeks, read for the caller's active team: its
 * real-work events, each refused call under one of the four owners, the owners summing to the refused total by week.
 * Page views are never in it, and the maintenance the platform did is counted apart and left out of every figure. A
 * team's refusal messages are answered to that team alone, grouped by owner, tool and the text normalised for case,
 * digits and identifiers, so no answer to atlas carries a sentence beacon's work produced.
 *
 * Atlas, which both people act for, refuses under all four owners in the last whole week, one of them `other` with no
 * message, and under `theirs` alone the week before; two of its messages differ only by a number, and its log holds
 * more than ten events, so it pages.
 *
 * COUPLED: zz-stack's `checks/console-work-activity.ts` imports this file with plain `node` and compares its key sets
 * with the real routes' answers. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { ActivityLog, ActivityRow, ActivitySummary, RefusalGroup, RefusalOwner } from '../../src/lib/destination-shapes.ts';
import { INITIATIVES } from './work.ts';
import { LAST_WEEK, WEEKS, inWeek, iso, workMeta } from './work-initiatives.ts';

type Answer = [status: number, body: unknown];

const OWNERS: RefusalOwner[] = ['guardrail', 'ours', 'theirs', 'other'];
/** The most events the log reads before it filters nothing further, as the gateway's ceiling. */
const CEILING = 500;
/** The most refusal groups answered; the rest are folded into one count. */
const GROUPS = 20;

/** One recorded event: `origin` is `platform` for the maintenance the platform did itself. */
type Event = ActivityRow & { team: string; origin: 'work' | 'platform' };

const TOOLS = ['core:document_read', 'core:document_edit', 'core:knowledge_search', 'core:document_approve', 'core:skill_read', 'eval:finding_record'];
const OTHER_KINDS: [kind: string, step: string | null][] = [['knowledge.search', null], ['document.patch', 'sdlc-plan'], ['skill_read', 'sdlc-execute'], ['initiative_status', null]];
const ACTORS = ['noah.okafor@example.com', 'ava.lindqvist@example.com'];

/** A refusal as `[weeks back, owner, tool, stored message]`: the message as the gateway stored it, redacted at write. */
type Refusal = [back: number, owner: RefusalOwner, tool: string, message: string | null];
const REFUSALS: Record<string, Refusal[]> = {
  atlas: [
    [5, 'guardrail', 'core:document_approve', 'ERROR: approval needs a stakeholder'],
    [5, 'guardrail', 'core:document_edit', 'ERROR: plan.md cannot be written before spec.md is approved'],
    [4, 'guardrail', 'core:document_approve', 'ERROR: approval needs a stakeholder'],
    [4, 'ours', 'core:document_read', 'ERROR: document not found: plan.md does not exist in this initiative yet'],
    [3, 'guardrail', 'core:document_edit', 'ERROR: plan.md cannot be written before spec.md is approved'],
    [3, 'guardrail', 'core:document_edit', 'ERROR: plan.md cannot be written before spec.md is approved'],
    // The week before last: the platform's own tools failed, and nothing else was refused.
    [2, 'theirs', 'core:knowledge_search', 'upstream answered status 502: Bad Gateway'],
    [2, 'theirs', 'core:knowledge_search', 'upstream answered status 503: Service Unavailable'],
    // The last whole week: all four owners, two messages that differ only by a number, and one refusal with no text.
    [1, 'guardrail', 'core:document_approve', 'ERROR: approval needs a stakeholder'],
    [1, 'guardrail', 'core:document_edit', 'ERROR: plan.md cannot be written before spec.md is approved'],
    [1, 'guardrail', 'core:document_approve', 'ERROR: approval needs a stakeholder'],
    [1, 'ours', 'core:document_edit', 'ERROR: section 4 of plan.md names no acceptance check'],
    [1, 'ours', 'core:document_edit', 'ERROR: section 7 of plan.md names no acceptance check'],
    [1, 'theirs', 'core:knowledge_search', 'upstream answered status 502: Bad Gateway'],
    [1, 'other', 'eval:finding_record', null],
    [0, 'guardrail', 'core:document_approve', 'ERROR: approval needs a stakeholder'],
  ],
  beacon: [
    [1, 'ours', 'core:document_edit', 'ERROR: the ledger of beacon is locked by the chargeback review of mei.tanaka'],
    [1, 'guardrail', 'core:document_approve', 'ERROR: refund-flow spec.md is not approved'],
  ],
};
/** Real-work calls each week, refused or not, oldest week first. */
const CALLS: Record<string, number[]> = { atlas: [14, 16, 18, 15, 22, 9], beacon: [4, 5, 3, 6, 7, 2] };

/** Every recorded event of every team, newest first: real work, the maintenance beside it, and page views. */
const EVENTS: Event[] = (() => {
  const out: Event[] = [];
  const add = (e: Omit<Event, 'id'>) => out.push({ ...e, id: `ev-${e.team}-${String(out.length + 1).padStart(4, '0')}` });
  for (const team of Object.keys(CALLS)) {
    const slugs = INITIATIVES.filter((i) => i.team === team && !i.closed).map((i) => i.slug);
    CALLS[team].forEach((calls, w) => {
      const back = WEEKS.length - 1 - w;
      const refused = REFUSALS[team].filter(([b]) => b === back);
      for (let c = 0; c < calls; c++) {
        const r = refused[c];
        const at = iso(inWeek(back, 2 + c * 7) - (back === 0 ? c * 60_000 : 0));
        add({
          team, origin: 'work', ts: at, kind: 'tool_call', tool: r?.[2] ?? TOOLS[(c + w) % TOOLS.length],
          initiative: slugs[(c + w) % slugs.length] ?? null, step: c % 3 ? 'sdlc-plan' : null,
          ok: !r, owner: r ? r[1] : null, message: r ? r[3] : null, actor: null,
        });
      }
      // The running week's instants all fall at its midpoint, so each event is set a minute apart from the next.
      OTHER_KINDS.forEach(([kind, step], k) => add({
        team, origin: 'work', ts: iso(inWeek(back, 5 + k * 11) - (back === 0 ? (calls + k) * 60_000 : 0)), kind, tool: null, initiative: slugs[k % slugs.length] ?? null,
        step, ok: null, owner: null, message: null, actor: ACTORS[(k + w) % ACTORS.length],
      }));
      add({ team, origin: 'work', ts: iso(inWeek(back, 9) - (back === 0 ? (calls + OTHER_KINDS.length) * 60_000 : 0)), kind: 'console.page_view', tool: null, initiative: null, step: null, ok: null, owner: null, message: null, actor: ACTORS[0] });
    });
    // The platform's own maintenance in the last whole week: a backfill's calls, one of them refused.
    for (let c = 0; c < 4; c++) {
      add({
        team, origin: 'platform', ts: iso(inWeek(1, 60 + c)), kind: 'tool_call', tool: 'core:knowledge_reindex', initiative: null, step: null,
        ok: c !== 0, owner: c === 0 ? 'guardrail' : null, message: c === 0 ? 'ERROR: reindex is already running' : null, actor: null,
      });
    }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts) || b.id.localeCompare(a.id));
})();

/** The team's real work, newest first: page views and maintenance left out. */
const workOf = (team: string) => EVENTS.filter((e) => e.team === team && e.origin === 'work' && e.kind !== 'console.page_view');
const within = (at: string, i: number) => at >= WEEKS[i].from && at < WEEKS[i].to;
const refusedIn = (rows: Event[]) => rows.filter((e) => e.kind === 'tool_call' && e.ok === false);
const ownersOf = (rows: Event[]) => Object.fromEntries(OWNERS.map((o) => [o, rows.filter((e) => (e.owner ?? 'other') === o).length])) as Record<RefusalOwner, number>;
/** zz-core's normaliser, as `@zz/contracts` shares it: case folded, identifiers and digit runs as `#`. */
const normal = (m: string) => m.toLowerCase().replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '#').replace(/\d+/g, '#');
const STRIP = ({ team: _t, origin: _o, ...row }: Event): ActivityRow => { void _t; void _o; return row; };

/** The page a list read takes, once each with every filter it names; the refusal's sentence otherwise. */
export function pageParams(q: URLSearchParams, filters: string[]): { limit: number; offset: number } | string {
  for (const name of [...filters, 'limit', 'offset']) if (q.getAll(name).length > 1) return 'each filter and the page are given at most once';
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return 'limit must be a whole number from 1 to 100, and offset one from 0';
  return { limit, offset };
}

/** Work's refusal for a caller who acts for no team: there is no team whose record to read. */
export const NO_TEAM: Answer = [400, { error: 'you act for no team, so there is no team whose work to read: switch to one of your teams first' }];

/** `GET /activity/summary`, as `who`: the active team's real work by week, its refusals by owner and grouped. */
export function activitySummary(who: Me): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const work = workOf(team);
  const calls = work.filter((e) => e.kind === 'tool_call');
  const last = calls.filter((e) => within(e.ts, LAST_WEEK));
  const lastRefused = refusedIn(last);
  const byTool = [...new Set(lastRefused.map((e) => e.tool!))].map((tool) => ({ tool, count: lastRefused.filter((e) => e.tool === tool).length }))
    .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool));
  const refused = refusedIn(calls);
  const keyed = new Map<string, Event[]>();
  for (const e of refused) {
    const key = `${e.owner ?? 'other'}|${e.tool}|${e.message === null ? '' : `m:${normal(e.message)}`}`;
    keyed.set(key, [...(keyed.get(key) ?? []), e]);
  }
  // Newest first within a group, so its first row is the text it is answered as.
  const groups: RefusalGroup[] = [...keyed.values()].map((rows) => ({
    owner: rows[0].owner ?? 'other', tool: rows[0].tool!, message: rows[0].message, count: rows.length, lastSeen: rows[0].ts,
  })).sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
  const folded = groups.slice(GROUPS);
  const maintenance = EVENTS.filter((e) => e.team === team && e.origin === 'platform' && e.kind === 'tool_call');
  const answer: ActivitySummary = {
    meta: workMeta('active-team', `${team}'s real-work events, page views and the platform's maintenance left out`),
    tiles: {
      calls: { window: WEEKS[LAST_WEEK], figure: { value: last.length, why: null }, numerator: last.length, denominator: null },
      refused: { window: WEEKS[LAST_WEEK], figure: { value: lastRefused.length, why: null }, numerator: lastRefused.length, denominator: last.length, owners: { state: 'ok', data: ownersOf(lastRefused) } },
      mostRefused: { state: 'ok', data: byTool[0] ? { ...byTool[0], of: lastRefused.length } : null },
    },
    weeks: { state: 'ok', data: WEEKS.map((window, i) => {
      const here = calls.filter((e) => within(e.ts, i));
      return { window, complete: window.complete, calls: here.length, refused: refusedIn(here).length, owners: ownersOf(refusedIn(here)) };
    }) },
    groups: { state: 'ok', data: {
      rows: groups.slice(0, GROUPS), groups: groups.length,
      rest: folded.length ? { groups: folded.length, count: folded.reduce((n, g) => n + g.count, 0) } : null,
    } },
    maintenance: { state: 'ok', data: { calls: maintenance.length, refused: maintenance.filter((e) => e.ok === false).length } },
  };
  return [200, answer];
}

/** `GET /activity?kind&tool&initiative&refused&limit&offset`, as `who`: the active team's real-work events newest first,
 *  narrowed before the latest 500 are taken; 400 for a page or a `refused` it does not take. */
export function activityLog(who: Me, q: URLSearchParams): Answer {
  const team = who.activeTeam;
  if (!team) return NO_TEAM;
  const page = pageParams(q, ['kind', 'tool', 'initiative', 'refused']);
  if (typeof page === 'string') return [400, { error: page }];
  const refused = q.get('refused');
  if (refused !== null && refused !== 'true' && refused !== 'false') return [400, { error: 'refused must be true or false' }];
  const [kind, tool, initiative] = ['kind', 'tool', 'initiative'].map((k) => q.get(k));
  const work = workOf(team);
  // An initiative is named by its slug within the active team, so another team's slug matches nothing.
  const matched = work.filter((e) => (kind === null || e.kind === kind) && (tool === null || e.tool === tool)
    && (initiative === null || e.initiative === initiative) && (refused === null || (e.ok === false) === (refused === 'true'))).slice(0, CEILING);
  const answer: ActivityLog = {
    meta: workMeta('active-team', `${team}'s real-work events, page views and the platform's maintenance left out`),
    rows: matched.slice(page.offset, page.offset + page.limit).map(STRIP),
    total: matched.length, ceiling: CEILING,
    kinds: [...new Set(work.map((e) => e.kind))].sort(),
    tools: [...new Set(work.flatMap((e) => (e.tool ? [e.tool] : [])))].sort(),
  };
  return [200, answer];
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { localDay, midnight } from '../scripts/fake-gateway/clock.ts';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import { bugs } from '../scripts/fake-gateway/platform-bugs.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { PEOPLE, people } from '../scripts/fake-gateway/platform-people.ts';
import { platformQuery } from '../scripts/fake-gateway/platform-query.ts';
import { releases } from '../scripts/fake-gateway/platform-releases.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { CALLS_BY_TEAM, TEAMS } from '../scripts/fake-gateway/platform-teams.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { LAST_WEEK, WEEKS } from '../scripts/fake-gateway/work-initiatives.ts';
import { workQuery } from '../scripts/fake-gateway/work-query.ts';
import { addDays, bucketsOf } from '../scripts/fake-gateway/work-query-buckets.ts';

/**
 * The fake gateway's two prepared queries, `/platform/query` and `/work/query`, answered in the gateway's shape.
 *
 * The Platform query is asked directly, as zz-stack's shape check asks it, because its route line in server.ts is the
 * integration's to write. Every measure of the plan's table is held, as each person who may ask it, to the figure the
 * fake's own page answers for the same window: the page's answer is read here and never the query's own facts. A member
 * is refused what only the superadmin is shown, with the sentence every console route refuses with. Work's query is
 * held to Task I-91: dates, the four buckets, where, rows, top and from=0001-01-01.
 */
type Json = Record<string, any>;
type Args = Record<string, string | string[]>;
type Who = typeof ME;

const BOTH = [['the superadmin', ME], ['the member', MEMBER]] as const;
const ALL = '0001-01-01';
const SECRET = 'SENTINEL-sent-by-the-caller';
/** The day an instant falls on in the reporting timezone the fake's calendar is cut in. */
const day = (instant: string) => localDay(Date.parse(instant));
const TODAY = localDay(Date.now());
/** Week `i` of the status fixture's weeks as inclusive dates, and every week of them through today. */
const week = (i: number) => ({ from: day(WEEKS[i].from), to: addDays(day(WEEKS[i].to), -1) });
const WEEKS_SHOWN = { from: day(WEEKS[0].from), to: TODAY };
const keys = (o: object) => Object.keys(o).sort();
const ok = (part: Json) => { expect(part.state).toBe('ok'); return part.data; };

const params = (args: Args) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(args)) for (const x of [v].flat()) p.append(k, x);
  return p;
};
const pq = (who: Who, args: Args) => platformQuery(who, params(args));
const ask = (who: Who, args: Args): Json => {
  const [status, body] = pq(who, args);
  expect(status, JSON.stringify([args, body])).toBe(200);
  return body as Json;
};
/** The groups as `key -> value`. */
const valuesOf = (a: Json) => Object.fromEntries(a.groups.map((g: Json) => [g.key, g.value.value]));
/** Each week's value of a measure, oldest first, over the status fixture's weeks. */
const byWeek = (who: Who, measure: string, extra: Args = {}) => ask(who, { measure, by: 'week', ...WEEKS_SHOWN, ...extra }).groups.map((g: Json) => g.value.value);
const total = (who: Who, args: Args) => ask(who, args).total.value;
/** Drilled rows with the query's own two fields taken off. */
const drilled = (a: Json) => ok(a.rows).rows.map(({ at: _at, address: _address, ...r }: Json) => r);
const nonZero = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).filter(([, n]) => n));

describe('the Platform prepared query, in the gateway\'s shape', () => {
  it.each(BOTH)('answers %s a grouped measure in the contract\'s keys', (_, who) => {
    const a = ask(who, { measure: 'calls', by: 'tool', compare: 'previous', top: '2' });
    expect(keys(a)).toEqual(['by', 'groups', 'measure', 'meta', 'rest', 'rows', 'total', 'window']);
    expect(keys(a.meta)).toEqual(['asOf', 'coverageFrom', 'period', 'population', 'scope', 'timezone']);
    expect(a.meta.scope).toBe(who.superadmin ? 'platform-admin' : 'platform-public');
    expect(keys(a.window)).toEqual(['complete', 'from', 'observedFrom', 'observedThrough', 'to']);
    expect(a.window).toMatchObject({ from: WEEKS[LAST_WEEK].from, to: WEEKS[LAST_WEEK].to, complete: true });
    for (const g of a.groups) expect(keys(g)).toEqual(['key', 'label', 'previous', 'share', 'value']);
    expect(keys(a.rest)).toEqual(['groups', 'previous', 'value']);
    expect(a.rows).toBe(null);
    const d = ask(who, { measure: 'bugs_filed', rows: '3', from: ALL, to: TODAY });
    for (const r of ok(d.rows).rows) {
      expect(r.address).toBe('/platform/bugs');
      expect(r.at).toBe(r.filedAt);
      expect(r).not.toHaveProperty('href');
    }
  });

  it('is answered alike in every mode the fake draws, as every other Platform read is', () => {
    const body = ask(ME, { measure: 'calls', by: 'week' });
    expect(empty(['platform', 'query'], body)).toBe(body);
    expect(extreme(['platform', 'query'], body, null)).toBe(body);
  });
});

describe('each measure equals the figure its page answers', () => {
  it.each(BOTH)('calls, refusals and malformed calls, as Usage and Status count them, to %s', (_, who) => {
    const u = usage(who.superadmin);
    const calls = ok(u.callsByWeek).weeks.map((w: Json) => w.calls.value);
    const refused = ok(u.tiles).refusedShare.weeks.map((w: Json) => w.numerator);
    expect(byWeek(who, 'calls')).toEqual(calls);
    expect(byWeek(who, 'refusals')).toEqual(refused);
    WEEKS.forEach((_w, i) => {
      expect(valuesOf(ask(who, { measure: 'calls', by: 'refused', ...week(i) }))).toEqual({ refused: refused[i], answered: calls[i] - refused[i] });
    });
    const tools = valuesOf(ask(who, { measure: 'calls', by: 'tool' }));
    expect(tools).toEqual(Object.fromEntries(ok(u.mostUsed).rows.map((r: Json) => [r.tool === 'Unregistered tools' ? null : r.tool, r.calls])));
    const r = ok(u.refusals);
    expect(valuesOf(ask(who, { measure: 'refusals', by: 'owner' }))).toEqual({ guardrail: r.guardrail, ours: r.ours, theirs: r.theirs, other: r.other });
    const malformed = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.weeks.map((w) => w.numerator);
    expect(byWeek(who, 'malformed')).toEqual(malformed);
    expect(releases(10, 0).weeks.map((w) => w.malformedPer1000.numerator)).toEqual(malformed);
    // An empty value is the group with none: the calls to a tool no door registers.
    expect(total(who, { measure: 'calls', where: 'tool=' })).toBe(tools.null);
  });

  it('splits calls by team for the superadmin as Usage does', () => {
    const u = ok(usage(true).callsByWeek).weeks;
    WEEKS.forEach((_w, i) => {
      const teams = valuesOf(ask(ME, { measure: 'calls', by: 'team', ...week(i), top: '50' }));
      expect(teams).toEqual(nonZero(Object.fromEntries(CALLS_BY_TEAM.map((t) => [t.team, t.calls[i]]))));
      for (const part of u[i].parts.filter((p: Json) => p.label !== 'Other')) expect(teams[part.label] ?? 0).toBe(part.calls);
    });
  });

  it.each(BOTH)('releases and migrations, as Releases counts them, to %s', (_, who) => {
    const r = releases(100, 0);
    expect(byWeek(who, 'releases')).toEqual(r.weeks.map((w) => w.releases));
    expect(total(who, { measure: 'releases', from: ALL, to: TODAY })).toBe(r.tiles.releases);
    expect(drilled(ask(who, { measure: 'releases', rows: '20', from: ALL, to: TODAY }))).toEqual(ok(r.rows).rows);
    expect(total(who, { measure: 'migrations', from: ALL, to: TODAY })).toBe(r.tiles.migrations.applied);
  });

  it.each(BOTH)('bug reports filed and resolved, as %s reads Bugs', (_, who) => {
    const none = { state: null, impact: null, surface: null };
    const b = bugs(who.superadmin, none, 100, 0);
    const counts = ok(b.counts);
    expect(byWeek(who, 'bugs_filed')).toEqual(b.cohorts.map((c) => c.filed.value));
    expect(byWeek(who, 'bugs_resolved')).toEqual(b.cohorts.map((c) => c.resolved.value));
    const everything = { from: ALL, to: TODAY };
    expect(valuesOf(ask(who, { measure: 'bugs_filed', by: 'impact', ...everything }))).toEqual(counts.byImpact);
    expect(valuesOf(ask(who, { measure: 'bugs_filed', by: 'state', ...everything }))).toEqual({ open: counts.open, resolved: counts.resolved });
    const { open: _open, ...outcomes } = counts.byStatus;
    expect(valuesOf(ask(who, { measure: 'bugs_resolved', by: 'outcome', ...everything }))).toEqual(outcomes);
    expect(drilled(ask(who, { measure: 'bugs_filed', rows: '20', ...everything }))).toEqual(ok(b.queue).rows);
    const open = bugs(who.superadmin, { ...none, state: 'open' }, 100, 0);
    expect(drilled(ask(who, { measure: 'bugs_filed', rows: '20', where: 'state=open', ...everything }))).toEqual(ok(open.queue).rows);
  });

  it.each(BOTH)('findings and scores, as %s reads Evaluation', (_, who) => {
    const e = evaluation(who.superadmin);
    const everything = { from: ALL, to: TODAY };
    expect(valuesOf(ask(who, { measure: 'findings', by: 'decision', ...everything }))).toEqual(ok(e.byDecision));
    expect(valuesOf(ask(who, { measure: 'findings', by: 'owner', ...everything }))).toEqual(ok(e.byOwner));
    const waiting = drilled(ask(who, { measure: 'findings', by: 'decision', group: 'deferred', limit: '20', ...everything }));
    expect(waiting).toEqual([...ok(e.waiting).rows].sort((a, b) => b.waitingSince.localeCompare(a.waitingSince)));
    expect(total(who, { measure: 'scores', ...everything })).toBe(e.tiles.established);
    const established = ok(e.plugins).filter((p: Json) => p.standing === 'established').sort((a: Json, b: Json) => b.scoredAt.localeCompare(a.scoredAt));
    expect(drilled(ask(who, { measure: 'scores', rows: '20', ...everything }))).toEqual(established);
  });

  it.each(BOTH)('lessons made and searches, as %s reads Knowledge health and Status', (_, who) => {
    const k = knowledge(who.superadmin, who.activeTeam);
    expect(byWeek(who, 'lessons')).toEqual(ok(k.cohorts).rows.map((c: Json) => c.made));
    expect(byWeek(who, 'lessons', { where: 'imported=not_imported' })).toEqual(ok(k.made).weeks.map((w: Json) => w.made.value));
    const shelves = valuesOf(ask(who, { measure: 'lessons', by: 'shelf', where: 'imported=not_imported' }));
    const rows = ok(k.shelves).rows.filter((s: Json) => s.kind !== 'all');
    expect(shelves).toEqual(who.superadmin ? nonZero(Object.fromEntries(rows.map((s: Json) => [s.shelf, s.madeLastWeek])))
      : Object.fromEntries(rows.map((s: Json) => [s.kind, s.madeLastWeek])));
    expect(total(who, { measure: 'lessons', where: 'imported=not_imported' })).toBe(ok(k.shelves).rows.find((s: Json) => s.kind === 'all').madeLastWeek);

    const s = PLATFORM_STATUS.measures.find((m) => m.key === 'searches_with_results_pct')!;
    expect(byWeek(who, 'searches')).toEqual(s.weeks.map((w) => (w.figure.why === 'unavailable' ? 0 : w.denominator)));
    expect(byWeek(who, 'searches', { where: 'found=found' })).toEqual(s.weeks.map((w) => w.numerator ?? 0));
    expect(byWeek(who, 'searches', { where: 'widened=widened' })).toEqual(s.widened!.map((w) => w.numerator ?? 0));
    const tiles = ok(k.tiles);
    expect(total(who, { measure: 'searches' })).toBe(tiles.searches.last.figure.value);
    expect(valuesOf(ask(who, { measure: 'searches', by: 'found' })).nothing).toBe(tiles.noResult.last.numerator);
  });

  it('drills the searches that found nothing to the questions Knowledge health lists the superadmin', () => {
    const questions = ok(knowledge(true, 'atlas').questions!).rows;
    const asked = drilled(ask(ME, { measure: 'searches', by: 'found', group: 'nothing', limit: '20', ...WEEKS_SHOWN }));
    expect(asked.length).toBeGreaterThan(0);
    for (const q of asked) expect(questions).toContainEqual(q);
    expect(asked.map((q: Json) => q.lastAskedAt)).toEqual([...asked.map((q: Json) => q.lastAskedAt)].sort().reverse());
    expect(ok(ask(ME, { measure: 'searches', by: 'found', group: 'found', ...WEEKS_SHOWN }).rows).rows).toEqual([]);
  });

  it.each(BOTH)('model calls, as Usage counts them, to %s', (_, who) => {
    const m = ok(usage(who.superadmin).modelCalls);
    expect(total(who, { measure: 'model_calls' })).toBe(m.last.calls);
    expect(total(who, { measure: 'model_calls', ...week(LAST_WEEK - 1) })).toBe(m.previous.calls);
    expect(ask(who, { measure: 'model_calls', by: 'model' }).groups).toEqual([
      { key: null, label: 'No model', value: { value: m.last.calls, why: null }, share: 1, previous: null },
    ]);
  });

  it('teams, people, sign-ins and the audit, as the superadmin reads them', () => {
    const everything = { from: ALL, to: TODAY };
    const count = <T,>(rows: T[], of: (r: T) => string) => rows.reduce<Record<string, number>>((o, r) => ({ ...o, [of(r)]: (o[of(r)] ?? 0) + 1 }), {});
    expect(total(ME, { measure: 'teams', ...everything })).toBe(TEAMS.length);
    expect(valuesOf(ask(ME, { measure: 'teams', by: 'status', ...everything }))).toEqual({ active: 0, archived: 0, ...count(TEAMS, (t) => t.status) });
    expect(new Set(drilled(ask(ME, { measure: 'teams', rows: '20', ...everything })).map((t: Json) => t.slug))).toEqual(new Set(TEAMS.map((t) => t.slug)));
    const [, roster] = people(ME, new URLSearchParams(), { limit: 100, offset: 0 })! as [number, Json];
    expect(total(ME, { measure: 'people', ...everything })).toBe(roster.tiles.people);
    expect(valuesOf(ask(ME, { measure: 'people', by: 'state', ...everything }))).toEqual({ active: 0, deactivated: 0, ...count(PEOPLE, (p) => p.state) });
    expect(total(ME, { measure: 'sign_ins' })).toBe(roster.tiles.signInsLastWeek.figure.value);
    const signedIn = drilled(ask(ME, { measure: 'sign_ins', rows: '20', ...everything }));
    expect(new Set(signedIn.map((p: Json) => p.email))).toEqual(new Set(PEOPLE.filter((p) => p.lastSignIn !== null).map((p) => p.email)));
    const [, events] = audit(new URLSearchParams({ filter: 'all' }), { limit: 500, offset: 0 })! as [number, Json];
    expect(total(ME, { measure: 'audit', ...everything })).toBe(events.total);
    expect(valuesOf(ask(ME, { measure: 'audit', by: 'kind', ...everything, top: '50' }))).toEqual(count(events.rows as Json[], (r) => r.kind));
    expect(ok(ask(ME, { measure: 'audit', rows: '20', ...everything }).rows).rows).toEqual(events.rows.slice(0, 20).map((r: Json) => ({ ...r, address: '/platform/audit' })));
  });
});

describe('what a member is refused', () => {
  const REFUSAL = [403, { error: 'not permitted' }];
  it('refuses a member the superadmin\'s measures, a team, and the questions searches asked', () => {
    for (const measure of ['teams', 'people', 'sign_ins', 'audit']) expect(pq(MEMBER, { measure })).toEqual(REFUSAL);
    expect(pq(MEMBER, { measure: 'calls', by: 'team' })).toEqual(REFUSAL);
    expect(pq(MEMBER, { measure: 'calls', where: 'team=atlas' })).toEqual(REFUSAL);
    // A team is the superadmin's wherever it is named, a measure with no team dimension included.
    expect(pq(MEMBER, { measure: 'bugs_filed', where: 'team=atlas' })).toEqual(REFUSAL);
    expect(pq(MEMBER, { measure: 'searches', by: 'found', group: 'nothing' })).toEqual(REFUSAL);
    expect(pq(MEMBER, { measure: 'searches', rows: '5' })).toEqual(REFUSAL);
    for (const measure of ['teams', 'people', 'sign_ins', 'audit']) expect(pq(ME, { measure })[0]).toBe(200);
  });

  it('answers a member nothing that names a team, a report\'s own title or a finding\'s pattern', () => {
    const seen = JSON.stringify(['calls', 'refusals', 'bugs_filed', 'bugs_resolved', 'findings', 'scores', 'lessons'].flatMap((measure) => [
      ask(MEMBER, { measure, from: ALL, to: TODAY, ...(measure === 'refusals' || measure === 'lessons' ? {} : { rows: '20' }) }),
      ask(MEMBER, { measure, by: measure === 'lessons' ? 'shelf' : 'week', from: ALL, to: TODAY, top: '50' }),
    ]));
    for (const t of TEAMS) expect(seen).not.toContain(`"${t.slug}"`);
    expect(seen).not.toContain('document_approve refuses');
    expect(seen).not.toContain('pattern');
  });
});

describe('what the route does not take', () => {
  it.each([
    [{ measure: 'bytes' }, 'measure must be one of calls, refusals, malformed, releases, migrations'],
    [{ measure: 'calls', by: 'skill' }, 'calls is grouped by one of tool, refused, team, or a bucket: day, week, month, weekday'],
    [{ measure: 'releases', by: 'tool' }, 'releases is grouped by a bucket: day, week, month, weekday'],
    [{ measure: 'teams', by: 'day' }, 'teams is grouped by status'],
    [{ measure: 'calls', from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' }, 'from and to are inclusive dates'],
    [{ measure: 'calls', from: '2026-10-01', to: '2026-10-02T00:00:00Z' }, 'from and to are both dates or both instants, not one of each'],
    [{ measure: 'calls', from: '2026-10-05' }, 'given both or neither'],
    [{ measure: 'calls', from: '2026-10-05', to: '2026-10-04' }, 'from no later than to'],
    [{ measure: 'teams', compare: 'previous' }, 'teams is a stock, counted as of the window\'s end: a stock has no window before'],
    [{ measure: 'calls', compare: 'last' }, 'compare must be previous, or left out'],
    [{ measure: 'calls', where: 'tool' }, 'each where is a dimension, an equals sign and a value'],
    [{ measure: 'calls', where: 'owner=ours' }, 'calls is filtered by one of tool, refused, team'],
    [{ measure: 'releases', where: 'tool=x' }, 'releases takes no filter'],
    [{ measure: 'calls', where: ['refused=refused', 'refused=answered', 'tool=a', 'tool=b', 'tool=c'] }, 'where takes at most 4 filters'],
    [{ measure: 'calls', where: `refused=${SECRET}` }, 'a filter on refused takes one of refused, answered'],
    [{ measure: 'calls', where: `tool=${SECRET}` }, 'tool must be a tool a door registers, as door:name'],
    [{ measure: 'bugs_filed', by: 'surface', group: SECRET }, 'surface must be a tool, a door or console'],
    [{ measure: 'calls', group: 'x' }, 'group names a group of by: give by with it'],
    [{ measure: 'calls', by: 'week', group: '2026-10-07' }, 'group must be a week of the window, as by=week keys it'],
    [{ measure: 'calls', rows: '5', limit: '5' }, 'given without group, limit or offset'],
    [{ measure: 'refusals', rows: '5' }, 'refusals are not drilled: Usage and Status count them and list none'],
    [{ measure: 'calls', rows: '21' }, 'rows must be a whole number from 1 to 20'],
    [{ measure: 'calls', by: 'tool', top: '51' }, 'top must be a whole number from 1 to 50'],
    [{ measure: 'calls', by: 'tool', group: 'core:document_read', limit: '21' }, 'limit must be a whole number from 1 to 20'],
    [{ measure: 'calls', by: ['tool', 'week'] }, 'each argument is given at most once'],
  ] as [Args, string][])('refuses %j with a sentence naming what it takes', (args, says) => {
    // A member is refused a superadmin's measure before anything else is said of the question.
    for (const who of args.measure === 'teams' ? [ME] : [ME, MEMBER]) {
      const [status, body] = pq(who, args);
      expect(status).toBe(400);
      expect((body as Json).error).toContain(says);
      expect(JSON.stringify(body)).not.toContain(SECRET);
    }
  });
});

describe('the Platform query\'s calendar, as Work\'s', () => {
  it('answers a week by its Monday, a month by its year and month, and only the weekdays the window holds', () => {
    const weeks = ask(ME, { measure: 'calls', by: 'week', ...WEEKS_SHOWN });
    expect(weeks.groups.map((g: Json) => g.key)).toEqual(WEEKS.map((w) => day(w.from)));
    expect(weeks.groups[0].label).toBe(`Week from ${day(WEEKS[0].from)}`);
    const months = ask(ME, { measure: 'calls', by: 'month', ...WEEKS_SHOWN });
    expect(months.groups.map((g: Json) => g.key)).toEqual(bucketsOf('month', midnight(WEEKS_SHOWN.from), Date.now() + 1));
    expect(months.groups[0].label).toBe(`Month ${months.groups[0].key}`);
    const wednesday = addDays(day(WEEKS[LAST_WEEK].from), 2);
    const days = ask(ME, { measure: 'calls', by: 'weekday', from: wednesday, to: addDays(wednesday, 2) });
    expect(days.groups.map((g: Json) => g.key)).toEqual(['Wednesday', 'Thursday', 'Friday']);
    const all = ask(ME, { measure: 'calls', by: 'weekday', ...WEEKS_SHOWN });
    expect(all.groups.map((g: Json) => g.label)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });

  it('stops its buckets at the cutoff, answers the latest top and folds the earlier into rest', () => {
    const ahead = ask(ME, { measure: 'calls', by: 'day', from: day(WEEKS.at(-1)!.from), to: addDays(TODAY, 5) });
    expect(ahead.groups.at(-1).key).toBe(TODAY);
    expect(ahead.window.complete).toBe(false);
    const a = ask(ME, { measure: 'calls', by: 'day', ...WEEKS_SHOWN, top: '5' });
    expect(a.groups.map((g: Json) => g.key)).toEqual(Array.from({ length: 5 }, (_, i) => addDays(TODAY, i - 4)));
    expect(a.rest.groups).toBe(Math.round((midnight(TODAY) - midnight(WEEKS_SHOWN.from)) / 86_400_000) + 1 - 5);
    expect(a.groups.reduce((n: number, g: Json) => n + g.value.value, 0) + a.rest.value).toBe(a.total.value);
    const tools = ask(ME, { measure: 'calls', by: 'tool', top: '2', compare: 'previous' });
    expect(tools.groups.map((g: Json) => g.key)).toEqual(['core:document_read', 'core:knowledge_search']);
    expect(tools.groups.reduce((n: number, g: Json) => n + g.value.value, 0) + tools.rest.value).toBe(tools.total.value);
    const before = valuesOf(ask(ME, { measure: 'calls', by: 'tool', ...week(LAST_WEEK - 1) }));
    expect(tools.rest.previous).toBe(Object.values(before).reduce((n: number, v) => n + (v as number), 0) - tools.groups.reduce((n: number, g: Json) => n + g.previous.value, 0));
  });

  it('compares a bucket with the same bucket of the window before by its place, a weekday by its name', () => {
    const a = ask(ME, { measure: 'calls', by: 'week', from: week(3).from, to: week(4).to, compare: 'previous' });
    expect(a.groups.map((g: Json) => g.previous.value)).toEqual([week(1), week(2)].map((w) => total(ME, { measure: 'calls', ...w })));
    const d = ask(ME, { measure: 'calls', by: 'weekday', ...week(4), compare: 'previous' });
    expect(d.groups.map((g: Json) => g.previous.value)).toEqual(ask(ME, { measure: 'calls', by: 'weekday', ...week(3) }).groups.map((g: Json) => g.value.value));
  });

  it('reads from=0001-01-01 from the first recorded day, and changes nothing for an argument it does not take', () => {
    const a = ask(MEMBER, { measure: 'calls', by: 'week', from: ALL, to: TODAY });
    expect(a.window.from).toBe(WEEKS[0].from);
    expect(a.meta.coverageFrom).toBe(WEEKS[0].from);
    expect(ask(MEMBER, { measure: 'calls', by: 'tool', scope: 'platform', team: 'beacon' })).toEqual(ask(MEMBER, { measure: 'calls', by: 'tool' }));
  });
});

describe('Work\'s prepared query takes ZZ Meridian\'s window and buckets', () => {
  const wq = (args: Args, who: Who = MEMBER) => workQuery(who, params(args));
  const work = (args: Args, who: Who = MEMBER): Json => {
    const [status, body] = wq(args, who);
    expect(status, JSON.stringify([args, body])).toBe(200);
    return body as Json;
  };
  const SPAN = { from: day(WEEKS[0].from), to: TODAY };
  const TAKES_PERIOD = ['closures', 'opened', 'words', 'approvals', 'lessons', 'runs', 'searches', 'calls', 'refusals', 'output', 'skill_calls'];

  it('answers inclusive dates as the instants of those days\' start and the next day\'s', () => {
    const dates = work({ measure: 'closures', by: 'outcome', from: SPAN.from, to: day(WEEKS[LAST_WEEK].to) });
    const instants = work({ measure: 'closures', by: 'outcome', from: WEEKS[0].from, to: new Date(midnight(day(WEEKS[LAST_WEEK].to)) + 86_400_000).toISOString() });
    expect(dates.groups).toEqual(instants.groups);
    expect(dates.window).toEqual(instants.window);
    const alone = work({ measure: 'closures', by: 'outcome', from: day(WEEKS[2].from) });
    expect(alone.window.to).toBe(WEEKS[LAST_WEEK].to);
  });

  it('answers every bucket of the window in order, each the sum of the rows its drill answers', () => {
    for (const measure of TAKES_PERIOD) {
      for (const bucket of ['day', 'week', 'month', 'weekday'].filter((b) => measure !== 'runs' || b !== 'weekday')) {
        const a = work({ measure, by: bucket, ...SPAN });
        expect(a.grain).toBe(bucket);
        const expected = bucketsOf(bucket as 'day', midnight(SPAN.from), Math.min(midnight(addDays(SPAN.to, 1)), Date.now() + 1));
        expect(a.groups.map((g: Json) => g.key)).toEqual(expected.slice(-20));
        if (measure === 'skill_calls') continue;
        for (const g of a.groups.filter((x: Json) => x.value.value)) {
          const rows = ok(work({ measure, by: bucket, ...SPAN, group: g.key, limit: '100' }).rows).rows;
          const sum = rows.reduce((n: number, r: Json) => n + (measure === 'words' ? r.added : measure === 'output' ? r.bytes ?? 0 : 1), 0);
          expect(sum, `${measure} by ${bucket} ${g.key}`).toBe(g.value.value);
        }
      }
    }
    // A run's weekday is its own dimension, so by=weekday is not a bucket of runs.
    expect(work({ measure: 'runs', by: 'weekday', ...SPAN }).grain).toBe(null);
  });

  it('keeps period\'s own grain, and takes no top beside it', () => {
    expect(work({ measure: 'words', by: 'period' }).grain).toBe('week');
    expect(wq({ measure: 'words', by: 'period', top: '3' })).toEqual([400, { error: 'period answers every period of the window, so it takes no top' }]);
  });

  it('filters by where, answers the newest rows, folds what top leaves out, and reads from=0001-01-01 from the first day', () => {
    const accepted = work({ measure: 'closures', by: 'flow', where: 'outcome=accepted', ...SPAN });
    expect(accepted.total.value).toBe(valuesOf(work({ measure: 'closures', by: 'outcome', ...SPAN })).accepted);
    const newest = ok(work({ measure: 'runs', by: 'skill', rows: '3', ...SPAN }).rows);
    expect(newest.rows).toHaveLength(3);
    expect(newest.rows.map((r: Json) => r.startedAt)).toEqual([...newest.rows.map((r: Json) => r.startedAt)].sort().reverse());
    const top = work({ measure: 'calls', by: 'day', ...SPAN, top: '3' });
    expect(top.groups).toHaveLength(3);
    expect(top.groups.reduce((n: number, g: Json) => n + g.value.value, 0) + (top.rest?.value ?? 0)).toBe(top.total.value);
    const first = work({ measure: 'runs', by: 'skill', from: ALL, to: TODAY });
    const runs = ok(work({ measure: 'runs', by: 'skill', rows: '20', from: ALL, to: TODAY }).rows).rows;
    expect(first.window.from).toBe(new Date(midnight(day(runs.at(-1).startedAt))).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  });

  it('refuses what Task I-91 refuses, with the gateway\'s sentences', () => {
    for (const [args, says] of [
      [{ measure: 'closures', by: 'outcome', from: '2026-10-01', to: '2026-10-02T00:00:00Z' }, 'from and to are both dates or both instants, not one of each'],
      [{ measure: 'closures', by: 'outcome', from: '2026-02-30', to: '2026-03-02' }, 'from and to must be ISO 8601 instants or dates, YYYY-MM-DD, from before to'],
      [{ measure: 'shelf', by: 'week' }, 'shelf is grouped by one of kind, standing'],
      [{ measure: 'skill_calls', by: 'plugin', rows: '3' }, 'skill_calls is not drilled: its groups are its rows'],
      [{ measure: 'closures', by: 'outcome', where: 'skill=x' }, 'closures is filtered by one of outcome, flow, initiative'],
      [{ measure: 'closures', by: 'outcome', where: `outcome=${SECRET}` }, 'a filter on outcome takes one of delivered, accepted, abandoned'],
      [{ measure: 'closures', by: 'outcome', rows: '5', group: 'accepted' }, 'given without group, limit or offset'],
      [{ measure: 'closures', by: 'outcome', top: '51' }, 'top must be a whole number from 1 to 50'],
    ] as [Args, string][]) {
      const [status, body] = wq(args);
      expect(status, JSON.stringify(args)).toBe(400);
      expect((body as Json).error).toContain(says);
      expect(JSON.stringify(body)).not.toContain(SECRET);
    }
  });
});

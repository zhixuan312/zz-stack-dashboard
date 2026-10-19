import { beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '@/app.config';
import { dayOf, formatDateTime } from '@/lib/format-date';

/**
 * The fake gateway's calendar is the console's (Phase 7's I-177): the gateway cuts every week Monday to Monday in the
 * reporting timezone (`periodsOf` in console/work-figures.ts), the console prints every date in `app.timezone`, and the
 * fake was cutting its weeks at midnight UTC, so a week's first eight hours were printed as the Monday's and a record
 * of them was counted in the week before. Every weekly answer the fake gives is read here: each week starts at Monday
 * 00:00 where the console prints it and ends at the next, each month on the 1st, `meta.timezone` names that timezone,
 * and every dated row is counted in the week its date is printed in.
 *
 * The fake's dates are offsets from the moment it started, so its clock is pinned before it is read, at moments when
 * the reporting timezone and UTC disagree on the day: 03:00 on Monday 19 Oct in Singapore (still Sunday in UTC), and
 * 07:30 on Thursday 22 Oct (23:30 on the Wednesday in UTC).
 */
const MOMENTS = ['2026-10-18T19:00:00Z', '2026-10-21T23:30:00Z'];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
type Window = { from: string; to: string };
type Dated = { path: string; window: Window };

/** Every `{ from, to }` of instants in an answer, with where it was found. */
function windowsOf(v: unknown, path = ''): Dated[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => windowsOf(x, `${path}[${i}]`));
  if (!v || typeof v !== 'object') return [];
  const o = v as Record<string, unknown>;
  const own = typeof o.from === 'string' && typeof o.to === 'string' && o.from.includes('T') && o.to.includes('T') ? [{ path, window: o as Window }] : [];
  return [...own, ...Object.entries(o).flatMap(([k, x]) => windowsOf(x, `${path}.${k}`))];
}

/** How a window's start is printed: the day and the time, `19 Oct 2026, 00:00`. */
const printed = (instant: string) => ({ day: dayOf(instant), time: formatDateTime(instant).slice(-5) });
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** A calendar window: a month runs from one 1st to the next, everything a whole number of weeks long (to the hour a
 *  change of offset moves it) from a Monday to a Monday. Any other window, a release's 72 hours either side or a period
 *  that runs to the cutoff, is not cut on weeks. */
function expectCalendar({ path, window: w }: Dated, asOf: string) {
  if (w.to === asOf) return;
  const span = Date.parse(w.to) - Date.parse(w.from);
  const [from, to] = [printed(w.from), printed(w.to)];
  const month = span >= 28 * DAY && span <= 31 * DAY && from.day.endsWith('-01') && from.time === '00:00';
  if (month) {
    expect(to, `${path} ends on the next 1st`).toEqual({ day: to.day.slice(0, 8) + '01', time: '00:00' });
    return;
  }
  const off = span % (7 * DAY);
  if (span < 7 * DAY - HOUR || (off > HOUR && off < 7 * DAY - HOUR)) return;
  expect(from.time, `${path} starts at midnight (${w.from})`).toBe('00:00');
  expect(weekday(from.day), `${path} starts on a Monday (${w.from})`).toBe(1);
  expect(to.time, `${path} ends at midnight (${w.to})`).toBe('00:00');
  expect(weekday(to.day), `${path} ends on a Monday (${w.to})`).toBe(1);
}

/** How many of `days` a week's printed days hold. */
const inWeek = (w: Window, days: string[]) => days.filter((d) => d >= dayOf(w.from) && d < dayOf(w.to)).length;

it('names the console\'s timezone as its own', async () => {
  expect((await import('../scripts/fake-gateway/clock.ts')).TIMEZONE).toBe(app.timezone);
});

describe.each(MOMENTS)('the fake read at %s', (moment) => {
  let answers: Record<string, any>;
  // One moment at a time: the modules are read afresh under each pinned clock.
  beforeAll(async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(moment));
    const [{ ME }, bugs, releases, usage, knowledge, home, record, approvals, activity, runs] = await Promise.all([
      import('../scripts/fake-gateway/people.ts'), import('../scripts/fake-gateway/platform-bugs.ts'),
      import('../scripts/fake-gateway/platform-releases.ts'), import('../scripts/fake-gateway/platform-usage.ts'),
      import('../scripts/fake-gateway/platform-knowledge.ts'), import('../scripts/fake-gateway/work-home.ts'),
      import('../scripts/fake-gateway/work-record.ts'), import('../scripts/fake-gateway/work-approvals.ts'),
      import('../scripts/fake-gateway/work-activity.ts'), import('../scripts/fake-gateway/work-runs.ts'),
    ]);
    vi.useRealTimers();
    const q = (s: string) => new URLSearchParams(s);
    const every = { state: null, impact: null, surface: null };
    answers = {
      Status: bugs.statusFor(true, 'atlas'), Releases: releases.releases(100, 0), Bugs: bugs.bugs(true, every, 100, 0),
      Usage: usage.usage(true), 'Knowledge health': knowledge.knowledge(true, 'atlas'), Home: home.home(ME),
      'Record, a quarter': record.record(ME, q('period=quarter&limit=100'))[1], 'Record, a year': record.record(ME, q('period=year&limit=100'))[1],
      Approvals: approvals.approvals(ME, q('tab=history&limit=100'))[1], Activity: activity.activitySummary(ME)[1],
      'Activity log': activity.activityLog(ME, q('kind=tool_call&limit=100'))[1], Runs: runs.runs(ME, q('limit=100'))[1],
    };
  });

  it.each(['Status', 'Releases', 'Bugs', 'Usage', 'Knowledge health', 'Home', 'Record, a quarter', 'Record, a year', 'Approvals', 'Activity', 'Runs'])(
    '%s cuts every week on Monday 00:00 where the console prints it, and says which timezone that is', (name) => {
      const answer = answers[name];
      // A bug cohort names its week by the instant it starts.
      const cohorts: string[] = (Array.isArray(answer.cohorts) ? answer.cohorts : []).map((c: { week: string }) => c.week);
      cohorts.forEach((week, i) => expect(printed(week), `cohort ${i} starts on a Monday at midnight (${week})`).toEqual({ day: printed(week).day, time: '00:00' }));
      cohorts.forEach((week) => expect(weekday(printed(week).day)).toBe(1));
      const windows = windowsOf(answer);
      if (name !== 'Runs') expect(cohorts.length > 0 || windows.some((d) => Date.parse(d.window.to) - Date.parse(d.window.from) === 7 * DAY || d.path.includes('ByWeek'))).toBe(true);
      windows.forEach((d) => expectCalendar(d, answer.meta.asOf));
      expect(answer.meta.timezone).toBe(app.timezone);
    });

  it('counts every dated row in the week its date is printed in', () => {
    const a = answers;
    // Approvals: a row dated by its day alone is that day.
    const approved = a.Approvals.history.data.rows.map((r: { approvedAt: string }) => (r.approvedAt.length === 10 ? r.approvedAt : dayOf(r.approvedAt)));
    expect(approved).toHaveLength(a.Approvals.history.data.total);
    expect(a.Approvals.weeks.map((w: { numerator: number }) => w.numerator)).toEqual(a.Approvals.weeks.map((w: { window: Window }) => inWeek(w.window, approved)));
    expect(a.Home.approvals.data.weeks).toEqual(a.Approvals.weeks);
    // Releases, by the day the table prints each tag on.
    const tagged = a.Releases.rows.data.rows.map((r: { releasedAt: string }) => dayOf(r.releasedAt));
    expect(a.Releases.weeks.map((w: { releases: number }) => w.releases)).toEqual(a.Releases.weeks.map((w: { window: Window }) => inWeek(w.window, tagged)));
    // Bugs, a cohort being the reports filed in its week.
    const filed = a.Bugs.queue.data.rows.map((r: { filedAt: string }) => dayOf(r.filedAt));
    const weeks: Window[] = a.Status.measures[0].weeks.map((w: { window: Window }) => w.window);
    expect(a.Bugs.cohorts.map((c: { week: string }) => c.week)).toEqual(weeks.map((w) => w.from));
    expect(a.Bugs.cohorts.map((c: { filed: { value: number } }) => c.filed.value)).toEqual(weeks.map((w) => inWeek(w, filed)));
    // Activity: the calls by week, and the log's calls by the day each is printed on.
    const calls = a['Activity log'].rows.map((r: { ts: string }) => dayOf(r.ts));
    expect(calls).toHaveLength(a['Activity log'].total);
    const byWeek = a.Activity.weeks.data;
    expect(byWeek.map((w: { calls: number }) => w.calls)).toEqual(byWeek.map((w: { window: Window }) => inWeek(w.window, calls)));
    // Home: its last week's closures, each printed in that week.
    const closed = a.Home.closedLastWeek.data.map((r: { closedAt: string }) => dayOf(r.closedAt));
    expect(a.Home.tiles.closed.numerator).toBe(closed.length);
    expect(inWeek(a.Home.tiles.closed.window, closed)).toBe(closed.length);
    // Record: closures by week from its own table, and its runs by the day each started on, every day of its period.
    const record = a['Record, a quarter'];
    const closures = record.record.data.rows.filter((r: { closed: string | null }) => r.closed !== null && r.closed >= record.meta.period.from)
      .map((r: { closed: string }) => dayOf(r.closed));
    expect(record.work.data.closuresByWeek.map((w: Record<string, { value: number }>) => w.accepted.value + w.delivered.value + w.abandoned.value))
      .toEqual(record.work.data.closuresByWeek.map((w: { window: Window }) => inWeek(w.window, closures)));
    const days = record.agents.data.days as { day: string; runs: number }[];
    expect(days.at(-1)!.day).toBe(dayOf(record.meta.asOf));
    days.slice(1).forEach((d, i) => expect(Date.parse(`${d.day}T00:00:00Z`) - Date.parse(`${days[i].day}T00:00:00Z`)).toBe(DAY));
    const began = Date.parse(record.meta.coverageFrom);
    const started = a.Runs.recent.data.rows.filter((r: { startedAt: string }) => Date.parse(r.startedAt) >= Math.max(began, Date.parse(record.meta.period.from)))
      .map((r: { startedAt: string }) => dayOf(r.startedAt));
    expect(days.map((d) => d.runs)).toEqual(days.map((d) => started.filter((s: string) => s === d.day).length));
    // Status: each door's days are the printed days, from the first week's Monday through today.
    for (const door of a.Status.doors.data) {
      expect(door.days[0].date).toBe(dayOf(weeks[0].from));
      expect(door.days.at(-1).date).toBe(dayOf(a.Status.meta.asOf));
    }
  });
});

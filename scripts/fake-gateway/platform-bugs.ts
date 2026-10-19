/**
 * The fake gateway's bug reports: what `GET /api/console/platform/bugs`, `/platform/bugs/:id` and
 * `/platform/bugs/:id/duplicates` answer, and how `POST /platform/bugs/:id/resolve` is refused or accepted.
 *
 * One fixture, the reports as the superadmin reads them. A member's answer is derived from it by the gateway's
 * projection rules and never written by hand: the title is the spec's, `Report concerning <canonical surface>` or
 * `Platform issue reported`, with the impact, state and dates as their own fields, an unknown surface is null, and no
 * raw title, detail, team, resolution or duplicate target reaches them.
 *
 * The reports cover the states the page draws: an open report that blocks work, cohorts with reports still open, a
 * surface outside the vocabulary (titled `Platform issue reported`), one with no surface, a report with no team, and
 * one of each resolution, including a duplicate of another report of its team. A journey session's resolution is kept
 * for that session, in its queue, its report and its Status (journey.ts). Status is answered from here because it
 * counts both the reports and the approvals queue, which imports the status fixture.
 *
 * COUPLED: zz-stack's `checks/console-platform-bugs.ts` imports this file with plain `node` and compares its key sets
 * with the real routes' answers, and `canonicalSurface` copies the rule `services/gateway/src/console/platform-bugs.ts`
 * holds behind one function. So nothing here is imported through the console's path alias, and every part is `ok`.
 */
import type { AdminBugRow, BugReport, BugResolveInput, Bugs, Figure, PlatformStatus, PublicBugRow } from '../../src/lib/platform-shapes.ts';
import { ago, now } from './clock.ts';
import { kept } from './journey.ts';
import { ME } from './people.ts';
import { BUGS_OPEN, CHECKED, MEMBER_STATUS, type NeedInstance, PLATFORM_STATUS, approvalsNeed, needsOf } from './platform-status.ts';
import { TEAMS } from './platform-teams.ts';
import { waitingOf } from './work-approvals.ts';

/** The vocabulary a surface is canonical in: tool names the three doors register, the door names, and `console`. */
const VOCABULARY = new Set([
  'core', 'manage', 'eval', 'console',
  'bug_report', 'bug_resolve', 'document_approve', 'document_edit', 'document_read', 'document_write', 'initiative_close',
  'initiative_open', 'knowledge_add', 'knowledge_search', 'skill_read', 'pat_issue', 'team_switch', 'whoami', 'finding_record',
]);

/** A stored surface, lower-cased with a leading door prefix dropped, when it is then exactly a word of the vocabulary;
 *  null otherwise, so free text is never echoed. */
export function canonicalSurface(surface: string | null): string | null {
  const word = (surface ?? '').trim().toLowerCase().replace(/^(core|manage|eval):/, '');
  return VOCABULARY.has(word) ? word : null;
}

/** A report filed `at` hours into the week `week` weeks before the running one, and resolved `resolvedAfter` hours
 *  later. Every report is in a week that has ended, so the cohorts hold the same reports whatever day verify runs. */
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** The running week's start, as the status fixture's weeks have it. */
const RUNNING = Date.parse(PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.weeks.at(-1)!.window.from);

type Seed = Omit<BugReport, 'reportedAt' | 'resolvedAt'> & { week: number; at: number; resolvedAfter: number | null };

const SEEDS: Seed[] = [
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01', title: 'document_approve refuses a stakeholder the frontmatter names', detail: 'Approving spec.md answers that no stakeholder is set, though the frontmatter names one.',
    surface: 'core:Document_Approve', impact: 'blocks_work', status: 'open', platformVersion: '0.97.0', week: 1, at: 10, resolvedAfter: null, resolution: null, duplicateOf: null, team: 'atlas' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d02', title: 'Approve answers twice when the button is pressed twice', detail: 'The second press reports the first approval as a failure.',
    surface: 'document_approve', impact: 'confusing', status: 'duplicate', platformVersion: '0.97.0', week: 1, at: 12, resolvedAfter: 2, resolution: 'The same refusal as the stakeholder report.', duplicateOf: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01', team: 'atlas' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d03', title: "Search ranks Beacon Payments' archived ledger above the live one", detail: 'Asking for the ledger returns the archived copy first.',
    surface: 'Knowledge_Search', impact: 'wrong_result', status: 'open', platformVersion: '0.96.0', week: 2, at: 30, resolvedAfter: null, resolution: null, duplicateOf: null, team: 'beacon' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d04', title: 'The search page in beacon shows an empty state while it loads', detail: 'For a second the page says nothing was found.',
    surface: 'the search page in beacon', impact: 'confusing', status: 'open', platformVersion: '0.96.0', week: 3, at: 50, resolvedAfter: null, resolution: null, duplicateOf: null, team: 'beacon' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d05', title: 'team_switch keeps the old team in the console header', detail: 'The header still names the previous team until a reload.',
    surface: 'manage', impact: 'wrong_result', status: 'fixed', platformVersion: '0.95.2', week: 3, at: 20, resolvedAfter: 50, resolution: 'Fixed in 0.96.0: the header reads the active team on every navigation.', duplicateOf: null, team: 'atlas' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d06', title: 'The console rail overlaps the page at 320 pixels', detail: 'At the narrowest width the rail covers the first column.',
    surface: 'console', impact: 'cosmetic', status: 'fixed', platformVersion: '0.95.2', week: 4, at: 5, resolvedAfter: 20, resolution: 'Fixed in 0.96.0.', duplicateOf: null, team: null },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d07', title: 'The core door answers 404 for /core/mcp/ with a slash', detail: 'A trailing slash is not the address the client was given.',
    surface: '/core/mcp', impact: 'confusing', status: 'not_a_bug', platformVersion: '0.95.2', week: 4, at: 40, resolvedAfter: 10, resolution: 'The address has no trailing slash; the client setup names it without one.', duplicateOf: null, team: 'beacon' },
  { id: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d08', title: 'A report filed with no surface named', detail: 'Something looked wrong after the last release.',
    surface: null, impact: 'cosmetic', status: 'open', platformVersion: '0.95.2', week: 5, at: 60, resolvedAfter: null, resolution: null, duplicateOf: null, team: null },
];

/** Every report as its own page reads it, the superadmin's alone. */
export const REPORTS: BugReport[] = SEEDS.map(({ week, at, resolvedAfter, ...r }) => {
  const filed = RUNNING - week * 7 * 24 * HOUR + at * HOUR;
  return { ...r, reportedAt: iso(filed), resolvedAt: resolvedAfter === null ? null : iso(filed + resolvedAfter * HOUR) };
});

/** Every report as the request's session reads it: a journey's resolutions applied, the fixture's own otherwise. */
function reports(): BugReport[] {
  const done = kept()?.resolved ?? [];
  if (!done.length) return REPORTS;
  return REPORTS.map((r) => {
    const d = done.find((x) => x.id === r.id);
    return d ? { ...r, status: d.status, resolution: d.resolution, duplicateOf: d.duplicateOf, resolvedAt: d.at } : r;
  });
}

/** The spec's public bug title: `Report concerning <canonical surface>`, or `Platform issue reported` for a surface
 *  outside the vocabulary or none. COUPLED: the gateway's `publicTitle`. */
export const publicTitle = (surface: string | null): string => (surface === null ? 'Platform issue reported' : `Report concerning ${surface}`);

/** The safe row, the same for everybody: the public title of its canonical surface, and typed metadata. */
function publicRow(r: BugReport): PublicBugRow {
  const surface = canonicalSurface(r.surface);
  return {
    id: r.id, title: publicTitle(surface),
    impact: r.impact as PublicBugRow['impact'], surface, filedAt: r.reportedAt, platformVersion: r.platformVersion,
    status: r.status as PublicBugRow['status'], resolvedAt: r.resolvedAt,
  };
}
const adminRow = (r: BugReport): AdminBugRow => ({ ...publicRow(r), internalTitle: r.title, team: r.team });

const IMPACTS = ['blocks_work', 'wrong_result', 'confusing', 'cosmetic'] as const;
const STATES = ['open', 'resolved'] as const;

/** What the queue may be narrowed by; each a closed list, so nothing a caller types is echoed into a query. */
export type BugFilter = { state: string | null; impact: string | null; surface: string | null };

/** The filter's refusal, or null when every value is one the read knows. */
export function badFilter(f: BugFilter): string | null {
  if (f.state !== null && !(STATES as readonly string[]).includes(f.state)) return `state must be one of ${STATES.join(', ')}`;
  if (f.impact !== null && !(IMPACTS as readonly string[]).includes(f.impact)) return `impact must be one of ${IMPACTS.join(', ')}`;
  if (f.surface !== null && !VOCABULARY.has(f.surface)) return 'surface must be a tool, a door or console';
  return null;
}

const hours = (r: BugReport) => (Date.parse(r.resolvedAt!) - Date.parse(r.reportedAt)) / HOUR;
function median(values: number[]): Figure {
  if (!values.length) return { value: null, why: 'no_data' };
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return { value: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2, why: null };
}
const count = (value: number): Figure => ({ value, why: null });

/** `GET /platform/bugs`: the counts, the weekly cohorts and one page of the queue, newest first. The superadmin's rows
 *  add the internal title and the team; a member's are the safe row alone. */
export function bugs(admin: boolean, filter: BugFilter, limit: number, offset: number): Bugs {
  const asOf = ago(0);
  const all = reports();
  const open = all.filter((r) => r.status === 'open');
  const resolved = all.filter((r) => r.status !== 'open');
  const tally = <K extends string>(keys: readonly K[], of: (r: BugReport) => string) =>
    Object.fromEntries(keys.map((k) => [k, all.filter((r) => of(r) === k).length])) as Record<K, number>;
  const queue = all
    .filter((r) => filter.state === null || (filter.state === 'open') === (r.status === 'open'))
    .filter((r) => filter.impact === null || r.impact === filter.impact)
    .filter((r) => filter.surface === null || canonicalSurface(r.surface) === filter.surface)
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id));
  const { meta } = PLATFORM_STATUS;
  const calls = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!;
  return {
    meta: { ...meta, asOf, period: { from: meta.coverageFrom!, to: asOf }, scope: admin ? 'platform-admin' : 'platform-public', population: 'real bug reports' },
    counts: { state: 'ok', data: {
      open: open.length, resolved: resolved.length,
      byImpact: tally(IMPACTS, (r) => r.impact), byStatus: tally(['open', 'fixed', 'not_a_bug', 'duplicate'] as const, (r) => r.status),
    } },
    oldestOpenAt: open.map((r) => r.reportedAt).sort()[0] ?? null,
    medianResolveHours: median(resolved.map(hours)),
    // A cohort is the reports filed in one week, and its calls are that week's real-work calls, as Status counts them.
    cohorts: calls.weeks.map(({ window, denominator }) => {
      const filed = all.filter((r) => r.reportedAt >= window.from && r.reportedAt < window.to);
      const done = filed.filter((r) => r.status !== 'open');
      return {
        week: window.from, filed: count(filed.length), resolved: count(done.length), stillOpen: count(filed.length - done.length),
        filedPer1000: !denominator ? { value: null, why: 'no_data' } : { value: (1000 * filed.length) / denominator, why: denominator < 30 ? 'insufficient' : null },
        medianResolveHours: median(done.map(hours)),
      };
    }),
    queue: { state: 'ok', data: { rows: queue.slice(offset, offset + limit).map(admin ? adminRow : publicRow), total: queue.length } },
  };
}

/** `GET /platform/bugs/:id`, the superadmin's alone, its surface spelt as the queue spells it when it is a word of the
 *  vocabulary and as stored otherwise; null for an id that names no report. */
export function bugReport(id: string): BugReport | null {
  const r = reports().find((x) => x.id === id);
  return r ? { ...r, surface: canonicalSurface(r.surface) ?? r.surface } : null;
}

/** `GET /platform/bugs/:id/duplicates`: the reports `bug_resolve` would accept as this one's target, which are the other
 *  reports of its team, a report with no team matching another with none. */
export function duplicates(id: string): { rows: { id: string; title: string; status: string; reportedAt: string }[] } | null {
  const self = bugReport(id);
  if (!self) return null;
  return { rows: reports().filter((r) => r.id !== id && r.team === self.team)
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id))
    .map((r) => ({ id: r.id, title: r.title, status: r.status, reportedAt: r.reportedAt })) };
}

/**
 * `POST /platform/bugs/:id/resolve` for a report that exists, as the gateway maps `bug_resolve`'s reply: 204 and
 * forgotten on success, 409 with the first decision's sentence for a report already closed, and 400 with zz-core's own
 * text for every other refusal, checked in zz-core's order (the body, then the target, then the report's state). The
 * body is a `BugResolveInput` as sent, every field still unchecked.
 */
export function resolve(report: BugReport, body: { [K in keyof BugResolveInput]?: unknown }): [status: number, body: unknown] {
  const { status, resolution, duplicate_of: target } = body;
  if (status !== 'fixed' && status !== 'not_a_bug' && status !== 'duplicate') {
    return [400, { error: 'status: Invalid enum value. Expected \'fixed\' | \'not_a_bug\' | \'duplicate\'' }];
  }
  if (typeof resolution !== 'string' || !resolution.trim()) return [400, { error: 'ERROR: a resolution says what was decided and why — it cannot be blank' }];
  if (status === 'duplicate') {
    if (typeof target !== 'string' || !target) return [400, { error: 'ERROR: a `duplicate` resolution has to name the report it duplicates — pass the other report\'s id as duplicate_of' }];
    const other = bugReport(target);
    if (!other) return [400, { error: `ERROR: no bug with id ${target}` }];
    if (other.id === report.id) return [400, { error: `ERROR: bug ${report.id} cannot duplicate itself` }];
    if (other.team !== report.team) return [400, { error: `ERROR: bug ${report.id} cannot duplicate bug ${target} — a duplicate is read within one team's reports` }];
  } else if (target !== undefined && target !== null) {
    return [400, { error: `ERROR: \`duplicate_of\` is only for a \`duplicate\` resolution, and this one is \`${status}\`` }];
  }
  if (report.status !== 'open') {
    return [409, { error: `ERROR: that report was already closed as \`${report.status}\` by ${ME.email} — "${report.resolution}". If that decision was wrong, file what you now know as a new report naming this id, rather than overwriting somebody's reasoning.` }];
  }
  return [204, null];
}

const said = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const BUCKET = { fixed: 'fixed', not_a_bug: 'notABug', duplicate: 'duplicate' } as const;
/** How long a revision may wait before it needs somebody. */
const WAIT_MS = 14 * 24 * HOUR;

/**
 * `GET /platform/status` as the superadmin or a member reads it, acting for `team`: the status fixture's, with what
 * needs attention counted from the request's own reads as the gateway counts it (console/platform-needs.ts). One bugs
 * line while a report is open, critical while one blocks work and saying how many are open, gone when none is; one
 * approvals line per team whose queue (`waitingOf`, the rows Approvals answers) holds a revision presented 14 days or
 * more before the fake's clock, as the gateway reads `pendingRevisions`; the doors' and evaluation's as the fixture
 * found them. A journey session's resolutions and approvals are in those reads, so they move its Status alone, and the
 * reader's team's bug counts move a report from open to how it ended. Outside a journey it equals the fixture's object.
 */
export function statusFor(superadmin: boolean, team: string | null): PlatformStatus {
  const status = superadmin ? PLATFORM_STATUS : MEMBER_STATUS;
  const open = reports().filter((r) => r.status === 'open');
  const blocking = open.filter((r) => r.impact === 'blocks_work').length;
  const line: NeedInstance[] = open.length ? [{
    kind: 'bugs', key: 'bugs', tone: blocking ? 'critical' : 'warning', instanceCount: 1, oldestAt: open.map((r) => r.reportedAt).sort()[0], href: BUGS_OPEN,
    title: 'Bug reports are open', detail: `${said(open.length, 'open report', 'open reports')}, ${blocking} blocking work`,
  }] : [];
  const cutoff = now() - WAIT_MS;
  const waiting = TEAMS.flatMap((t) => {
    const late = waitingOf(t.slug).filter((w) => Date.parse(w.waitingSince) <= cutoff);
    return late.length ? [approvalsNeed(t.slug, late.map((w) => w.waitingSince))] : [];
  });
  const needs = needsOf([...line, ...CHECKED.filter((n) => n.kind !== 'bugs'), ...waiting], superadmin);
  const own = status.own.state === 'ok' ? { ...status.own.data.bugs } : null;
  for (const d of kept()?.resolved ?? []) {
    const was = REPORTS.find((r) => r.id === d.id);
    if (own && was?.status === 'open' && was.team === team) { own.open -= 1; own[BUCKET[d.status]] += 1; }
  }
  return {
    ...status, needs,
    own: status.own.state === 'ok' && own ? { state: 'ok', data: { ...status.own.data, bugs: own } } : status.own,
  };
}

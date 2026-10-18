// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DocumentDetail } from '../src/lib/api-shapes.ts';
import type { PlatformStatus } from '../src/lib/platform-shapes.ts';
import type { Approvals, WaitingRow } from '../src/lib/work-shapes.ts';
import { ago } from '../scripts/fake-gateway/clock.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { statusFor } from '../scripts/fake-gateway/platform-bugs.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { TEAMS } from '../scripts/fake-gateway/platform-teams.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * The fake's Status names the approvals waiting that the approvals queue holds (AC-8.3), as the gateway derives both
 * from `pendingRevisions`: one need per team with a revision presented 14 days or more before the cutoff and not
 * approved, its count, its oldest wait and its words, the superadmin's naming the team and a member's folding every
 * team into one row. A journey's approval leaves the queue, so that session's need goes with it, while every other
 * session reads what it read before.
 */
let gateway: { base: string; proc: ChildProcess };
beforeAll(async () => { gateway = await startFakeGateway(); });
afterAll(() => gateway?.proc.kill());

type Need = PlatformStatus['needs']['rows'][number];
const DAY = 24 * 3_600_000;

const call = async <T,>(value: string, path: string, body?: unknown): Promise<{ status: number; body: T }> => {
  const res = await fetch(`${gateway.base}/api/console${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: `zz_console=${value}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
};
const read = async <T,>(value: string, path: string) => {
  const answer = await call<T>(value, path);
  expect(answer.status, `${value} ${path}`).toBe(200);
  return answer.body;
};

/** Every row Approvals' Waiting answers a caller acting for `team`, as this process's fixture holds it. */
function queueOf(team: string): WaitingRow[] {
  const [status, body] = approvals({ ...ME, activeTeam: team }, new URLSearchParams({ tab: 'waiting', limit: '100' }));
  expect(status).toBe(200);
  const waiting = (body as Approvals).waiting;
  return waiting.state === 'ok' ? waiting.data.rows : [];
}

/**
 * The teams whose queue holds a revision presented 14 days or more before the cutoff, the longest waiting first, each
 * with that count and its oldest wait. Both the queue and the cutoff are offsets from a process's start (clock.ts), so
 * the server's instants are this process's moved by the gap between the two cutoffs, to the second.
 */
function lateTeams(asOf: string, minus: (team: string, rows: WaitingRow[]) => WaitingRow[] = (_, r) => r) {
  const shift = Date.parse(asOf) - Date.parse(ago(0));
  const at = (instant: string) => new Date(Date.parse(instant) + shift).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return TEAMS.map((t) => {
    const late = minus(t.slug, queueOf(t.slug)).filter((w) => Date.parse(w.waitingSince) <= Date.parse(ago(0)) - 14 * DAY);
    return { team: t.slug, count: late.length, oldestAt: late.length ? at(late.map((w) => w.waitingSince).sort()[0]) : null };
  }).filter((t) => t.count > 0).sort((a, b) => a.oldestAt!.localeCompare(b.oldestAt!) || a.team.localeCompare(b.team));
}

const approvalRows = (needs: PlatformStatus['needs']): Need[] => needs.rows.filter((r) => r.kind === 'approvals');
/** Every instance a reading counts: its rows' and the overflow's, which add up to its total. */
const instances = (needs: PlatformStatus['needs']) =>
  needs.rows.reduce((n, r) => n + r.instanceCount, 0) + Object.values(needs.overflowByKind).reduce((n, c) => n + (c ?? 0), 0);

/** The superadmin's approvals need is one row per late team, in their order, and the overflow counts the rest. */
function expectSuperadmin(needs: PlatformStatus['needs'], late: ReturnType<typeof lateTeams>) {
  const rows = approvalRows(needs);
  expect(rows.map((r) => ({ team: r.title.replace('Approvals are waiting in ', ''), count: Number(/^\d+/.exec(r.detail)![0]), oldestAt: r.oldestAt })))
    .toEqual(late.slice(0, rows.length));
  for (const [i, r] of rows.entries()) {
    const n = late[i].count;
    expect(r).toEqual({ kind: 'approvals', tone: 'warning', instanceCount: 1, oldestAt: late[i].oldestAt, href: `/platform/teams/${late[i].team}`,
      title: `Approvals are waiting in ${late[i].team}`, detail: `${n} ${n === 1 ? 'revision was' : 'revisions were'} presented 14 days ago or more and not approved` });
  }
  expect(rows.length + (needs.overflowByKind.approvals ?? 0)).toBe(late.length);
  expect(needs.rows.length).toBeLessThanOrEqual(5);
  expect(instances(needs)).toBe(needs.total);
  expect(needs.knownCount).toBe(needs.total);
  expect(needs.headline).toBe(needs.total === 0 ? 'Nothing needs you' : `${needs.total} ${needs.total === 1 ? 'thing needs' : 'things need'} you`);
}

/** A member's is one row for every late team, naming none and linking nowhere, the oldest wait of them all. */
function expectMember(needs: PlatformStatus['needs'], late: ReturnType<typeof lateTeams>, total: number | null) {
  const n = late.length;
  expect(approvalRows(needs)).toEqual(n === 0 ? [] : [{
    kind: 'approvals', tone: 'warning', instanceCount: n, oldestAt: late[0].oldestAt, href: null,
    title: `Approvals are waiting in ${n} ${n === 1 ? 'team' : 'teams'}`,
    detail: `${n} ${n === 1 ? 'team has' : 'teams have'} a revision presented 14 days ago or more and not approved`,
  }]);
  expect(needs.overflowByKind.approvals).toBeUndefined();
  expect(needs.total).toBe(total);
  expect(instances(needs)).toBe(needs.total);
  expect(needs.headline).toBe(total === 0 ? 'No known open issues' : `${total} ${total === 1 ? 'thing is' : 'things are'} known and open`);
}

describe("the fake's Status names the approvals waiting that the approvals queue holds", () => {
  it('answers each person the queue\'s revisions presented 14 days or more before the cutoff, by team, with the headline and overflow following', async () => {
    const admin = await read<PlatformStatus>('superadmin', '/platform/status');
    const late = lateTeams(admin.meta.asOf);
    expect(late.length).toBeGreaterThan(0);
    expectSuperadmin(admin.needs, late);
    const member = await read<PlatformStatus>('member', '/platform/status');
    expectMember(member.needs, late, admin.needs.total);
  });

  it('is the fixture\'s own Status outside a journey, so a page drawn from the fixture reads what the server answers', () => {
    expect(statusFor(true, 'atlas')).toEqual(PLATFORM_STATUS);
    expect(statusFor(false, 'atlas')).toEqual(MEMBER_STATUS);
  });

  it('counts one fewer for the journey session that approved a late revision, and none fewer for anybody else', async () => {
    const JOURNEY = 'superadmin+journey';
    const plain = { admin: await read<PlatformStatus>('superadmin', '/platform/status'), member: await read<PlatformStatus>('member', '/platform/status') };
    const before = await read<PlatformStatus>(JOURNEY, '/platform/status');
    const late = lateTeams(before.meta.asOf);
    expectSuperadmin(before.needs, late);

    // The queue's longest wait is atlas's, and the superadmin acts for atlas.
    const oldest = (await read<Approvals>(JOURNEY, '/approvals?tab=waiting')).waiting;
    if (oldest.state !== 'ok') throw new Error('the queue did not answer');
    const target = oldest.data.rows[0];
    expect(Date.parse(target.waitingSince)).toBeLessThanOrEqual(Date.parse(before.meta.asOf) - 14 * DAY);
    // zz-core records no presentation of this revision (work.ts `unrecordable`), so it is shown no context of its own;
    // the fake answers one context for every presentation, so another document's showing signs it. The first other
    // document that is shown is that one (one of them moves under its reader, and is answered 409).
    let context: string | null = null;
    for (const other of oldest.data.rows.filter((w) => w.initiative !== target.initiative)) {
      const otherDoc = await read<DocumentDetail>(JOURNEY, `/document/atlas/${other.initiative}/${other.path}`);
      const shown = await call<{ review_context: string }>(JOURNEY, '/documents/shown?team=atlas', { initiative: other.initiative, path: other.path, content_revision: otherDoc.content_revision });
      if (shown.status === 200) { context = shown.body.review_context; break; }
    }
    expect(context).not.toBeNull();
    const doc = await read<DocumentDetail>(JOURNEY, `/document/atlas/${target.initiative}/${target.path}`);
    const approved = await call(JOURNEY, '/documents/approve?team=atlas', { initiative: target.initiative, path: target.path, expected_revision: doc.content_revision, review_context: context });
    expect(approved.status).toBe(200);

    const after = await read<PlatformStatus>(JOURNEY, '/platform/status');
    const less = lateTeams(after.meta.asOf, (team, rows) => (team === 'atlas' ? rows.filter((w) => w.initiative !== target.initiative || w.path !== target.path) : rows));
    expect(less.reduce((n, t) => n + t.count, 0)).toBe(late.reduce((n, t) => n + t.count, 0) - 1);
    expectSuperadmin(after.needs, less);
    expect(after.needs.total).toBe(before.needs.total! - (late.length - less.length));

    expect(await read<PlatformStatus>('superadmin', '/platform/status')).toEqual(plain.admin);
    expect(await read<PlatformStatus>('member', '/platform/status')).toEqual(plain.member);
  });
});

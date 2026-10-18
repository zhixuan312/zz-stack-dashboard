// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DocumentDetail } from '../src/lib/api-shapes.ts';
import type { TeamDetail, Teams } from '../src/lib/fleet-shapes.ts';
import type { Approvals } from '../src/lib/work-shapes.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * The fake's Teams counts a team's revisions waiting from the queue Approvals answers (AC-8.3), as the gateway counts
 * both from `pendingRevisions`: each row's waiting is the number of rows Approvals' Waiting answers somebody acting for
 * that team, the `pending` tile their sum, and a team's page its row's count. A journey's approval leaves the queue,
 * so that session's Teams counts the team one fewer, while every other session reads what it read before.
 */
let gateway: { base: string; proc: ChildProcess };
beforeAll(async () => { gateway = await startFakeGateway(); });
afterAll(() => gateway?.proc.kill());

const JOURNEY = 'superadmin+journey';
const PLAIN = 'superadmin';

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

/** How many rows Approvals' Waiting answers a caller acting for `team`, every page of it. */
function queued(team: string): number {
  const [status, body] = approvals({ ...ME, activeTeam: team }, new URLSearchParams({ tab: 'waiting', limit: '100' }));
  expect(status).toBe(200);
  const waiting = (body as Approvals).waiting;
  return waiting.state === 'ok' ? waiting.data.rows.length : -1;
}

/** Each team's waiting on the Teams list, by its slug. */
const waitingByTeam = (t: Teams) => Object.fromEntries(t.teams.map((r) => [r.slug, r.waiting]));

describe("the fake's Teams counts each team's revisions waiting from the approvals queue", () => {
  it("answers each team's waiting as its queue's rows, the pending tile their sum, and atlas's page the same", async () => {
    const list = await read<Teams>(PLAIN, '/teams?limit=100');
    expect(list.teams).toHaveLength(list.total);
    expect(waitingByTeam(list)).toEqual(Object.fromEntries(list.teams.map((r) => [r.slug, queued(r.slug)])));
    expect(list.teams.some((r) => r.waiting > 0)).toBe(true);
    expect(list.tiles.pending).toBe(list.teams.reduce((n, r) => n + queued(r.slug), 0));

    const atlas = await read<TeamDetail>(PLAIN, '/teams/atlas');
    expect(atlas.tiles.waiting).toBe(queued('atlas'));
    // The superadmin acts for atlas, so the queue the console's Approvals draws for them is atlas's.
    const own = await read<Approvals>(PLAIN, '/approvals?tab=waiting');
    expect(own.waiting.state === 'ok' && own.waiting.data.total).toBe(atlas.tiles.waiting);
  });

  it("counts atlas one fewer for the journey session that approved one of its revisions, and no fewer for anybody else", async () => {
    const before = await read<Teams>(JOURNEY, '/teams?limit=100');
    const page = await read<TeamDetail>(JOURNEY, '/teams/atlas');
    const plain = { list: await read<Teams>(PLAIN, '/teams?limit=100'), page: await read<TeamDetail>(PLAIN, '/teams/atlas') };

    const doc = await read<DocumentDetail>(JOURNEY, '/document/atlas/2026-09-28-search-relevance/plan.md');
    const shown = await call<{ review_context: string }>(JOURNEY, '/documents/shown?team=atlas', { initiative: doc.initiative, path: 'plan.md', content_revision: doc.content_revision });
    expect(shown.status).toBe(200);
    expect((await call(JOURNEY, '/documents/approve?team=atlas', { initiative: doc.initiative, path: 'plan.md', expected_revision: doc.content_revision, review_context: shown.body.review_context })).status).toBe(200);

    const after = await read<Teams>(JOURNEY, '/teams?limit=100');
    expect(waitingByTeam(after)).toEqual({ ...waitingByTeam(before), atlas: waitingByTeam(before).atlas - 1 });
    expect(after.tiles.pending).toBe(before.tiles.pending - 1);
    expect((await read<TeamDetail>(JOURNEY, '/teams/atlas')).tiles.waiting).toBe(page.tiles.waiting - 1);
    // The journey's Teams and its Approvals still read one queue.
    const queue = await read<Approvals>(JOURNEY, '/approvals?tab=waiting');
    expect(queue.waiting.state === 'ok' && queue.waiting.data.total).toBe(waitingByTeam(after).atlas);

    expect(await read<Teams>(PLAIN, '/teams?limit=100')).toEqual(plain.list);
    expect(await read<TeamDetail>(PLAIN, '/teams/atlas')).toEqual(plain.page);
  });
});

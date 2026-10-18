// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DocumentDetail, MyAccessToken } from '../src/lib/api-shapes.ts';
import type { Access } from '../src/lib/destination-shapes.ts';
import type { People } from '../src/lib/fleet-shapes.ts';
import type { Bugs, PlatformStatus } from '../src/lib/platform-shapes.ts';
import type { Approvals, InitiativeList, RecordRead } from '../src/lib/work-shapes.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * A journey's writes are its own (reconciliation 80): a session value `<person>+journey` keeps the writes that session
 * makes, and that session's next reads show them; every other session forgets every write, as the fixture always has.
 *
 * One fixture process, as `pnpm verify` runs one: a journey session writes each of the five writes a guide's task makes
 * (an approval, a close, a bug's resolution, a person added, a token issued) and reads them back, while a plain session
 * of the same person, and the other person's journey, read exactly what they read before any of it.
 */
let gateway: { base: string; proc: ChildProcess };
beforeAll(async () => { gateway = await startFakeGateway(); });
afterAll(() => gateway?.proc.kill());

const JOURNEY = 'superadmin+journey';
const PLAIN = 'superadmin';
const OTHER = 'member+journey';

const call = async <T,>(value: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> => {
  const res = await fetch(`${gateway.base}/api/console${path}`, {
    method: init.method ?? 'GET',
    headers: { cookie: `zz_console=${value}`, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T };
};
const read = async <T,>(value: string, path: string) => {
  const answer = await call<T>(value, path);
  expect(answer.status, `${value} ${path}`).toBe(200);
  return answer.body;
};

/** Every read a journey's writes change, by its path. */
const READS = [
  '/approvals?tab=waiting', '/approvals?tab=history', '/home', '/record', '/initiatives?q=result-explanations',
  '/platform/bugs', '/platform/status', '/people?q=journey', '/access', '/settings/me/tokens',
  '/document/atlas/2026-09-28-search-relevance/plan.md', '/initiatives/atlas/2026-10-08-result-explanations',
];
const BLOCKING = '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01';
const SLUG = '2026-10-08-result-explanations';

describe('a journey session keeps its own writes', () => {
  it('shows each of the five writes on its next reads, and changes nothing another session reads', async () => {
    // Each with its status: People is refused the member, and stays refused.
    const others = async () => Object.fromEntries(await Promise.all([PLAIN, OTHER].flatMap((v) => READS.map(async (p) => [`${v} ${p}`, await call(v, p)]))));
    const before = await others();

    const waiting = await read<Approvals>(JOURNEY, '/approvals?tab=waiting');
    const history = await read<Approvals>(JOURNEY, '/approvals?tab=history');
    const record = await read<RecordRead>(JOURNEY, '/record');
    const bugs = await read<Bugs>(JOURNEY, '/platform/bugs');
    const status = await read<PlatformStatus>(JOURNEY, '/platform/status');
    const people = await read<People>(JOURNEY, '/people');

    // An approval: shown, then approved under the context it answered.
    const doc = await read<DocumentDetail>(JOURNEY, '/document/atlas/2026-09-28-search-relevance/plan.md');
    const shown = await call<{ review_context: string }>(JOURNEY, '/documents/shown?team=atlas', { method: 'POST', body: { initiative: doc.initiative, path: 'plan.md', content_revision: doc.content_revision } });
    expect(shown.status).toBe(200);
    const approved = await call(JOURNEY, '/documents/approve?team=atlas', { method: 'POST', body: { initiative: doc.initiative, path: 'plan.md', expected_revision: doc.content_revision, review_context: shown.body.review_context } });
    expect(approved.status).toBe(200);
    // A close, a resolution, a person and a token.
    expect((await call<{ outcome: string }>(JOURNEY, `/initiatives/atlas/${SLUG}/close`, { method: 'POST', body: { disposition: 'finished' } })).body.outcome).toBe('accepted');
    expect((await call(JOURNEY, `/platform/bugs/${BLOCKING}/resolve`, { method: 'POST', body: { status: 'fixed', resolution: 'Fixed in 0.98.0: the stakeholder is read from the frontmatter.' } })).status).toBe(204);
    expect((await call(JOURNEY, '/settings/platform/people', { method: 'POST', body: { email: 'journey.person@example.com', display_name: 'Journey Person' } })).status).toBe(200);
    const token = await call<{ token: string }>(JOURNEY, '/settings/me/tokens', { method: 'POST', body: { label: 'journey laptop' } });
    expect(token.status).toBe(200);

    // The approval left the queue, the bell's read and Home's strip, and is the newest row of the history.
    const waitingAfter = await read<Approvals>(JOURNEY, '/approvals?tab=waiting');
    const waitingData = (a: Approvals) => (a.waiting.state === 'ok' ? a.waiting.data : null)!;
    expect(waitingData(waitingAfter).total).toBe(waitingData(waiting).total - 1);
    expect(waitingData(waitingAfter).rows.some((r) => r.initiative === doc.initiative && r.path === 'plan.md')).toBe(false);
    expect(waitingAfter.tiles.waiting).toBe(waiting.tiles.waiting! - 1);
    const historyData = (a: Approvals) => (a.history.state === 'ok' ? a.history.data : null)!;
    const historyAfter = await read<Approvals>(JOURNEY, '/approvals?tab=history');
    expect(historyData(historyAfter).total).toBe(historyData(history).total + 1);
    expect(historyData(historyAfter).rows[0]).toMatchObject({ initiative: doc.initiative, path: 'plan.md', presentation: 'console_revision_shown' });
    expect(await read<DocumentDetail>(JOURNEY, '/document/atlas/2026-09-28-search-relevance/plan.md')).toMatchObject({ status: 'approved', approved_by: 'ava.lindqvist@example.com' });
    const home = await read<{ waiting: { state: string; data: { count: number } } }>(JOURNEY, '/home');
    expect(home.waiting.data.count).toBe(waitingData(waiting).total - 1);

    // The close: the initiative is accepted, Record's closed count moved by one, and a second close is refused.
    const list = await read<InitiativeList>(JOURNEY, `/initiatives?q=${SLUG}`);
    expect(list.rows[0]).toMatchObject({ slug: SLUG, state: 'accepted' });
    expect(await read(JOURNEY, `/initiatives/atlas/${SLUG}`)).toMatchObject({ closed: true, outcome: 'accepted' });
    const recordAfter = await read<RecordRead>(JOURNEY, '/record');
    expect(recordAfter.foot.closed.value).toBe(record.foot.closed.value! + 1);
    expect(recordAfter.foot.approvalsInYourName.value).toBe(record.foot.approvalsInYourName.value! + 1);
    expect((await call(JOURNEY, `/initiatives/atlas/${SLUG}/close`, { method: 'POST', body: { disposition: 'finished' } })).status).toBe(409);

    // The resolution: the queue holds one open report fewer, the report reads fixed, and Status counts one fewer.
    const bugsAfter = await read<Bugs>(JOURNEY, '/platform/bugs');
    const counts = (b: Bugs) => (b.counts.state === 'ok' ? b.counts.data : null)!;
    expect(counts(bugsAfter).open).toBe(counts(bugs).open - 1);
    expect((await read<{ status: string }>(JOURNEY, `/platform/bugs/${BLOCKING}`)).status).toBe('fixed');
    const statusAfter = await read<PlatformStatus>(JOURNEY, '/platform/status');
    const line = (s: PlatformStatus) => s.needs.rows.find((r) => r.kind === 'bugs')!.detail;
    expect(line(status)).toBe('4 open reports, 1 blocking work');
    expect(line(statusAfter)).toBe('3 open reports, 0 blocking work');
    const own = (s: PlatformStatus) => (s.own.state === 'ok' ? s.own.data.bugs : null)!;
    expect(own(statusAfter)).toEqual({ ...own(status), open: own(status).open - 1, fixed: own(status).fixed + 1 });
    expect((await call(JOURNEY, `/platform/bugs/${BLOCKING}/resolve`, { method: 'POST', body: { status: 'fixed', resolution: 'Again.' } })).status).toBe(409);

    // The person, on People's list and its count; the token, on Access and in the person's tokens, by its label alone.
    const found = await read<People>(JOURNEY, '/people?q=journey');
    expect(found.people.map((p) => p.email)).toEqual(['journey.person@example.com']);
    expect((await read<People>(JOURNEY, '/people')).tiles.people).toBe(people.tiles.people + 1);
    expect((await read<Access>(JOURNEY, '/access')).issued.some((t) => t.label === 'journey laptop')).toBe(true);
    const tokens = await read<MyAccessToken[]>(JOURNEY, '/settings/me/tokens');
    expect(tokens.some((t) => t.label === 'journey laptop')).toBe(true);
    expect(JSON.stringify(tokens)).not.toContain(token.body.token);

    // Nobody else's reads moved: the same person's plain session, and the other person's journey.
    expect(await others()).toEqual(before);
    // The fake counts what each journey kept, which scripts/journeys.ts reads before it starts; a plain session is no journey.
    const written = async (value: string) => (await fetch(`${gateway.base}/api/console/__journey?session=${encodeURIComponent(value)}`));
    expect(await (await written(JOURNEY)).json()).toEqual({ session: JOURNEY, written: { approved: 1, closed: 1, resolved: 1, added: 1, issued: 1 } });
    expect(await (await written(OTHER)).json()).toEqual({ session: OTHER, written: { approved: 0, closed: 0, resolved: 0, added: 0, issued: 0 } });
    expect((await written(PLAIN)).status).toBe(400);
  });

  it('reads the normal state, and is not a state the fake draws', async () => {
    expect(await read(JOURNEY, '/runs')).toEqual(await read(PLAIN, '/runs'));
    const mode = await (await fetch(`${gateway.base}/api/console/__mode?set=journey`)).json() as { mode: string };
    expect(mode.mode).toBe('normal');
    expect((await fetch(`${gateway.base}/api/console/__nulls?session=${encodeURIComponent(JOURNEY)}&on=1`)).status).toBe(400);
  });
});

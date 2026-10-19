/**
 * The fake gateway as the gateway behaves between two of a page's reads: a document another session keeps revising is
 * hinted each time it gains a revision, and a team the live check renames is renamed for the session that asked alone.
 *
 * The real gateway's trigger (zz-stack's `services/gateway/migrations/003_console_live.sql`) tells every tab following
 * `document` on every revision a writer makes, so a page holding a document hears that it moved and reads it again. The
 * fake's drifting document (`scripts/fake-gateway/work.ts`) gains a revision every `DRIFT_MS`, and until this file it
 * said nothing: a page saw the newer snapshot only if a focus refetch happened to ask, which is how
 * scripts/approve-banners.ts came to wait on one that ZZ Meridian's 0.18.0 stream no longer causes.
 *
 * A rename is the asking session's because `verify` runs scripts/live-check.ts beside every other suite against one
 * fake: a rename every session saw was a changed name in states-check's captures, with no unavailable words beside it.
 *
 * Spawned rather than imported, as fake-gateway-server.test.ts is: the timer and the hook are what the server does
 * when it runs.
 */
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { DRIFT_MS } from '../scripts/fake-gateway/work.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

type Fixture = Awaited<ReturnType<typeof startFakeGateway>>;
const fixtures: Fixture[] = [];
const streams: AbortController[] = [];
afterEach(() => {
  for (const s of streams.splice(0)) s.abort();
  for (const f of fixtures.splice(0)) f.proc.kill();
});

async function start(): Promise<string> {
  const fixture = await startFakeGateway();
  fixtures.push(fixture);
  return fixture.base;
}

const DRIFTING = 'document/atlas/2026-10-03-ranking-weights/spec.md';
/** How long past one revision period a hint may take to arrive before the case says it never did. */
const LATE_MS = 3_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The drifting document as a read serves it: its snapshot, and the revision of `document` the answer carries. */
async function readDrifting(base: string): Promise<{ snapshot: string; revision: number; boot: string }> {
  const res = await fetch(`${base}/api/console/${DRIFTING}`);
  const header = res.headers.get('x-zz-revision') ?? '';
  const m = /^document:([A-Za-z0-9_-]+):(\d+)$/.exec(header);
  expect(m, `the read's revision header: ${header}`).not.toBeNull();
  return { snapshot: ((await res.json()) as { content_revision: string }).content_revision, boot: m![1], revision: Number(m![2]) };
}

/** A stream following `names`, as a tab opens one, and every event it is sent with the moment it arrived. */
function follow(base: string, names: string): { events: { event: string; data: string; at: number }[] } {
  const abort = new AbortController();
  streams.push(abort);
  const seen: { event: string; data: string; at: number }[] = [];
  void (async () => {
    const res = await fetch(`${base}/api/console/live?collections=${names}`, { signal: abort.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.+)$/m.exec(frame)?.[1];
        if (event) seen.push({ event, data: /^data: (.*)$/m.exec(frame)?.[1] ?? '', at: Date.now() });
      }
    }
  })().catch(() => {});
  return { events: seen };
}

/** The first `change` for `document` that arrived after `after`, waited for up to one revision period and `LATE_MS`. */
async function changeAfter(stream: { events: { event: string; data: string; at: number }[] }, after: number): Promise<number | null> {
  const deadline = Date.now() + DRIFT_MS + LATE_MS;
  while (Date.now() < deadline) {
    const found = stream.events.find((e) => e.event === 'change' && e.at > after && JSON.parse(e.data).collection === 'document');
    if (found) return found.at;
    await sleep(100);
  }
  return null;
}

describe('a document another session keeps revising, while the fake serves', () => {
  it('hints `document` once each revision period passes, and a read after the hint carries the newer snapshot and revision', async () => {
    const base = await start();
    const stream = follow(base, 'document');
    const before = await readDrifting(base);
    const read = Date.now();

    const first = await changeAfter(stream, read);
    expect(first, `no change for document within ${DRIFT_MS + LATE_MS} ms of a read, though the drifting document gains a revision every ${DRIFT_MS} ms`).not.toBeNull();
    const after = await readDrifting(base);
    expect(after.snapshot, 'the snapshot a read serves after the hint').not.toBe(before.snapshot);
    expect(after.boot).toBe(before.boot);
    expect(after.revision, 'the revision of document a read carries after the hint').toBeGreaterThan(before.revision);

    // The next period: one more hint, a period after the first, with the snapshot and the revision moving again.
    const second = await changeAfter(stream, first!);
    expect(second, `no second change for document within ${DRIFT_MS + LATE_MS} ms of the first`).not.toBeNull();
    expect(second! - first!).toBeGreaterThan(DRIFT_MS - 1_000);
    expect(second! - first!).toBeLessThan(DRIFT_MS + 2_000);
    const later = await readDrifting(base);
    expect(later.snapshot).not.toBe(after.snapshot);
    expect(later.revision).toBe(after.revision + 1);
  }, 2 * (DRIFT_MS + LATE_MS) + 10_000);

  it('holds no process open: the timer is started by a serving fake, and a process that starts it still exits', async () => {
    const script = `import { onDrift } from './scripts/fake-gateway/work.ts'; onDrift(() => {});`;
    const exit = await new Promise<number | null>((resolve) => {
      const proc = spawn('node', ['--input-type=module', '-e', script], { stdio: 'ignore' });
      const timer = setTimeout(() => { proc.kill(); resolve(null); }, 10_000);
      proc.on('exit', (code) => { clearTimeout(timer); resolve(code); });
    });
    expect(exit, 'a process that started the drift timer and nothing else was still running after 10 s').toBe(0);
  }, 15_000);
});

/** One read as one session value: the name it is answered for `dune`, in the list and on the team's own read. */
async function duneAs(base: string, session: string | null): Promise<{ listed: string | undefined; own: string | undefined }> {
  const headers: Record<string, string> = session === null ? {} : { cookie: `zz_console=${session}` };
  const list = await fetch(`${base}/api/console/teams?limit=100`, { headers });
  expect(list.status, `the teams list as ${session ?? 'no cookie'}`).toBe(200);
  const own = await fetch(`${base}/api/console/teams/dune`, { headers });
  expect(own.status, `dune's own read as ${session ?? 'no cookie'}`).toBe(200);
  return {
    listed: ((await list.json()) as { teams: { slug: string; name: string }[] }).teams.find((t) => t.slug === 'dune')?.name,
    own: ((await own.json()) as { team: { name: string } }).team.name,
  };
}

describe('a rename through the live check\'s hint', () => {
  it('is read under its new name by the session that asked, and under its own by every other session', async () => {
    const base = await start();
    // The live check's own session: a kind of session, as a journey is, reading the normal state.
    const asker = 'superadmin+live';
    expect(await duneAs(base, asker)).toEqual({ listed: 'Dune', own: 'Dune' });

    const hinted = await fetch(`${base}/api/console/__hint?collection=teams&rename=dune:${encodeURIComponent('Dune Renamed')}`, { headers: { cookie: `zz_console=${asker}` } });
    expect(((await hinted.json()) as { renamed: string | null }).renamed).toBe('dune');

    expect(await duneAs(base, asker)).toEqual({ listed: 'Dune Renamed', own: 'Dune Renamed' });
    // Every suite beside the live check: no cookie (the audit, the presses, the keyboard walk), a persona's own value,
    // states-check's normal capture and a journey.
    for (const other of [null, 'superadmin', 'superadmin+normal', 'superadmin+journey']) {
      expect(await duneAs(base, other), `as ${other ?? 'no cookie'}`).toEqual({ listed: 'Dune', own: 'Dune' });
    }

    // A second rename by the same session replaces its first; another session's rename is its own.
    await fetch(`${base}/api/console/__hint?collection=teams&rename=dune:Dune%20Again`, { headers: { cookie: `zz_console=${asker}` } });
    await fetch(`${base}/api/console/__hint?collection=teams&rename=dune:Dune%20Elsewhere`, { headers: { cookie: 'zz_console=superadmin' } });
    expect(await duneAs(base, asker)).toEqual({ listed: 'Dune Again', own: 'Dune Again' });
    expect(await duneAs(base, 'superadmin')).toEqual({ listed: 'Dune Elsewhere', own: 'Dune Elsewhere' });
    expect(await duneAs(base, null)).toEqual({ listed: 'Dune', own: 'Dune' });
  });

  it('answers the live check\'s session as the person before its `+`, in the normal state', async () => {
    const base = await start();
    const me = await fetch(`${base}/api/console/me`, { headers: { cookie: 'zz_console=superadmin+live' } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { superadmin: boolean }).superadmin).toBe(true);
    const plain = await (await fetch(`${base}/api/console/teams?limit=100`)).json();
    const live = await (await fetch(`${base}/api/console/teams?limit=100`, { headers: { cookie: 'zz_console=superadmin+live' } })).json();
    expect(live).toEqual(plain);
  });
});

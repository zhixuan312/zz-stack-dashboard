import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The fixture as a SERVER, which is how a sweep uses it.
 *
 * `fake-gateway-states.test.ts` covers the two modes that reshape an answer, because those are pure
 * functions. The other two are behaviours of the running server and had no check at all: `error`,
 * which makes every route except `/me` answer 503, and `slow`, which holds every answer four seconds.
 * This file's own note says why that matters — "a mode that throws is a mode nothing notices" — and
 * both of these are modes a person is told to sweep by hand, so a broken one misleads exactly the
 * person following the instruction.
 *
 * Spawned rather than imported: `server.ts` is a script, not a module with an exported handler, and
 * the thing under test is what it does when it runs.
 */
const servers: ChildProcess[] = [];

/** Start the fixture and wait for the address it prints. */
function start(...args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const p = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0', ...args],
                    { stdio: ['ignore', 'pipe', 'pipe'] });
    servers.push(p);
    let out = '';
    const timer = setTimeout(() => reject(new Error(`no address printed: ${out}`)), 15_000);
    p.stdout!.on('data', (d: Buffer) => {
      out += String(d);
      const m = /listening on (\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    p.stderr!.on('data', (d: Buffer) => { out += String(d); });
    p.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
  });
}

afterEach(() => { for (const p of servers.splice(0)) p.kill(); });

describe('the fake gateway as the sweep uses it', () => {
  it('answers every route but /me with 503 in error mode', async () => {
    // DELIBERATE, and the reason the exception exists: a gateway that cannot reach its database must
    // not send a signed-in person to the sign-in screen, so `/me` keeps answering and the console
    // shows its outage state instead.
    const base = await start('--mode', 'error');
    const refused = await fetch(`${base}/api/console/teams`);
    expect(refused.status).toBe(503);
    expect(String((await refused.json() as { error: string }).error)).toMatch(/could not reach its database/);

    const me = await fetch(`${base}/api/console/me`);
    expect(me.status).toBe(200);
    expect((await me.json() as { email?: string }).email).toBeTruthy();
  });

  it('holds an answer four seconds in slow mode', async () => {
    const base = await start('--mode', 'slow');
    const quickly = await fetch(`${base}/api/console/teams`, { signal: AbortSignal.timeout(1000) }).then(
      () => 'answered', (e: Error) => e.name);
    expect(quickly).toBe('TimeoutError');
    const later = await fetch(`${base}/api/console/teams`, { signal: AbortSignal.timeout(8000) });
    expect(later.status).toBe(200);
  }, 20_000);

  it('switches world while running, without a rebuild', async () => {
    // The build bakes in one gateway address, so a mode that could not be switched at runtime would
    // cost a rebuild per state — which is the whole reason `__mode` exists.
    const base = await start();
    const before = await (await fetch(`${base}/api/console/teams`)).json() as { teams: unknown[] };
    expect(before.teams.length).toBeGreaterThan(0);

    const switched = await (await fetch(`${base}/__mode?set=empty`)).json() as { mode: string };
    expect(switched.mode).toBe('empty');
    const after = await (await fetch(`${base}/api/console/teams`)).json() as { teams: unknown[] };
    expect(after.teams).toEqual([]);
  });

  it('refuses a mode it does not have, naming the ones it does', async () => {
    const p = spawn('node', ['scripts/fake-gateway/server.ts', '--mode', 'nope'], { stdio: ['ignore', 'pipe', 'pipe'] });
    servers.push(p);
    let err = '';
    p.stderr!.on('data', (d: Buffer) => { err += String(d); });
    const code = await new Promise<number | null>((r) => p.on('close', r));
    expect(code).not.toBe(0);
    expect(err).toMatch(/nope/);
    expect(err).toMatch(/normal/);
  });

  it('takes the console\'s presentation and approval the way the gateway does', async () => {
    // `verify` presses Approve against this fixture: a page that sent the old `{ initiative, path }` would pass
    // here and be refused by the gateway, so the fixture refuses it too.
    const base = await start();
    const post = (path: string, body: unknown) => fetch(`${base}/api/console/${path}?team=atlas`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const doc = await (await fetch(`${base}/api/console/document/atlas/2026-09-28-search-relevance/spec.md`)).json() as
      { content_revision: string };
    expect(doc.content_revision).toMatch(/^cr_[a-z2-7]{26}$/);

    const shown = await (await post('documents/shown', { initiative: 'i', path: 'spec.md', content_revision: doc.content_revision })).json() as
      { review_context: string };
    expect(shown.review_context).toMatch(/^rc_[a-z2-7]{26}$/);

    expect((await post('documents/approve', { initiative: 'i', path: 'spec.md' })).status).toBe(400);
    const signed = await post('documents/approve', { initiative: 'i', path: 'spec.md', expected_revision: doc.content_revision,
                                                      review_context: shown.review_context });
    expect(signed.status).toBe(200);
  });
});

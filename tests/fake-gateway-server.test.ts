import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentDetail, revisionInStore } from '../scripts/fake-gateway/work.ts';

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
    const doc = await (await fetch(`${base}/api/console/document/atlas/2026-09-28-search-relevance/plan.md`)).json() as
      { content_revision: string };
    expect(doc.content_revision).toMatch(/^cr_[a-z2-7]{26}$/);
    const at = { initiative: '2026-09-28-search-relevance', path: 'plan.md' };

    const shown = await (await post('documents/shown', { ...at, content_revision: doc.content_revision })).json() as
      { review_context: string };
    expect(shown.review_context).toMatch(/^rc_[a-z2-7]{26}$/);

    expect((await post('documents/approve', at)).status).toBe(400);
    const signed = await post('documents/approve', { ...at, expected_revision: doc.content_revision, review_context: shown.review_context });
    expect(signed.status).toBe(200);
  });

  // The page's out-of-date states are drawn from these answers, so the fixture must be able to give them, in the
  // gateway's own sentences (services/gateway/src/console-write.ts, `staleAnswer`).
  it('refuses what the gateway refuses, and answers a page that is out of date with 409', async () => {
    const base = await start();
    const post = (path: string, body: unknown, q = 'team=atlas') => fetch(`${base}/api/console/${path}?${q}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const doc = await (await fetch(`${base}/api/console/document/atlas/2026-09-28-search-relevance/plan.md`)).json() as
      { content_revision: string };
    const at = { initiative: '2026-09-28-search-relevance', path: 'plan.md' };
    const older = 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaa';

    expect((await post('documents/shown', { ...at, content_revision: doc.content_revision }, 'scope=platform')).status).toBe(400);
    expect((await post('documents/approve', { ...at, expected_revision: doc.content_revision, review_context: 'rc_x' }, 'scope=platform')).status).toBe(400);
    expect((await post('documents/shown', { initiative: 'i', path: 'plan.md', content_revision: doc.content_revision })).status).toBe(400);
    // A document of another team is not one this team's session can show.
    expect((await post('documents/shown', { ...at, content_revision: doc.content_revision }, 'team=beacon')).status).toBe(400);

    const stale = await post('documents/shown', { ...at, content_revision: older });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ conflict: 'changed', error: 'plan.md changed after this page loaded it. Reload to read what it says now.' });

    const { review_context } = await (await post('documents/shown', { ...at, content_revision: doc.content_revision })).json() as { review_context: string };
    const moved = await post('documents/approve', { ...at, expected_revision: older, review_context });
    expect(moved.status).toBe(409);
    expect(await moved.json()).toMatchObject({ conflict: 'changed',
      error: 'plan.md changed after this page showed it, so it was not approved. Reload to read what it says now, then approve that.' });

    const unshown = await post('documents/approve', { ...at, expected_revision: doc.content_revision, review_context: 'rc_notonethisconsolewasgiven' });
    expect(unshown.status).toBe(409);
    expect(await unshown.json()).toMatchObject({ conflict: 'unshown' });
  });

  // `verify` runs the normal world only, so the states this change adds live in its records: a correction the
  // signed-in user may approve, and a document another session revises after every read.
  it('holds a correction this user can approve, and a document that moves after it is read', async () => {
    const base = await start();
    const me = await (await fetch(`${base}/api/console/me`)).json() as { activeTeam: string };
    const correction = await (await fetch(`${base}/api/console/document/${me.activeTeam}/2026-09-12-onboarding-revamp/review.md`)).json() as
      { team: string; correction: number | null; gated: boolean; approved_by: string | null };
    expect(correction).toMatchObject({ team: me.activeTeam, correction: 2, gated: true, approved_by: null });

    const moving = await (await fetch(`${base}/api/console/document/atlas/2026-10-02-query-latency/spec.md`)).json() as
      { content_revision: string; gated: boolean; approved_by: string | null };
    expect(moving).toMatchObject({ gated: true, approved_by: null });
    const shown = await fetch(`${base}/api/console/documents/shown?team=atlas`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initiative: '2026-10-02-query-latency', path: 'spec.md', content_revision: moving.content_revision }) });
    expect(shown.status).toBe(409);
  });

  // A metadata-only correction stays in the approved version: v1 reads as the correction, and the approval it
  // superseded is named by the token zz-core reads it by, as the gateway names it.
  it('names the approval a metadata-only correction superseded inside its version', async () => {
    const base = await start();
    const doc = await (await fetch(`${base}/api/console/document/beacon/2026-09-22-payout-schedule/review.md`)).json() as
      { correction: number | null; versions: { version: number; revision: number; superseded_approved: { revision: number; content_revision: string | null } | null }[] };
    expect(doc.correction).toBe(1);
    expect(doc.versions).toHaveLength(1);
    expect(doc.versions[0]).toMatchObject({ version: 1, revision: 2, superseded_approved: { revision: 1 } });
    expect(doc.versions[0].superseded_approved?.content_revision).toMatch(/^cr_[a-z2-7]{26}$/);
  });

  // The two Approve banners no other record reaches. "Approve is unavailable" is a refusal of the record that is not a
  // 409: zz-core's own sentence, which the gateway answers 400.
  it('holds a document whose presentation zz-core refuses outright', async () => {
    const base = await start();
    const path = 'document/atlas/2026-10-04-index-rebuild/spec.md';
    const doc = await (await fetch(`${base}/api/console/${path}`)).json() as { content_revision: string; gated: boolean; approved_by: string | null };
    expect(doc).toMatchObject({ gated: true, approved_by: null });
    const shown = await fetch(`${base}/api/console/documents/shown?team=atlas`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initiative: '2026-10-04-index-rebuild', path: 'spec.md', content_revision: doc.content_revision }) });
    expect(shown.status).toBe(400);
    expect(await shown.json()).toEqual({ error: 'ERROR: no team to record this for' });
  });
});

// "This document changed while you were reading it" needs a refetch to bring a newer snapshot than the page recorded:
// a document another session revises on a clock, so the first read is recorded and a focus refetch past the console's
// thirty-second staleTime lands on a newer one. Imported rather than served, so the clock can be moved.
describe('a document another session keeps revising', () => {
  it('serves the snapshot the store holds now, and a newer one once its revision period has passed', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const at = ['atlas', '2026-10-03-ranking-weights', 'spec.md'] as const;
      const first = documentDetail(...at)!;
      expect(first).toMatchObject({ gated: true, approved_by: null });
      expect(documentDetail(...at)!.content_revision).toBe(first.content_revision);
      expect(revisionInStore(...at)).toBe(first.content_revision);
      vi.setSystemTime(Date.now() + 31_000);
      const later = documentDetail(...at)!;
      expect(later.content_revision).not.toBe(first.content_revision);
      expect(revisionInStore(...at)).toBe(later.content_revision);
    } finally {
      vi.useRealTimers();
    }
  });
});

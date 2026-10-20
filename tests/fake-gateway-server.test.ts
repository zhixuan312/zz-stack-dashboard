import { spawn, type ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentDetail, revisionInStore } from '../scripts/fake-gateway/work.ts';
import config from '../scripts/verify.config.ts';

/**
 * The fixture as a SERVER, which is how a sweep uses it.
 *
 * `fake-gateway-states.test.ts` covers the two modes that reshape an answer, because those are pure
 * functions. The other two are behaviours of the running server and had no check at all: `error`,
 * which makes every route except `/me` answer 503, and `slow`, which holds every answer but `/me` past the bound
 * every read is given (`SLOW_MS`). The status read is the exception to both, and its own two cases are below.
 * `fake-gateway-states.test.ts`'s own note says why that matters — "a mode that throws is a mode nothing notices" — and
 * both of these are modes a person is told to sweep by hand, so a broken one misleads exactly the
 * person following the instruction.
 *
 * Spawned rather than imported: `server.ts` is a script, not a module with an exported handler, and
 * the thing under test is what it does when it runs.
 */
const servers: ChildProcess[] = [];

/** Start the fixture and wait for the address it prints. */
async function start(...args: string[]): Promise<string> {
  const gateway = await startFakeGateway(...args);
  servers.push(gateway.proc);
  return gateway.base;
}

afterEach(() => { for (const p of servers.splice(0)) p.kill(); });

/** The two people the fixture answers as: the superadmin, who sends no cookie, and the member. */
const BOTH: Record<string, string>[] = [{}, { cookie: 'zz_console=member' }];

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

  it('fails the status read as its own route does in error mode', async () => {
    // The read a page makes on the console's server: a query that fails there is a 500 with the route's own sentence,
    // never a partial body that reads as zero, and that is the answer the page's error state is drawn from.
    const base = await start('--mode', 'error');
    for (const headers of BOTH) {
      const refused = await fetch(`${base}/api/console/platform/status`, { headers });
      expect(refused.status).toBe(500);
      expect(await refused.json()).toEqual({ error: "could not read the platform's status" });
    }
    // A write is not that read: it fails as every other route does.
    expect((await fetch(`${base}/api/console/page-view`, { method: 'POST', body: '{"feature":"home"}' })).status).toBe(503);
  });

  it('renames one of its own teams on a hint, and adds no row', async () => {
    // What `scripts/live-check.ts` drives. It renames rather than adds because `verify` runs the checks and the presses
    // suite against ONE gateway at once: a row this added would be a link the presses would follow to a team page the
    // fixture does not know, which is a 404 this check caused and another suite would report.
    const base = await start();
    const before = await (await fetch(`${base}/api/console/teams`)).json() as { teams: { slug: string; name: string }[] };
    const rows = before.teams.length;
    expect(before.teams.find((t) => t.slug === 'dune')?.name).toBe('Dune');

    const hinted = await (await fetch(`${base}/api/console/__hint?collection=teams&rename=dune:Dune%20Renamed`)).json() as { reached: number; renamed: string | null };
    expect(hinted.renamed).toBe('dune');
    // No tab is following anything in this test, so the hint reaches none — which is the other half of what it says.
    expect(hinted.reached).toBe(0);

    const after = await (await fetch(`${base}/api/console/teams`)).json() as { teams: { slug: string; name: string }[] };
    expect(after.teams.length).toBe(rows);
    expect(after.teams.find((t) => t.slug === 'dune')?.name).toBe('Dune Renamed');

    const unknown = await fetch(`${base}/api/console/__hint?collection=teams&rename=nobody:X`);
    expect((await unknown.json() as { renamed: string | null }).renamed).toBeNull();
  });

  it('counts the reads of each collection, which is how a check sees a tab read one again', async () => {
    // `scripts/live-check.ts` uses this to prove the bell's own subscription: Approvals' Waiting is a fixed fixture, so a
    // refetch returns the same rows and the bell looks identical — the count is what says the request arrived.
    const base = await start();
    const counts = () => fetch(`${base}/api/console/__streams`).then((r) => r.json() as Promise<{ reads: Record<string, number> }>);
    expect((await counts()).reads.teams ?? 0).toBe(0);

    await fetch(`${base}/api/console/teams`);
    await fetch(`${base}/api/console/teams`);
    await fetch(`${base}/api/console/approvals?tab=waiting&limit=100`);
    const seen = (await counts()).reads;
    expect(seen.teams).toBe(2);
    expect(seen.approvals).toBe(1);
  });

  it('holds a page read past the 4.5 seconds a page gives it in slow mode', async () => {
    // A page shows its bounded unavailable state once its read has waited 4.5 seconds, so the delay that draws that
    // state has to outlast it: an answer by five seconds would be drawn as the page's content, late.
    const base = await start('--mode', 'slow');
    const within = await fetch(`${base}/api/console/teams`, { signal: AbortSignal.timeout(5000) }).then(
      () => 'answered', (e: Error) => e.name);
    expect(within).toBe('TimeoutError');
    const later = await fetch(`${base}/api/console/teams`, { signal: AbortSignal.timeout(10_000) });
    expect(later.status).toBe(200);
  }, 30_000);

  it('holds the status read past the five seconds a page gives it in slow mode', async () => {
    // A page shows a bounded unavailable state by five seconds, so the delay that draws it has to outlast that.
    const base = await start('--mode', 'slow');
    const outcomes = await Promise.all(BOTH.map(async (headers) => {
      const within = await fetch(`${base}/api/console/platform/status`, { headers, signal: AbortSignal.timeout(5000) }).then(
        () => 'answered', (e: Error) => e.name);
      const later = await fetch(`${base}/api/console/platform/status`, { headers, signal: AbortSignal.timeout(10_000) });
      return { within, status: later.status };
    }));
    for (const o of outcomes) {
      expect(o.within).toBe('TimeoutError');
      expect(o.status).toBe(200);
    }
  }, 30_000);

  it('switches world while running, without a rebuild', async () => {
    // The build bakes in one gateway address, so a mode that could not be switched at runtime would
    // cost a rebuild per state — which is the whole reason `__mode` exists.
    const base = await start();
    const before = await (await fetch(`${base}/api/console/teams`)).json() as { teams: unknown[] };
    expect(before.teams.length).toBeGreaterThan(0);

    const switched = await (await fetch(`${base}/api/console/__mode?set=empty`)).json() as { mode: string };
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

  it('searches documents and nodes by their text, as one team and never the fleet', async () => {
    // The shape of `GET /api/console/search`, which is zz-core's own search run as the caller. A document found by
    // words that are in its body alone is the case the assistant's search tool exists for.
    type Hit = { kind: string; team: string; initiative: string | null; path: string; excerpt: string };
    const base = await start();
    const found = await (await fetch(`${base}/api/console/search?q=${encodeURIComponent('120 ms p95')}&limit=5`)).json() as { team: string; returned: number; recall: string | null; results: Hit[] };
    expect(found.team).toBe('atlas');
    const spec = found.results.find((r) => r.kind === 'document' && r.initiative === '2026-09-28-search-relevance' && r.path === 'spec.md');
    expect(spec?.excerpt).toContain('**120** **ms** at **p95**');
    expect(found.recall).toBeNull();

    const nodes = await (await fetch(`${base}/api/console/search?q=recency`)).json() as { results: Hit[] };
    expect(nodes.results.some((r) => r.kind === 'node' && r.initiative === null && /^nodes\//.test(r.path))).toBe(true);

    const none = await (await fetch(`${base}/api/console/search?q=zyzzyva`)).json() as { returned: number; recall: string | null; note: string | null };
    expect(none).toMatchObject({ returned: 0, recall: 'no_relevant_match_in_searched_scope' });
    expect(none.note).toBeTruthy();

    expect((await fetch(`${base}/api/console/search?q=latency&scope=platform`)).status).toBe(400);
    expect((await fetch(`${base}/api/console/search`)).status).toBe(400);
    expect((await fetch(`${base}/api/console/search?q=latency&limit=51`)).status).toBe(400);
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
    // Beacon's record, so read by a session acting for beacon: Work's detail routes are the active team's alone.
    const headers = { cookie: 'zz_console=superadmin' };
    await fetch(`${base}/api/console/settings/me/active-team`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ team: 'beacon' }) });
    const doc = await (await fetch(`${base}/api/console/document/beacon/2026-09-22-payout-schedule/review.md`, { headers })).json() as
      { correction: number | null; versions: { version: number; revision: number; superseded_approved: { revision: number; content_revision: string | null } | null }[] };
    expect(doc.correction).toBe(1);
    expect(doc.versions).toHaveLength(1);
    expect(doc.versions[0]).toMatchObject({ version: 1, revision: 2, superseded_approved: { revision: 1 } });
    expect(doc.versions[0].superseded_approved?.content_revision).toMatch(/^cr_[a-z2-7]{26}$/);
  });

  // As the gateway answers them since Task I-121 (services/gateway/src/console/initiatives.ts): the team in the address
  // must be the one the caller acts for, for the superadmin too, and nothing the request names widens it.
  it('answers an initiative and a document of the active team alone, for the superadmin too', async () => {
    const base = await start();
    const own = ['initiatives/atlas/2026-09-28-search-relevance', 'document/atlas/2026-09-28-search-relevance/spec.md'];
    const other = ['initiatives/beacon/2026-09-22-payout-schedule', 'document/beacon/2026-09-22-payout-schedule/review.md',
                   'initiatives/cinder/2026-08-20-incident-runbooks', 'document/beacon/2026-09-22-payout-schedule/review.md?revision=1'];
    for (const headers of [{}, { cookie: 'zz_console=superadmin' }, { cookie: 'zz_console=member' }] as Record<string, string>[]) {
      for (const path of own) expect((await fetch(`${base}/api/console/${path}`, { headers })).status, `${JSON.stringify(headers)} ${path}`).toBe(200);
      for (const path of other) {
        for (const widen of ['', `${path.includes('?') ? '&' : '?'}scope=platform`, `${path.includes('?') ? '&' : '?'}team=beacon`]) {
          const res = await fetch(`${base}/api/console/${path}${widen}`, { headers });
          expect(res.status, `${JSON.stringify(headers)} ${path}${widen}`).toBe(404);
          // The not-found echoes the address asked for and nothing of the record behind it.
          expect(JSON.stringify(await res.json())).not.toMatch(/jonas|stakeholder|documents/i);
        }
      }
    }
    // A caller who acts for no team is answered the no-team refusal, never another team's record.
    const none = { cookie: 'zz_console=superadmin-in-no-team' };
    expect((await (await fetch(`${base}/api/console/me`, { headers: none })).json() as { activeTeam: string | null }).activeTeam).toBeNull();
    for (const path of [...own, ...other.slice(0, 2)]) {
      const res = await fetch(`${base}/api/console/${path}`, { headers: none });
      expect([res.status, (await res.json() as { error: string }).error], path).toEqual([400, expect.stringMatching(/no team/)]);
    }
  });

  // What `pnpm verify` walks: each person's own team's initiatives as detail routes, and another team's as a probe both
  // are refused, so a browser suite never reads a record the gateway would not answer.
  it('is walked through the active team\'s initiatives, and another team\'s as a denied probe for both people', async () => {
    const base = await start();
    const work = config.detailRoutes.filter((r) => r.startsWith('/initiatives/'));
    const personas = Object.values(config.personas!);
    for (const persona of personas) {
      const me = await (await fetch(`${base}/api/console/me`, { headers: { cookie: `zz_console=${persona.cookie.value}` } })).json() as { activeTeam: string };
      const denied = work.filter((r) => r.split('/')[2] !== me.activeTeam);
      expect(work.length - denied.length, persona.cookie.value).toBeGreaterThan(3);
      expect(denied.length, persona.cookie.value).toBeGreaterThan(0);
      for (const route of work) {
        const [, , team, slug, ...doc] = route.split('/');
        const api = doc.length ? `document/${team}/${slug}/${doc.join('/')}` : `initiatives/${team}/${slug}`;
        const res = await fetch(`${base}/api/console/${api}?scope=platform`, { headers: { cookie: `zz_console=${persona.cookie.value}` } });
        expect(res.status, `${persona.cookie.value}: ${route}`).toBe(denied.includes(route) ? 404 : 200);
      }
      for (const route of denied) expect(Object.keys(persona.deniedProbe ?? {}), `${persona.cookie.value}: ${route}`).toContain(route);
    }
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
    // The gateway's sentence, not a developer's: the console prints this under its own sentence on the page, so it
    // reads to the person rather than to whoever wrote the route.
    expect(await shown.json()).toEqual({ error: 'the console is not acting for the team this document belongs to, so there is nowhere to record it' });
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

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The gate every page opens with (`gate` in `src/data/access.ts`), against a gateway stood up as `fetch`.
 * What it must never do is open a page for somebody the gateway did not clearly name.
 */
const jar: Record<string, string> = {};
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in jar ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers(),
}));

/** Next's `redirect` throws; this one throws something a test can read the address from. */
const { Redirected } = vi.hoisted(() => {
  class Redirected extends Error {
    readonly to: string;
    constructor(to: string) {
      super(`redirect to ${to}`);
      this.to = to;
    }
  }
  return { Redirected };
});
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

/** The refused view is an async Server Component; here it only says which feature it was drawn for. */
vi.mock('@/views/no-access', () => ({ NoAccess: async ({ feature }: { feature: string }) => ({ refused: feature }) }));

import { gate } from '@/data/access';

type Feature = Parameters<typeof gate>[0];
type Body = Record<string, unknown>;

const SUPERADMIN: Body = { email: 'owner@example.com', name: 'Owner', role: 'superadmin', mayRead: true, superadmin: true, via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas' };
const MEMBER: Body = { email: 'mei@example.com', name: 'Mei', role: 'member', mayRead: true, superadmin: false, via: 'session', teams: [{ slug: 'beacon', role: 'admin' }], activeTeam: 'beacon' };
const WHY = 'You are signed in as mei@example.com, but the console needs a browser sign-in.';

/** The gateway answers `/me` with a body, with a bare status, or not at all. */
function gateway(answer: Body | number | 'down') {
  global.fetch = (async () => {
    if (answer === 'down') throw new TypeError('fetch failed');
    if (typeof answer === 'number') return { ok: false, status: answer, json: async () => ({ error: `HTTP ${answer}` }) } as Response;
    return { ok: true, status: 200, json: async () => answer } as Response;
  }) as typeof fetch;
}

type Outcome = { kind: 'open' } | { kind: 'refused'; view: unknown } | { kind: 'redirect'; to: string } | { kind: 'thrown' };
async function ask(feature: string): Promise<Outcome> {
  try {
    const view = await gate(feature as Feature);
    return view === null ? { kind: 'open' } : { kind: 'refused', view };
  } catch (error) {
    return error instanceof Redirected ? { kind: 'redirect', to: error.to } : { kind: 'thrown' };
  }
}

const saved = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  jar.zz_console = 'session-1';
  Object.assign(process.env, { ZZ_GATEWAY: 'http://gateway.test', NODE_ENV: 'production' });
  delete process.env.ZZ_DEV_PAT;
});
afterEach(() => {
  process.env = { ...saved };
});

/**
 * Who each page opens for, from the spec's grants table and reconciliation 67, written out here and not read from the
 * code under test: Teams, People, Audit and a bug's own page are the superadmin's, and every other page, the old
 * addresses that keep their pages until Phase 7 among them, everybody's.
 */
const SUPERADMIN_ONLY = ['teams', 'people', 'audit', 'bug'];
const EVERYBODY = [
  'home', 'record', 'initiatives', 'approvals', 'knowledge', 'activity', 'runs', 'plugins', 'access', 'settings',
  'platform-status', 'releases', 'bugs', 'evaluation', 'usage', 'knowledge-health',
];

describe('a page\'s gate', () => {
  it('opens every page for a superadmin', async () => {
    gateway(SUPERADMIN);
    for (const feature of [...EVERYBODY, ...SUPERADMIN_ONLY]) expect(await ask(feature), feature).toEqual({ kind: 'open' });
  });

  it('opens a member every Work page, Knowledge, Activity, Runs, Plugins and Access among them, and the public Platform pages', async () => {
    gateway(MEMBER);
    for (const feature of EVERYBODY) expect(await ask(feature), feature).toEqual({ kind: 'open' });
  });

  it('answers a member with the refused view on Teams, People, Audit and a bug\'s own page, and never opens one', async () => {
    gateway(MEMBER);
    for (const feature of SUPERADMIN_ONLY) {
      expect(await ask(feature), feature).toEqual({ kind: 'refused', view: { refused: feature } });
    }
  });

  it('sends a request with no session to sign in, not to the denied state', async () => {
    gateway(401);
    const out = await ask('home');
    expect(out.kind).toBe('redirect');
    const to = (out as { to: string }).to;
    expect(to).toMatch(/^\/login(\?|$)/);
    expect(to).not.toContain('denied');
  });

  it('sends a session the console is refused to the denied state, with the gateway\'s own reason', async () => {
    gateway(403);
    const refused = await ask('home');
    expect(refused.kind).toBe('redirect');
    expect((refused as { to: string }).to).toMatch(/^\/login\?denied=1/);

    gateway({ ...MEMBER, mayRead: false, why: WHY });
    const told = await ask('home');
    expect(told.kind).toBe('redirect');
    const to = (told as { to: string }).to;
    expect(to).toMatch(/^\/login\?denied=1/);
    expect(new URLSearchParams(to.split('?')[1]).get('reason')).toBe(WHY);
  });

  it('opens nothing for an identity it cannot place', async () => {
    const unplaceable: Body[] = [
      { ...MEMBER, role: 'auditor' },
      { ...MEMBER, role: undefined },
      { ...MEMBER, superadmin: true },
      { ...SUPERADMIN, superadmin: false },
      {},
    ];
    for (const body of unplaceable) {
      gateway(body);
      for (const feature of ['home', 'teams']) {
        expect((await ask(feature)).kind, `${JSON.stringify(body)} on ${feature}`).not.toBe('open');
      }
    }
  });

  it('throws when the gateway cannot answer, and opens nothing', async () => {
    gateway('down');
    expect(await ask('home')).toEqual({ kind: 'thrown' });
    gateway(500);
    expect(await ask('home')).toEqual({ kind: 'thrown' });
    gateway(MEMBER);
    delete process.env.ZZ_GATEWAY;
    expect(await ask('home')).toEqual({ kind: 'thrown' });
  });

  it('does not remember one request\'s answer for the next', async () => {
    gateway(SUPERADMIN);
    expect(await ask('teams')).toEqual({ kind: 'open' });
    gateway(MEMBER);
    expect(await ask('teams')).toEqual({ kind: 'refused', view: { refused: 'teams' } });
    gateway(401);
    expect((await ask('teams')).kind).toBe('redirect');
  });
});

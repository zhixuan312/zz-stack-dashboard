import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import { FEATURES } from '@/data/features';
import { PREPARED } from '@/data/prepared';
import { aggregate, read } from '@/data/read';
import type { Me } from '@/lib/api-shapes';
import type { Access } from '@/lib/destination-shapes';
import { runExplore, type ExploreRights } from '@/lib/explore';
import { dayOf } from '@/lib/format-date';
import { contextText, viewAt } from '@/lib/shared-context';
import { accessAnswer, accessContext } from '@/views/access-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { viewTools } from '@/views/tools';
import { accessTool } from '@/views/tools/access';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';

/**
 * Access's agent side (Task I-112): the context the page and `view_access` share, `view_access` itself and
 * `explore_access`, the caller's own tokens counted by state and application from their own Access answer.
 *
 * The rule this holds above all: nothing the assistant is told holds a token's value, a hash, a session's id or an
 * enrolment link. The fixture's answers carry session ids (each browser's) and none of the others, so each is planted
 * below where it could leak from, and every text and answer is searched for all of them.
 */
const answer = (who: Me): Access => accessOf(who)[1] as Access;
const ADMIN = answer(ME);
const NOAH = answer(MEMBER);
const at = { updatedAt: new Date(ADMIN.meta.asOf), now: new Date(ADMIN.meta.asOf) };
const SESSION_IDS = [...ADMIN.browsers, ...NOAH.browsers].map((b) => b.id);
/** Values the platform never puts in an Access answer, planted where a careless field would carry them. */
const SECRETS = ['zz_pat_SECRET0123456789abcdef', 'sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f0', 'https://console.example.com/enrol#t=SECRETLINK'];
/** Every way the assistant could be told something on Access, as text. */
const told = (a: Access) => [
  contextText(accessContext(a, at)),
  JSON.stringify(accessAnswer(a)),
];
const noSecretIn = (texts: string[]) => {
  for (const t of texts) {
    for (const id of SESSION_IDS) expect(t).not.toContain(id);
    for (const s of SECRETS) expect(t).not.toContain(s);
    expect(t).not.toMatch(/zz_pat_|token_hash|tokenHash|cookie|credential/i);
  }
};

beforeEach(() => {
  gateway.get.mockReset();
  gateway.get.mockImplementation(async (p: string) => (p === '/me' ? ME : p.startsWith('/access') ? ADMIN : Promise.reject(new Error(`no fixture for ${p}`))));
});

describe('the context Access shares', () => {
  it('states the labels, dates, states and applications of the read, and the team acted for', () => {
    const c = accessContext(ADMIN, at);
    expect(c.view).toBe('access');
    expect(c.address).toBe('/access');
    const facts = Object.fromEntries(c.facts.map((f) => [f.label, f.value]));
    expect(facts).toMatchObject({
      'Live tokens': String(ADMIN.issued.filter((t) => !t.revokedAt).length),
      'Revoked tokens': String(ADMIN.issued.filter((t) => t.revokedAt).length),
      'Connected applications': String(ADMIN.applications.length),
      'Signed-in browsers': String(ADMIN.browsers.length),
      Passkeys: String(ADMIN.authenticators.length),
      'Acting for': 'atlas (admin)',
    });
    // No console scope (reconciliation 76): a superadmin's console is the whole platform, always.
    expect(facts['Console scope']).toBeUndefined();
    const text = contextText(c);
    for (const t of ADMIN.issued) expect(text).toContain(`"${t.label}"`);
    expect(text).toContain('Claude Code, 2 tokens');
    expect(text).toContain('Safari on macOS (this one)');
    expect(text).toContain('MacBook Touch ID');
    expect(text).toContain('atlas (admin, the one this browser acts for), beacon (member)');
    expect(text).toContain('The assistant does none of them');
  });

  it('drops nothing for either person the fake signs in', () => {
    for (const a of [ADMIN, NOAH]) {
      const c = accessContext(a, at);
      expect(contextText(c).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(c.unknowns.join(' ')).not.toContain('More is on the page');
    }
    expect(contextText(accessContext(ADMIN, at))).toContain('live, through Claude Code, issued');
  });

  it('gives nobody a console scope, and a member no other person\'s tokens', () => {
    for (const a of [ADMIN, NOAH]) {
      expect(accessContext(a, at).facts.map((f) => f.label)).not.toContain('Console scope');
      expect(contextText(accessContext(a, at))).not.toContain('Console scope');
    }
    const c = accessContext(NOAH, at);
    const text = contextText(c);
    for (const t of ADMIN.issued) expect(text).not.toContain(t.label);
    expect(text).toContain('ChatGPT');
  });

  it('holds no token value, hash, session id or enrolment link, from the fixture or planted in it', () => {
    noSecretIn([...told(ADMIN), ...told(NOAH)]);
    // A label is the person's own words: one that looks like a secret is still never a session id or a hash of anything.
    const planted: Access = {
      ...ADMIN,
      issued: ADMIN.issued.map((t) => ({ ...t, id: SECRETS[1] })),
      browsers: ADMIN.browsers.map((b) => ({ ...b, userAgent: `${b.userAgent} ${SECRETS[0]}` })),
      setup: { ...ADMIN.setup, config: `${ADMIN.setup.config}\n${SECRETS[2]}` },
    };
    noSecretIn(told(planted));
  });

  it('keeps to its budget with every token the person ever issued: eight named, the least important lines dropped first, every figure kept', () => {
    const many: Access = {
      ...ADMIN,
      issued: Array.from({ length: 200 }, (_, i) => ({ ...ADMIN.issued[0], id: `tok_${i}`, label: `a token with a long label of its own, number ${i}` })),
    };
    const c = accessContext(many, at);
    expect(contextText(c).length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(c.facts.find((f) => f.label === 'Live tokens')!.value).toBe('200');
    expect(contextText(c)).toContain('Every change here is the person\'s, made on this page');
    expect(contextText(c)).toContain('and 192 more (see Tokens on /access)');
    expect(contextText(c)).not.toContain('This page has');
  });
});

describe('view_access', () => {
  it('answers the same response its page reads, with the page\'s context and no session id in its data', async () => {
    const { context, data } = await accessTool.read({});
    expect(gateway.get).toHaveBeenCalledWith('/access');
    expect(context.facts).toEqual(accessContext(ADMIN, at).facts);
    expect(context.insights).toEqual(accessContext(ADMIN, at).insights);
    expect(data).toEqual(accessAnswer(ADMIN));
    expect(Object.keys(data.tokens[0]).sort()).toEqual(['application', 'createdAt', 'label', 'lastUsedAt', 'revokedAt', 'state']);
    expect(Object.keys(data.browsers[0]).sort()).toEqual(['browser', 'current', 'expiresAt', 'lastSeenAt', 'signedInAt']);
    noSecretIn([JSON.stringify(data)]);
  });

  it('takes no arguments, needs what the page needs and names the page it renders', () => {
    expect(accessTool.name).toBe('access');
    expect(accessTool.page).toBe('/access');
    expect(accessTool.needs).toBe(FEATURES.access.needs);
    expect(Object.keys(accessTool.input.shape)).toEqual([]);
    expect(viewAt(viewTools, '/access')).toBe(accessTool);
    // Settings' tool went with its contents.
    expect(viewTools.find((t) => t.name === 'settings')).toBeUndefined();
    expect(viewAt(viewTools, '/settings')).toBeUndefined();
  });

  it('is a read, and no tool on the console issues, revokes or switches', () => {
    for (const t of viewTools) expect(`${t.name} ${t.description}`).not.toMatch(/\b(issue|revoke|switch)(s|es)? (a|the|your) (token|team|application|browser)/i);
    expect(accessTool.description).toContain('Never a token\'s value');
  });
});

describe('explore_access', () => {
  const rights: ExploreRights = { readable: new Set(['tokens']), hidden: () => [] };
  // The day the assistant's route hands the query: today in the reporting time zone, as `dayOf(clock())` reads it.
  const explore = (input: unknown) => runExplore(accessTool.explore, input, rights, { aggregate, read, today: dayOf(new Date()) }, accessTool.page);

  it('declares the caller\'s tokens by state and application, drilled to Access', () => {
    const { sources } = accessTool.explore;
    expect(Object.keys(sources)).toEqual(['tokens']);
    expect(sources.tokens.collection).toBe('tokens');
    expect(sources.tokens.facets).toEqual(['state', 'application']);
    expect(sources.tokens.drill.columns).toContain(PREPARED.find((r) => r.name === 'tokens')!.key);
    expect(sources.tokens.drill.address({})).toBe('/access');
  });

  it('counts the caller\'s own tokens by state from their own Access answer', async () => {
    const { answer: text } = await explore({ source: 'tokens', measures: ['tokens'], by: 'state', period: 'all' });
    expect(gateway.get.mock.calls.map(([p]) => p)).toContain('/access');
    expect(text).toContain(`live: ${ADMIN.issued.filter((t) => !t.revokedAt).length}`);
    expect(text).toContain(`revoked: ${ADMIN.issued.filter((t) => t.revokedAt).length}`);
  });

  it('counts them by application, the ones issued directly named so', async () => {
    const { answer: text } = await explore({ source: 'tokens', measures: ['tokens'], by: 'application', period: 'all' });
    expect(text).toContain('mcp-client-claude-code: 2');
    expect(text).toContain('issued directly: 2');
  });

  it('drills to each token by label and date, with no value and no session id', async () => {
    const { answer: text } = await explore({ source: 'tokens', measures: ['tokens'], period: 'all', rows: 10 });
    for (const t of ADMIN.issued) expect(text).toContain(t.label);
    expect(text).toContain('/access');
    noSecretIn([text]);
  });
});

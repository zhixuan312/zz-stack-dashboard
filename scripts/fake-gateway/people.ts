/**
 * The fake gateway's personas: the two people who can be signed in, and their own settings.
 *
 * Synthetic on purpose. This repository is public, so nothing here is a real person, address or
 * team; every address is under `example.com`, which is reserved for documentation. The shapes are
 * the console's own reading of each route (`src/lib/api-shapes.ts`), so `tsc` proves a fixture
 * still matches what a page expects. The platform's teams and people, these two among them, are
 * `platform-teams.ts`'s and `platform-people.ts`'s.
 *
 * Two of them can be signed in, and the `zz_console` cookie's value says which: `ME`, a superadmin
 * in two teams, and `MEMBER`, one person in one team. The browser suites' `personas` sign a browser in as either
 * (`personas` in scripts/verify.config.ts).
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { Access, AccessToken } from '../../src/lib/destination-shapes.ts';
import { ago } from './clock.ts';

export const ME: Me = {
  email: 'ava.lindqvist@example.com',
  name: 'Ava Lindqvist',
  role: 'superadmin',
  mayRead: true,
  superadmin: true,
  via: 'session',
  teams: [{ slug: 'atlas', role: 'admin' }, { slug: 'beacon', role: 'member' }],
  activeTeam: 'atlas',
};

/** The member: one team, and its admin, which is what the platform makes of every person it adds. */
export const MEMBER: Me = {
  email: 'noah.okafor@example.com',
  name: 'Noah Okafor',
  role: 'member',
  mayRead: true,
  superadmin: false,
  via: 'session',
  teams: [{ slug: 'atlas', role: 'admin' }],
  activeTeam: 'atlas',
};

/** The gateway's own name for the console session (`CONSOLE_COOKIE` in services/gateway/src/identity.ts). */
const SESSION_COOKIE = 'zz_console';
/** Who each value of that cookie signs in. COUPLED: `personas` in scripts/verify.config.ts sends these values. */
const SESSIONS: Record<string, Me> = { superadmin: ME, member: MEMBER };
/** A value that signs nobody in, kept for tests: it is how a request with no session is made, since a request with
 *  no cookie at all is the superadmin. Every value `SESSIONS` does not name is answered the same way. */
export const NO_SESSION = 'signed-out';

/**
 * Who a request is from, by its `Cookie` header; null when it carries a session this fixture does not know.
 *
 * DELIBERATE: no `zz_console` cookie is the superadmin, not nobody. The default `pnpm test:t2` signs nobody in, and
 * every page it opens has to keep reading what it read when this fixture had one person.
 */
export function signedIn(header: string | undefined): Me | null {
  const session = (header ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (session === undefined) return ME;
  return SESSIONS[session.slice(SESSION_COOKIE.length + 1)] ?? null;
}

/** A token as a person's fixture holds it: Access's own, before the application it was minted through is joined on. */
type OwnToken = Omit<AccessToken, 'application'>;

const MY_TOKENS: OwnToken[] = [
  { id: 'tok_1f2e3d4c', label: 'mcp oauth — /core/mcp — ava.lindqvist@example.com', createdAt: ago(96), lastUsedAt: ago(0.2), revokedAt: null },
  { id: 'tok_5a6b7c8d', label: 'laptop — release scripts', createdAt: ago(400), lastUsedAt: ago(30), revokedAt: null },
  { id: 'tok_9e0f1a2b', label: 'mcp oauth — /manage/mcp — ava.lindqvist@example.com', createdAt: ago(700), lastUsedAt: null, revokedAt: null },
  { id: 'tok_3c4d5e6f', label: 'old ci runner', createdAt: ago(1500), lastUsedAt: ago(1200), revokedAt: ago(1100) },
];

/** The member's own tokens, as `MY_TOKENS` is the superadmin's. */
const MEMBER_TOKENS: OwnToken[] = [
  { id: 'tok_7b8c9d0e', label: `mcp oauth — /core/mcp — ${MEMBER.email}`, createdAt: ago(120), lastUsedAt: ago(3), revokedAt: null },
  { id: 'tok_2d3e4f5a', label: 'laptop', createdAt: ago(900), lastUsedAt: ago(70), revokedAt: null },
];

/** A person's own tokens, and nobody else's: the fixture half of Access's `issued` (work-access.ts). */
export const tokensOf = (who: Me): OwnToken[] => (who.email === MEMBER.email ? MEMBER_TOKENS : MY_TOKENS);

/** Access's `setup`, written for the person asking. */
export const clientSetupOf = (who: Me): Access['setup'] => ({
  client: 'claude-code',
  config: [
    `# ZZ setup for ${who.email}`,
    '',
    '## 1. Get a token (once)',
    'Ask the **ZZ Access** agent for a token. It is shown once. Then `export ZZ_TOKEN=<it>` for the commands below.',
    '',
    '## 2. Install',
    '```bash',
    'claude plugin marketplace add example/zz-stack',
    'claude plugin install zz-core@zz-stack # required',
    'claude plugin install zz-access@zz-stack # required',
    'claude plugin install sdlc@zz-stack',
    '```',
    '',
    '## 3. Check',
    'Run `/zz-core:whoami` in a new session; it names you and the team you act for.',
  ].join('\n'),
});

/** Access's `teams`: the teams a person is in, and the one they act for; a person who acts for no team is answered none. */
export const teamsOf = (who: Me): Access['teams'] => (who.activeTeam
  ? { actingFor: who.activeTeam, teams: who.teams.map((t) => ({ team: t.slug, role: t.role, active: t.slug === who.activeTeam })) }
  : { actingFor: null, teams: [] });

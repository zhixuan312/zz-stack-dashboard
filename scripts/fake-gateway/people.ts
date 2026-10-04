/**
 * The fake gateway's people: teams, principals, the signed-in superadmin and their settings.
 *
 * Synthetic on purpose. This repository is public, so nothing here is a real person, address or
 * team; every address is under `example.com`, which is reserved for documentation. The shapes are
 * the console's own reading of each route (`src/lib/api-shapes.ts`), so `tsc` proves a fixture
 * still matches what a page expects.
 *
 * The cast covers the states a page has to draw: an active team with work, one with no work at
 * all, an archived one, a person who never signed in, a deactivated one, and a name long enough
 * to wrap.
 */
import type {
  Me, MyAccessToken, MyClientSetup, MyTeams, PlatformPersonRow, Person, Team, TeamDetail, TeamMemberRow,
} from '../../src/lib/api-shapes.ts';
import { ago, day } from './clock.ts';

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

export const TEAMS: Team[] = [
  { slug: 'atlas', name: 'Atlas Research', status: 'active', created: day(64), members: 4, initiatives: 4, documents: 23, sources: 41, knowledge: 6 },
  { slug: 'beacon', name: 'Beacon Payments', status: 'active', created: day(51), members: 3, initiatives: 3, documents: 11, sources: 17, knowledge: 3 },
  { slug: 'cinder', name: 'Cinder Field Operations', status: 'archived', created: day(88), members: 1, initiatives: 1, documents: 4, sources: 2, knowledge: 1 },
  { slug: 'dune', name: 'Dune', status: 'active', created: day(2), members: 1, initiatives: 0, documents: 0, sources: 0, knowledge: 0 },
];

type Seed = { email: string; name: string; role: 'superadmin' | 'member'; status: string; created: number; teams: [string, 'admin' | 'member'][]; active: string | null; tokens: number; lastUsed: number | null };

const SEEDS: Seed[] = [
  { email: ME.email, name: ME.name, role: 'superadmin', status: 'active', created: 88, teams: [['atlas', 'admin'], ['beacon', 'member']], active: 'atlas', tokens: 3, lastUsed: 0.2 },
  { email: 'noah.okafor@example.com', name: 'Noah Okafor', role: 'member', status: 'active', created: 64, teams: [['atlas', 'admin']], active: 'atlas', tokens: 2, lastUsed: 3 },
  { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', status: 'active', created: 60, teams: [['atlas', 'member'], ['beacon', 'member']], active: 'beacon', tokens: 1, lastUsed: 26 },
  { email: 'jonas.weber@example.com', name: 'Jonas Weber', role: 'member', status: 'active', created: 51, teams: [['beacon', 'admin']], active: 'beacon', tokens: 2, lastUsed: 7 },
  { email: 'maximiliana.fitzgerald-oyelaran@example.com', name: 'Maximiliana Fitzgerald-Oyelaran Kowalczyk', role: 'member', status: 'active', created: 40, teams: [['atlas', 'member']], active: 'atlas', tokens: 0, lastUsed: null },
  { email: 'leo.santos@example.com', name: 'Leo Santos', role: 'member', status: 'deactivated', created: 88, teams: [['cinder', 'admin']], active: null, tokens: 0, lastUsed: 1100 },
  { email: 'sam.reyes@example.com', name: 'Sam Reyes', role: 'superadmin', status: 'active', created: 30, teams: [['dune', 'admin']], active: 'dune', tokens: 1, lastUsed: 49 },
];

export const PEOPLE: Person[] = SEEDS.map((s) => ({
  email: s.email, name: s.name, role: s.role, status: s.status, created: day(s.created),
  activeTeam: s.active, teams: s.teams.map(([t, r]) => `${t} (${r})`), tokens: s.tokens,
  last_used: s.lastUsed === null ? null : ago(s.lastUsed),
}));

export const PLATFORM_PEOPLE: PlatformPersonRow[] = SEEDS.map((s) => ({
  email: s.email, display_name: s.name, role: s.role, status: s.status, created_at: ago(s.created * 24),
  teams: s.teams.map(([team, role]) => ({ team, role, added_by: s.email === ME.email ? null : ME.email, added_at: ago(s.created * 24 - 1) })),
}));

export function teamDetail(slug: string): TeamDetail | null {
  const team = TEAMS.find((t) => t.slug === slug);
  if (!team) return null;
  return {
    team: { slug: team.slug, name: team.name, status: team.status, created: team.created },
    members: SEEDS.filter((s) => s.teams.some(([t]) => t === slug)).map((s) => ({
      email: s.email, name: s.name, role: s.teams.find(([t]) => t === slug)![1], joined: day(s.created),
    })),
  };
}

export function teamMembers(slug: string): TeamMemberRow[] {
  return SEEDS.flatMap((s) => s.teams.filter(([t]) => t === slug).map(([, role]) => ({ email: s.email, role })));
}

export const MY_TOKENS: MyAccessToken[] = [
  { id: 'tok_1f2e3d4c', label: 'mcp oauth — /core/mcp — ava.lindqvist@example.com', created_at: ago(96), last_used_at: ago(0.2), revoked_at: null },
  { id: 'tok_5a6b7c8d', label: 'laptop — release scripts', created_at: ago(400), last_used_at: ago(30), revoked_at: null },
  { id: 'tok_9e0f1a2b', label: 'mcp oauth — /manage/mcp — ava.lindqvist@example.com', created_at: ago(700), last_used_at: null, revoked_at: null },
  { id: 'tok_3c4d5e6f', label: 'old ci runner', created_at: ago(1500), last_used_at: ago(1200), revoked_at: ago(1100) },
];

export const MY_CLIENT_SETUP: MyClientSetup = {
  client: 'claude-code',
  config: [
    `# ZZ setup for ${ME.email}`,
    '',
    '## 1. Get a token (once)',
    'Ask the **ZZ Access** agent for a token. It is shown ONCE. Then `export ZZ_TOKEN=<it>` for the commands below.',
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
};

export const MY_TEAMS: MyTeams = {
  actingFor: 'atlas',
  teams: [{ team: 'atlas', role: 'admin', active: true }, { team: 'beacon', role: 'member', active: false }],
  note: 'team_switch moves you to another one. You act for exactly one team at a time, so switching changes what every client shows you.',
};

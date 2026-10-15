/**
 * The fake gateway's Access: what `GET /api/console/access` answers, and the two revokes a person makes of their own,
 * `DELETE /api/console/settings/me/applications/:client` and `DELETE /api/console/settings/me/browsers/:id`.
 *
 * One fixture per person, read for the caller alone and never for their team: their tokens by label and date with the
 * application each was minted for, the applications they authorised, the browsers they are signed in on (the one asking
 * marked current), their passkeys, the teams they may act for and their setup text. No value, hash, cookie, credential
 * or address is in any of it, and nothing is named after a token or a key, so the gateway's redaction leaves it be.
 *
 * The superadmin authorised one application twice (two tokens), is signed in on this browser and another, and has a
 * passkey; the member has one of each. A revoke is answered as the platform decides it and forgotten, like every write.
 *
 * COUPLED: zz-stack's `checks/console-access.ts` imports this file with plain `node` and compares its key sets with the
 * real routes' answers. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { Access, AccessApplication, AccessBrowser, AccessPasskey, AccessToken, Revoked } from '../../src/lib/destination-shapes.ts';
import { ago } from './clock.ts';
import { MEMBER, clientSetupOf, teamsOf, tokensOf } from './people.ts';
import { workMeta } from './work-initiatives.ts';

type Answer = [status: number, body: unknown];

/** The applications a token was minted through, by the token: the rest were issued on the console or by the agent. */
const MINTED: Record<string, string> = {
  tok_1f2e3d4c: 'mcp-client-claude-code', tok_9e0f1a2b: 'mcp-client-claude-code', tok_7b8c9d0e: 'mcp-client-chatgpt',
};
const APPLICATION_NAMES: Record<string, string> = { 'mcp-client-claude-code': 'Claude Code', 'mcp-client-chatgpt': 'ChatGPT' };

/** Each person's browsers, the first the one this fixture's session cookie is; every id is a session's, never its cookie. */
const BROWSERS: Record<string, AccessBrowser[]> = {
  'ava.lindqvist@example.com': [
    { id: '6f1d2c3b-4a5e-4f60-8172-93a4b5c6d7e8', current: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Safari/605.1.15', issuedAt: ago(30), lastSeenAt: ago(0), expiresAt: ago(-690) },
    { id: '0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d', current: false, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', issuedAt: ago(200), lastSeenAt: ago(26), expiresAt: ago(-520) },
  ],
  [MEMBER.email]: [
    { id: '2b3c4d5e-6f70-4812-a3b4-c5d6e7f80912', current: true, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0 Safari/537.36', issuedAt: ago(5), lastSeenAt: ago(0), expiresAt: ago(-715) },
    { id: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f', current: false, userAgent: null, issuedAt: ago(400), lastSeenAt: null, expiresAt: ago(-320) },
  ],
};
const PASSKEYS: Record<string, AccessPasskey[]> = {
  'ava.lindqvist@example.com': [{ label: 'MacBook Touch ID', transports: ['internal', 'hybrid'], createdAt: ago(2000), lastUsedAt: ago(30) }],
  [MEMBER.email]: [{ label: null, transports: ['usb'], createdAt: ago(900), lastUsedAt: ago(5) }],
};

/** The caller's tokens, newest first, each with the application it was minted for. */
const issuedOf = (who: Me): AccessToken[] => tokensOf(who).map((t) => ({
  id: t.id, label: t.label, createdAt: t.created_at, lastUsedAt: t.last_used_at, revokedAt: t.revoked_at, application: MINTED[t.id] ?? null,
}));

/** The applications the caller authorised, from their own tokens minted through each. */
function applicationsOf(who: Me): AccessApplication[] {
  const issued = issuedOf(who);
  return [...new Set(issued.flatMap((t) => (t.application ? [t.application] : [])))].map((client) => {
    const mine = issued.filter((t) => t.application === client);
    const used = mine.flatMap((t) => (t.lastUsedAt ? [t.lastUsedAt] : [])).sort();
    return { client, name: APPLICATION_NAMES[client], issuedCount: mine.length, firstAt: mine.map((t) => t.createdAt).sort()[0], lastUsedAt: used.at(-1) ?? null };
  });
}

/** `GET /access`, as `who`: everything of theirs, and nothing of anybody else's. The period runs from the first of their
 *  tokens, browsers and passkeys, as the gateway's does; a person who acts for no team is answered no teams. */
export function access(who: Me): Answer {
  const { actingFor, teams } = teamsOf(who);
  const issued = issuedOf(who);
  const browsers = BROWSERS[who.email] ?? [];
  const authenticators = PASSKEYS[who.email] ?? [];
  const meta = workMeta('caller-in-active-team', "the caller's own tokens, applications, browsers and passkeys");
  const first = [...issued.map((t) => t.createdAt), ...browsers.map((b) => b.issuedAt), ...authenticators.map((k) => k.createdAt)].sort()[0];
  const answer: Access = {
    meta: { ...meta, period: { from: first ?? meta.asOf, to: meta.asOf }, coverageFrom: null },
    issued,
    applications: applicationsOf(who),
    browsers,
    authenticators,
    teams: actingFor ? { actingFor, teams } : { actingFor: null, teams: [] },
    setup: clientSetupOf(who),
  };
  return [200, answer];
}

/** `DELETE /settings/me/applications/:client`, as `who`: their own live tokens minted through it, never anybody else's,
 *  and the client stays registered; 404 for an application that is not theirs. */
export function revokeApplication(who: Me, client: string): Answer {
  const mine = issuedOf(who).filter((t) => t.application === client);
  if (!mine.length) return [404, { error: 'no application of yours is registered as that client' }];
  return [200, { ok: true, revoked: mine.filter((t) => !t.revokedAt).length } satisfies Revoked];
}

/** `DELETE /settings/me/browsers/:id`, as `who`: another browser of theirs signed out; 404 for a browser that is not
 *  theirs, and 400 for the one asking, which signs out from its own menu. */
export function revokeBrowser(who: Me, id: string): Answer {
  const browser = (BROWSERS[who.email] ?? []).find((b) => b.id === id);
  if (!browser) return [404, { error: 'no browser of yours is signed in with that id' }];
  if (browser.current) return [400, { error: 'this is the browser you are using: sign out from the menu to end this session' }];
  return [200, { ok: true, revoked: 1 } satisfies Revoked];
}

/**
 * Access's shared context (decision 0011), and the words its sections are drawn with: what the page and the assistant
 * are both told about what lets the caller in, from the one `GET /access` the console's server read for them.
 *
 * DELIBERATE: nothing here is a secret or could be used as one. A token is its label, dates, state and application, never
 * its value; a browser is its kind, dates and whether it is the one asking, never its session's id; a passkey is its
 * label, transports and dates. The one plaintext value the platform ever hands out, a token at the moment it is issued,
 * is held by the page in a dialog outside the text the assistant reads and never reaches anything built here.
 */
import type { Access, AccessBrowser, AccessToken } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { arrived, budgeted, type Arrival, type ViewMode } from './context';

/** How long the console's server waits for the read: half a second under five, for a phone to draw what it says. */
export const ACCESS_BOUND_MS = 4_500;

/** What the page's one read came back as: the whole answer, the gateway's sentence, or no answer within the bound. */
export type AccessRead = { state: 'ok'; access: Access } | { state: 'failed'; reason: string } | { state: 'slow' };

/** Why the read is not on the page, in words. */
export function accessTrouble(read: Exclude<AccessRead, { state: 'ok' }>): { title: string; detail: string } {
  if (read.state === 'slow') return { title: 'Access is unavailable', detail: `The read did not answer within ${ACCESS_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: 'Access did not load', detail: `${read.reason.replace(/\.?$/, '.')} Nothing on this page was read.` };
}

/** The masthead's as-of line: the read's own cutoff. */
export const asOfLine = (access: Access): string => `As of ${formatDateTime(access.meta.asOf)}`;

/** A token's state as the page and the prepared query name it. */
export const stateOf = (t: AccessToken): 'live' | 'revoked' => (t.revokedAt ? 'revoked' : 'live');

/** What a token minted through no application reads as: issued on this page, or by an agent through `pat_issue`. */
export const DIRECT = 'Issued directly';

/** The application a token was minted through, by its registered name, or that it was issued directly. */
export function applicationOf(access: Access, t: AccessToken): string {
  if (t.application === null) return DIRECT;
  return access.applications.find((a) => a.client === t.application)?.name ?? t.application;
}

/** The browser and the system a user agent names, as a person says them: "Safari on macOS". */
export function browserOf(b: Pick<AccessBrowser, 'userAgent'>): string {
  const ua = b.userAgent;
  if (!ua) return 'A browser that sent no name';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux|X11/.test(ua) ? 'Linux' : null;
  return system ? `${browser} on ${system}` : browser;
}

/** A passkey's name: its label, or what it is when it was given none. */
export const passkeyOf = (label: string | null): string => label || 'Unnamed passkey';

/** A passkey's transports as a person reads them. */
const TRANSPORTS: Record<string, string> = { internal: 'this device', hybrid: 'a phone nearby', usb: 'USB', nfc: 'NFC', ble: 'Bluetooth' };
export const transportsOf = (transports: string[]): string => (transports.length ? transports.map((t) => TRANSPORTS[t] ?? t).join(', ') : 'Not recorded');

/** The team this person acts for, and their role in it, from the answer's own teams. */
export function actingOf(access: Access): { team: string; role: string } | null {
  const row = access.teams.teams.find((t) => t.active) ?? access.teams.teams.find((t) => t.team === access.teams.actingFor);
  return row ? { team: row.team, role: row.role } : null;
}

/** The sections the page draws for this caller, in its order. COUPLED: `src/views/pages/access.tsx`. */
function sectionsOf(access: Access, superadmin: boolean): string[] {
  const acting = actingOf(access);
  return [
    'Tokens', 'Client setup', 'Connected applications', 'Signed-in browsers', 'Passkeys', 'The team you act for',
    ...(acting && acting.role === 'admin' ? [`${acting.team}'s members`] : []),
    ...(superadmin ? ['Console scope'] : []),
  ];
}

const when = (at: string | null, never = 'never') => (at ? formatDate(at) : never);

/**
 * What the assistant may answer about a read: the labels, dates, states and applications of the tokens, the
 * applications, the browsers by kind and the passkeys, and the teams. `view_access` answers this as its data, so no
 * tool's answer holds a session's id, a token's value or its hash: none of those is in it.
 */
export function accessAnswer(access: Access) {
  return {
    asOf: access.meta.asOf,
    tokens: access.issued.map((t) => ({ label: t.label, state: stateOf(t), application: applicationOf(access, t), createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt })),
    applications: access.applications.map((a) => ({ name: a.name, tokens: a.issuedCount, firstAt: a.firstAt, lastUsedAt: a.lastUsedAt })),
    browsers: access.browsers.map((b) => ({ browser: browserOf(b), current: b.current, signedInAt: b.issuedAt, lastSeenAt: b.lastSeenAt, expiresAt: b.expiresAt })),
    passkeys: access.authenticators.map((k) => ({ label: passkeyOf(k.label), transports: k.transports, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
    teams: access.teams,
  };
}

/** The caller's console scope, said only to a superadmin, the one role with the choice. */
const SCOPE_WORDS: Record<ViewMode, string> = { platform: 'Platform: every team\'s work and the fleet pages', team: 'Team: what a member of the team acted for sees' };

/**
 * The context of one read. `superadmin` is the server's answer of who is asking, as the page draws the console scope
 * for the superadmin alone; `mode` is that superadmin's scope in this browser.
 */
export function accessContext(access: Access, { superadmin, mode, ...arrival }: { superadmin: boolean; mode: ViewMode } & Arrival): SharedContext {
  const live = access.issued.filter((t) => stateOf(t) === 'live');
  const revoked = access.issued.length - live.length;
  const unused = live.filter((t) => !t.lastUsedAt);
  const acting = actingOf(access);
  const facts: Fact[] = [
    { label: 'Live tokens', value: formatCount(live.length), definition: 'The caller\'s own tokens not revoked; a client authenticates with one.' },
    { label: 'Revoked tokens', value: formatCount(revoked), definition: 'The caller\'s own tokens revoked; one lets nothing in.' },
    { label: 'Connected applications', value: formatCount(access.applications.length), definition: 'The applications the caller authorised, by the tokens minted through each.' },
    { label: 'Signed-in browsers', value: formatCount(access.browsers.length), definition: 'The caller\'s live console sessions, this browser\'s included.' },
    { label: 'Passkeys', value: formatCount(access.authenticators.length) },
    { label: 'Acting for', value: acting ? `${acting.team} (${acting.role})` : 'no team', definition: 'This browser\'s team; the caller\'s agents keep their own, which team_switch moves.' },
    ...(superadmin ? [{ label: 'Console scope', value: SCOPE_WORDS[mode], definition: 'Only a superadmin has the choice.' }] : []),
  ];
  // Most important first, as the budget drops from the end: what the assistant may not do, then the protagonist's rows,
  // then the rest of what lets the person in, and the page's own sections last.
  const insights: Insight[] = [
    { text: 'Every change here is the person\'s, made on this page: issuing or revoking a token, revoking an application, signing out another browser, switching team, adding or removing a member. The assistant does none of them.' },
  ];
  if (unused.length) insights.push({ text: `${formatCount(unused.length)} live ${plural(unused.length, 'token has', 'tokens have')} never made a platform call.` });
  if (access.issued.length) insights.push({ text: `Their tokens, newest first: ${listed(access.issued, (t) => `"${t.label}" ${stateOf(t)}, ${t.application === null ? 'issued directly' : `through ${applicationOf(access, t)}`}, issued ${formatDate(t.createdAt)}, last used ${when(t.lastUsedAt)}`, 'see Tokens on /access', 8)}.` });
  if (access.applications.length) insights.push({ text: `Their applications: ${listed(access.applications, (a) => `${a.name}, ${formatCount(a.issuedCount)} ${plural(a.issuedCount, 'token')} since ${formatDate(a.firstAt)}, last used ${when(a.lastUsedAt)}`, 'see Connected applications on /access', 6)}.` });
  if (access.teams.teams.length) insights.push({ text: `Their teams: ${access.teams.teams.map((t) => `${t.team} (${t.role}${t.active ? ', the one this browser acts for' : ''})`).join(', ')}.` });
  if (access.browsers.length) insights.push({ text: `Their browsers: ${listed(access.browsers, (b) => `${browserOf(b)}${b.current ? ' (this one)' : ''}, signed in ${formatDate(b.issuedAt)}, last seen ${when(b.lastSeenAt)}`, 'see Signed-in browsers on /access', 6)}.` });
  if (access.authenticators.length) insights.push({ text: `Their passkeys: ${listed(access.authenticators, (k) => `${passkeyOf(k.label)} (${transportsOf(k.transports)}), added ${formatDate(k.createdAt)}, last used ${when(k.lastUsedAt)}`, 'see Passkeys on /access', 6)}.` });
  insights.push({ text: `This page has ${sectionsOf(access, superadmin).join(', ')}, and the assistant's own switch where the console has an assistant.` });
  return budgeted({
    view: 'access',
    title: 'Access',
    address: '/access',
    scope: 'the caller\'s own tokens, applications, browsers, passkeys and teams, nobody else\'s',
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns: [
      'A token\'s value is shown once, when it is issued, and can never be read again: not on this page and not by the assistant.',
      ...(access.issued.length ? [] : ['The caller holds no token yet.']),
    ],
  });
}

/**
 * The fake gateway's audit: what `GET /api/console/platform/audit` answers the superadmin. Anyone else is refused
 * before anything is read, by the server.
 *
 * One fixture, the events as `zz.event` holds them, free text in their detail included, and the answer is the
 * gateway's projection of them, never written by hand: no detail but the keys a sentence is filled from, no refusal's
 * text, and a subject only for the kinds whose subject is a slug, an email, an id or a tool. A label, a title, a file's
 * name, a document's details and a search's question are planted below and leave in no answer.
 *
 * The events cover the states the page draws: acts of administration made in the console, one by an actor nobody
 * recorded, one made by maintenance, a token issued by a person to themselves, one of a retired kind no template names,
 * events of every other kind under Everything (a refused call, a search, an approval, a sign-in, a maintenance call),
 * and a page view, which neither filter answers. Sentences, refusals and the meta are the gateway's own.
 *
 * COUPLED: zz-stack's `checks/console-platform-audit.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Audit, AuditRow } from '../../src/lib/fleet-shapes.ts';
import { ago } from './clock.ts';
import { ME, MEMBER } from './people.ts';
import { PLATFORM_STATUS } from './platform-status.ts';

type Event = {
  id: string; hoursAgo: number; actor: string | null; team: string | null; kind: string; subject: string;
  detail: Record<string, unknown>; ok: boolean | null; refusalOwner: AuditRow['refusalOwner']; refusal: string | null;
  origin: AuditRow['origin'];
};

const MEI = 'mei.tanaka@example.com';
const JONAS = 'jonas.weber@example.com';
const REPORT = '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d05';
const event = (e: Partial<Event> & Pick<Event, 'id' | 'hoursAgo' | 'kind'>): Event =>
  ({ actor: ME.email, team: null, subject: '', detail: {}, ok: null, refusalOwner: null, refusal: null, origin: 'work', ...e });

/** Newest first, as the read orders them. */
const EVENTS: Event[] = [
  event({ id: '41020', hoursAgo: 0.5, kind: 'admin.add_member', team: 'atlas', subject: 'atlas:maximiliana.fitzgerald-oyelaran@example.com', detail: { role: 'member', via: 'web' } }),
  event({ id: '41012', hoursAgo: 2, kind: 'tool_call', actor: MEMBER.email, team: 'atlas', subject: 'core:knowledge_search', ok: true, detail: { client: 'claude-code' } }),
  event({ id: '41005', hoursAgo: 3, kind: 'knowledge.search', actor: MEMBER.email, team: 'atlas', subject: 'which customer accounts are on the salary review list',
    detail: { returned: [], broadened: true } }),
  event({ id: '40990', hoursAgo: 5, kind: 'admin.issue_pat', actor: null, team: 'atlas', subject: MEMBER.email,
    detail: { team: 'atlas', label: 'release scripts on the build box', expires_at: ago(-2000) } }),
  event({ id: '40981', hoursAgo: 6, kind: 'tool_call', actor: MEI, team: 'beacon', subject: 'core:document_read', ok: false, refusalOwner: 'guardrail',
    refusal: 'ERROR: "Chargeback ledger v2, private draft" is not a document of beacon' }),
  event({ id: '40965', hoursAgo: 8, kind: 'console.page_view', detail: { workspace: 'platform' } }),
  event({ id: '40960', hoursAgo: 20, kind: 'console.sign_in', subject: 'cred_8f2a1c9d', ok: true, detail: { via: 'web' } }),
  event({ id: '40955', hoursAgo: 26, kind: 'bug.console_resolve', subject: REPORT, detail: { via: 'web', status: 'fixed' } }),
  event({ id: '40950', hoursAgo: 26, kind: 'bug.resolve', subject: REPORT, detail: { status: 'fixed' } }),
  event({ id: '40940', hoursAgo: 30, kind: 'team.switch', actor: MEI, team: 'beacon', subject: 'beacon', detail: { via: 'web', from: 'atlas' } }),
  event({ id: '40930', hoursAgo: 50, kind: 'admin.deactivate_person', subject: 'leo.santos@example.com',
    detail: { via: 'web', patsRevoked: 2, sessionsRevoked: 1, enrolmentsSpent: 0 } }),
  event({ id: '40920', hoursAgo: 70, kind: 'document.document_approve', actor: MEMBER.email, team: 'atlas', subject: 'atlas/2026-09-28-search-relevance/spec.md',
    detail: { path: 'spec.md', details: ['## Salary bands, as the private draft has them'] } }),
  event({ id: '40910', hoursAgo: 72, kind: 'credential.set', actor: JONAS, subject: 'oauth:/core/mcp', detail: { via: 'mcp-oauth', client_id: 'client_4b1e' } }),
  event({ id: '40905', hoursAgo: 75, kind: 'upload.start', actor: JONAS, team: 'beacon', subject: '', detail: { filename: 'beacon-salaries-2026.csv' } }),
  event({ id: '40900', hoursAgo: 80, kind: 'bug.delete', subject: '0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d09', detail: { title: 'Beacon payroll export shows every salary' } }),
  event({ id: '40890', hoursAgo: 100, kind: 'pat.self_issue', subject: 'laptop — release scripts', detail: { via: 'web' } }),
  event({ id: '40880', hoursAgo: 200, kind: 'admin.archive_team', team: 'cinder', subject: 'cinder', detail: { via: 'web' } }),
  event({ id: '40870', hoursAgo: 210, kind: 'tool_call', actor: null, team: 'atlas', subject: 'core:knowledge_add', ok: true, origin: 'platform', detail: { client: 'zz-migrate' } }),
  event({ id: '40860', hoursAgo: 400, kind: 'admin.list_oauth_clients', subject: 'mcp_oauth_client', detail: { count: 3 } }),
  event({ id: '40855', hoursAgo: 600, kind: 'admin.install_flow', team: 'atlas', subject: 'sdlc' }),
  event({ id: '40850', hoursAgo: 840, kind: 'admin.add_person', subject: 'kofi.mensah@example.com', origin: 'platform', detail: {} }),
];

/** The kinds that change who may do what, or close a report, besides `admin.*` but `admin.list_oauth_clients`. */
const ADMINISTRATION = ['credential.set', 'team.switch', 'pat.self_issue', 'pat.self_revoke', 'bug.resolve', 'bug.console_resolve', 'bug.delete'];
const isAdministration = (kind: string) => (kind.startsWith('admin.') && kind !== 'admin.list_oauth_clients') || ADMINISTRATION.includes(kind);
/** The kinds whose subject is a slug, an email, an id or a tool, and so may be answered. */
const SAFE_SUBJECT = ['credential.set', 'team.switch', 'pat.self_revoke', 'bug.resolve', 'bug.console_resolve', 'bug.delete', 'tool_call'];
const subjectOf = (e: Event) => (e.kind.startsWith('admin.') || SAFE_SUBJECT.includes(e.kind) ? e.subject : null);

const counted = (n: unknown, one: string) => `${String(n)} ${one}${String(n) === '1' ? '' : 's'}`;

/** One fixed template per kind, filled from the actor, the subject, the team and the detail keys a sentence may read; a
 *  kind no template names, as a retired writer's, is said by the fallback. COUPLED: the gateway's templates. */
function sentence(e: Event): string | null {
  if (!isAdministration(e.kind)) return null;
  const who = e.actor ?? 'Someone not recorded';
  const d = e.detail;
  const s = e.subject;
  const [team, email] = [s.slice(0, s.indexOf(':')), s.slice(s.indexOf(':') + 1)];
  const said: Record<string, () => string> = {
    'admin.create_team': () => `${who} ${d.reactivated === true ? 'reactivated' : 'created'} team ${s}`,
    'admin.archive_team': () => `${who} archived team ${s}`,
    'admin.add_member': () => `${who} added ${email} to ${team}${d.role ? ` as ${String(d.role)}` : ''}`,
    'admin.remove_member': () => `${who} removed ${email} from ${team}`,
    'admin.add_person': () => `${who} added ${s} to the platform`,
    'admin.deactivate_person': () => `${who} deactivated ${s}`
      + (d.patsRevoked !== undefined && d.sessionsRevoked !== undefined && d.enrolmentsSpent !== undefined
        ? `, revoking ${counted(d.patsRevoked, 'token')} and ${counted(d.sessionsRevoked, 'session')}`
          + ` and spending ${counted(d.enrolmentsSpent, 'enrolment link')}`
        : ''),
    'admin.issue_enrolment': () => `${who} issued an enrolment link for ${s}`,
    'admin.issue_pat': () => `${who} issued a token for ${s}${d.team ? ` bound to ${String(d.team)}` : ''}`,
    'admin.revoke_pat': () => `${who} revoked token ${s}${d.owner ? ` of ${String(d.owner)}` : ''}${d.team ? ` bound to ${String(d.team)}` : ''}`,
    'admin.revoke_oauth_client': () => `${who} revoked client ${s}${d.patsRevoked !== undefined ? `, revoking ${counted(d.patsRevoked, 'token')}` : ''}`,
    'credential.set': () => `${who} granted a client a token for ${s.replace(/^oauth:/, '')}`,
    'team.switch': () => `${who} switched to ${s}${d.from ? ` from ${String(d.from)}` : ''}`,
    'pat.self_issue': () => `${who} issued themselves a token`,
    'pat.self_revoke': () => `${who} revoked their own token ${s}`,
    'bug.resolve': () => `${who} resolved report ${s}${d.status ? ` as ${String(d.status).replace(/_/g, ' ')}` : ''}`,
    'bug.console_resolve': () => `${who} resolved report ${s}${d.status ? ` as ${String(d.status).replace(/_/g, ' ')}` : ''}`,
    'bug.delete': () => `${who} deleted report ${s}`,
  };
  const base = said[e.kind]?.() ?? `${who} recorded ${e.kind}${s ? ` for ${s}` : ''}`;
  return `${base}${e.origin === 'platform' ? ', as platform maintenance' : ''}${d.via === 'web' ? ' in the console' : ''}`;
}

const project = (e: Event): AuditRow => ({
  id: e.id, at: ago(e.hoursAgo), actor: e.actor, team: e.team, kind: e.kind, subject: subjectOf(e), ok: e.ok,
  refusalOwner: e.refusalOwner, origin: e.origin, inConsole: e.detail.via === 'web', sentence: sentence(e),
});

const CEILING = 500;
const FILTERS = ['administration', 'all'];
/** What administration leaves no event for, which the page names rather than shows. */
const NOT_RECORDED = ['knowledge reindex', 'knowledge reconcile', 'client setup', 'plugin registration', 'release record'];
/** The record begins with its first event. */
const FIRST = ago(Math.max(...EVENTS.map((e) => e.hoursAgo)));

/**
 * `GET /platform/audit` on `page`, the superadmin's; null for a page the read does not take. `?filter` is
 * `administration` (the default) or `all`; `?kind`, `?team` and `?before` (an instant) narrow it before the ceiling,
 * so a narrow filter reaches an event older than the latest 500. Page views are in neither.
 */
export function audit(q: URLSearchParams, page: { limit: number; offset: number } | null): [status: number, body: unknown] | null {
  if (['filter', 'kind', 'team', 'before', 'limit', 'offset'].some((k) => q.getAll(k).length > 1)) {
    return [400, { error: 'each filter and the page are given at most once' }];
  }
  const filter = q.get('filter') ?? 'administration';
  if (!FILTERS.includes(filter)) return [400, { error: `filter must be one of ${FILTERS.join(', ')}` }];
  const before = q.get('before');
  if (before !== null && Number.isNaN(Date.parse(before))) return [400, { error: 'before must be an instant' }];
  const [kind, team] = [q.get('kind'), q.get('team')];
  if (kind !== null && !/^[a-z_]+(\.[a-z_]+)?$/.test(kind)) return [400, { error: 'kind must be an event kind' }];
  if (!page) return null;
  const matching = EVENTS.map(project)
    .filter((r) => r.kind !== 'console.page_view' && (filter === 'all' || r.sentence !== null))
    .filter((r) => (kind === null || r.kind === kind) && (team === null || r.team === team) && (before === null || Date.parse(r.at) < Date.parse(before)))
    .slice(0, CEILING);
  const asOf = ago(0);
  const answer: Audit = {
    meta: { timezone: PLATFORM_STATUS.meta.timezone, asOf, period: { from: FIRST, to: asOf }, scope: 'platform-admin',
      population: filter === 'all' ? 'recorded events, page views left out' : 'recorded acts of administration', coverageFrom: FIRST },
    filter: filter as Audit['filter'],
    rows: matching.slice(page.offset, Math.min(page.offset + page.limit, CEILING)),
    total: matching.length, ceiling: CEILING, notRecorded: NOT_RECORDED,
  };
  return [200, answer];
}

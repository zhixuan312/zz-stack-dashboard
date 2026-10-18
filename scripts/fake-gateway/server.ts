/**
 * A fake ZZ gateway: answers every `/api/console/*` and `/auth/*` route the console calls, from
 * the synthetic fixtures beside this file, and changes nothing anywhere.
 *
 *   node scripts/fake-gateway/server.ts [--port 0] [--mode normal|empty|error|slow|extreme|partial]
 *
 * Why it exists: `pnpm verify` presses every control on every page. Against the real deployment
 * that would approve documents, revoke tokens and archive teams, so the browser checks run against
 * this instead. Build the app with `ZZ_GATEWAY=<the printed address>`: `next.config.ts` bakes that
 * rewrite into the build, and the pages then fetch from here exactly as they fetch from the
 * gateway behind Caddy in production.
 *
 * Who is calling: one of the two people in `people.ts`, named by the `zz_console` cookie's value. A
 * request with no such cookie is the superadmin, because `pnpm verify` signs nobody in unless it is
 * run with `--as`; the member's value is one person in one team, who is answered that team's records
 * and nothing that names another; any other value has no session and is answered 401. On the
 * screens a visitor sees before signing in (`/login`, `/enrol`, `/signed-out`) `/me` answers 401 too,
 * as it does for a browser with no session. The page's own address arrives as the Referer.
 *
 * Writes answer success and are forgotten, so every run starts from the same data. The console's
 * presentation and approval are the exception: they are held against the store's snapshot and
 * refused the way the gateway refuses them, so a page's out-of-date states can be drawn.
 *
 * `--mode` draws the states a page has to design for, from the same routes and for either person: `empty` (a fresh
 * deployment, nothing recorded), `error` (every read but /me fails with the gateway's own sentence), `slow` (every
 * answer but /me waits four seconds, so the loading state can be looked at), `extreme` (a busy platform: six-figure
 * counts, hundreds of rows, names longer than any layout planned for, and every answer past its ceiling,
 * states-extreme.ts), `partial` (one part of each answer unavailable,
 * the others answered). `GET /__mode?set=<mode>` switches it while running, for every request at once.
 *
 * A state per request: the session value `<person>+<state>`, `zz_console=member+empty`, signs in that person and draws
 * that state for that request alone, so a sweep of every state runs beside suites reading the normal one against the
 * same process (states-partial.ts). A value without `+` is the person in the process-wide mode, and a state this fake
 * does not draw is answered 400, naming it. A fourth value, `superadmin-in-no-team`, signs in a superadmin who acts for
 * no team, whom Work's reads refuse.
 *
 * The status read, `GET /api/console/platform/status`, is the one a page makes on the console's server and gives
 * five seconds: `error` answers it 500 with its own route's sentence, and `slow` holds it six seconds, past that bound.
 *
 * Platform's other reads are public by their route, answered to everyone signed in from one fixture each, the
 * superadmin's answer adding what the gateway adds and a member's derived from it by the gateway's projection:
 * `GET /api/console/platform/releases` and `/platform/releases/:version`, `GET /api/console/platform/bugs`, and
 * `GET /api/console/platform/evaluation`. A report, `GET /api/console/platform/bugs/:id`, its duplicate targets,
 * `/platform/bugs/:id/duplicates`, and its resolution, `POST /api/console/platform/bugs/:id/resolve`, are the
 * superadmin's alone: anyone else is refused 403 before anything is read, with nothing in the body that says who may.
 * The Platform prepared query, `GET /api/console/platform/query`, is public by its route and answered as each measure's
 * page answers the caller, a member refused the superadmin's measures, a team and the questions searches asked
 * (platform-query.ts).
 *
 * Fleet's reads are answered the same way. `GET /api/console/platform/usage` and `/platform/knowledge` are public, the
 * superadmin's answer naming the teams and the questions a member's leaves out; `GET /api/console/platform/audit` is
 * the superadmin's alone and refused like a report. `GET /api/console/teams`, `/teams/:slug` and `/people` are the
 * superadmin's reads with each team's and person's figures, filtered and paged; a member is still answered their own
 * team's records in the fields they had before.
 *
 * Work's reads are the caller's active team's, for the superadmin too, and `?team=` or `?scope=platform` widen nothing:
 * `GET /api/console/home`, `/record?period`, `/approvals?tab`, the paged `/initiatives?state&flow&q&limit&offset` and the
 * prepared `/work/query`, one fixture each, the approvals in them the caller's own. One initiative,
 * `/initiatives/:team/:slug`, and one document, `/document/:team/:initiative/*`, are the active team's alone, as the
 * gateway answers them since reconciliations 31 and 39: another team's is the route's not-found. `POST
 * /api/console/initiatives/:team/:slug/close` is answered as the platform decides a close and refuses one, and forgotten
 * like every other write.
 *
 * The rest of Work is the active team's too, one fixture per read: `GET /api/console/knowledge/summary` and the paged
 * `/knowledge?q&kind&limit&offset`, `/activity/summary` and the paged `/activity?kind&tool&initiative&refused&limit&offset`,
 * `/runs?skill&limit&offset`, and the team's use of the catalog in `/plugins`, `/skills?plugin` and `/skills/:name`, whose
 * public scores are everybody's. `GET /api/console/access` is the caller's alone, and so are its two revokes,
 * `DELETE /api/console/settings/me/applications/:client` and `/settings/me/browsers/:id`, answered as the platform
 * decides them and forgotten. A superadmin who acts for no team is refused Work's reads, as the gateway refuses them.
 * A lesson on the shared shelf (`zz-platform`) opens for anyone signed in, marked `shared`; another team's still does not.
 *
 * `POST /api/console/settings/me/active-team` is the one write that is kept: the team it moves a session to stays that
 * cookie's for the life of the process, as the gateway keeps it on the session's own row, so every read after it is
 * answered for the new team. It is refused as the gateway refuses it: a team the person is not in, or a caller who is
 * not a signed-in browser. A third cookie value, `member-two-teams`, signs in the member as a member of two teams.
 */
import http from 'node:http';
import type { Me } from '../../src/lib/api-shapes.ts';
import { COLLECTIONS, hint, liveStreams, parseNames, serveLive } from './live.ts';
import { ME, MEMBER, clientSetupOf, signedIn, teamsOf, tokensOf } from './people.ts';
import { audit } from './platform-audit.ts';
import { badFilter, bugReport, bugs, duplicates, resolve } from './platform-bugs.ts';
import { evaluation } from './platform-evaluation.ts';
import { knowledge } from './platform-knowledge.ts';
import { PLATFORM_PEOPLE, people, teamMembers } from './platform-people.ts';
import { platformQuery } from './platform-query.ts';
import { releaseDetail, releases } from './platform-releases.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from './platform-status.ts';
import { TEAMS, team, teams } from './platform-teams.ts';
import { usage } from './platform-usage.ts';
import { pluginEval, skillText } from './platform.ts';
import { search } from './search.ts';
import { empty, extreme } from './states.ts';
import { NOT_RECORDED, STATES, isState, nullsFilled, partial, sessionOf, unknownState, type State } from './states-partial.ts';
import { KNOWLEDGE_LOG, documentDetail, documentRevision, initiativeDetail, refusesRecord, revisionInStore } from './work.ts';
import { access, revokeApplication, revokeBrowser } from './work-access.ts';
import { activityLog, activitySummary, NO_TEAM } from './work-activity.ts';
import { approvals } from './work-approvals.ts';
import { home } from './work-home.ts';
import { close, initiativeList } from './work-initiatives.ts';
import { knowledgeList, knowledgeSummary, lesson, SHARED_TEAM } from './work-knowledge.ts';
import { plugins, skillDetail, skills } from './work-plugins.ts';
import { workQuery } from './work-query.ts';
import { record } from './work-record.ts';
import { runs } from './work-runs.ts';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1] ?? 0) || 0;
const MODES: readonly string[] = STATES;
const started = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'normal';
if (!isState(started)) throw new Error(`--mode ${started}: ${MODES.join(', ')}`);
let mode: State = started;

const SIGNED_OUT = /^\/(login|enrol|signed-out)(\/|$)/;

type Answer = [status: number, body: unknown];
const ok = (body: unknown): Answer => [200, body];
const missing = (what: string): Answer => [404, { error: `${what} does not exist on this deployment` }];
const or404 = (body: unknown, what: string): Answer => (body ? ok(body) : missing(what));
/** Platform's refusals: a fixed sentence that names no role, person or team, and a 404 that echoes nothing asked. */
const REFUSED: Answer = [403, { error: 'not permitted' }];
const UNKNOWN: Answer = [404, null];

/**
 * The member as a second team would make him: admin of his own and a member of Beacon. Here rather than among the
 * personas because only a team switch reads him, and every fixture keyed by his address answers him as the member.
 */
const TWO_TEAMS = 'member-two-teams';
const MEMBER_OF_TWO: Me = { ...MEMBER, teams: [...MEMBER.teams, { slug: 'beacon', role: 'member' }] };
/** The superadmin as the platform answers one in no team, who acts for none: what a Work read refuses by saying so. */
const IN_NO_TEAM = 'superadmin-in-no-team';
const SUPERADMIN_OF_NONE: Me = { ...ME, teams: [], activeTeam: null };

/** The `zz_console` cookie's value, or null when the request carries none. */
function cookieOf(header: string | undefined): string | null {
  const session = (header ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith('zz_console='));
  return session === undefined ? null : session.slice('zz_console='.length);
}

/** The team each cookie's session was switched to: the gateway's `console_session.team_id`. */
const switched = new Map<string, string>();

/**
 * Who a request is from, acting for the team its session was last switched to. The person is the session value before
 * any `+`; the switch is kept for the whole value, so a session asking for a state is a session of its own, and a press
 * of "Act as this team" in a suite reading the normal state never moves it.
 */
function callerOf(cookie: string | null): Me | null {
  const { person } = sessionOf(cookie);
  const who = person === TWO_TEAMS ? MEMBER_OF_TWO : person === IN_NO_TEAM ? SUPERADMIN_OF_NONE : signedIn(person === null ? undefined : `zz_console=${person}`);
  const team = cookie === null ? undefined : switched.get(cookie);
  return who && team ? { ...who, activeTeam: team } : who;
}

/**
 * `POST /settings/me/active-team`, as the gateway answers it: a signed-in browser alone, a slug, a team the person is
 * in, and `{ ok, actingFor, from }`.
 *
 * DELIBERATE: a request with no cookie is answered and not kept. It is every browser `pnpm verify` runs side by side,
 * the audit, the presses and the keyboard walk, so one press of "Act as this team" would move the others mid-run.
 */
function switchTeam(who: Me, cookie: string | null, body: Record<string, unknown>): Answer {
  if (who.via !== 'session') return [400, { error: 'this moves the team a signed-in console browser acts for, and this request is not one. To move the team your agents act for, call team_switch on the /manage door.' }];
  const team = body.team;
  if (typeof team !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(team)) return [400, { error: 'team must be a slug' }];
  if (!who.teams.some((t) => t.slug === team)) return [400, { error: `not a member of ${team}` }];
  if (cookie !== null) switched.set(cookie, team);
  return ok({ ok: true, actingFor: team, from: who.activeTeam });
}

/** The one team a member is held to; nothing for a superadmin, who may open any team's records. */
const heldTo = (who: Me): string | null => (who.superadmin ? null : who.activeTeam);

/**
 * One GET under `/api/console`, by path segments and query, as `who`.
 *
 * A member is answered as the gateway's own scope answers them (`resolveScope` in services/gateway/src/scope.ts):
 * `?scope=platform` is honoured for a superadmin and otherwise answers what the request would have got without it, a
 * team they are not in is refused by name, and another team's record is answered as one that does not exist, never
 * with a 403 that would confirm it does.
 */
function read(who: Me, seg: string[], q: URLSearchParams): Answer {
  const platform = q.get('scope') === 'platform' && who.superadmin;
  const [head, a, b, ...rest] = seg;
  switch (head) {
    case 'me': return ok(who);
    case 'home': return a ? missing(seg.join('/')) : ok(home(who));
    case 'record': return a ? missing(seg.join('/')) : record(who, q);
    case 'approvals': return a ? missing(seg.join('/')) : approvals(who, q);
    case 'work': return a === 'query' && !b ? workQuery(who, q) : missing(seg.join('/'));
    // Whom Teams and People answer, and in which shape, is their fixtures' to decide: the superadmin's read, filtered
    // and paged, and the gateway's refusal to anybody else.
    case 'teams': return a ? team(who, a) : teams(who, q, page(q)) ?? BAD_PAGE;
    case 'initiatives': {
      // One initiative is the active team's, for the superadmin too, as the gateway answers it since reconciliations 31
      // and 39: another team's is the route's not-found, and a caller who acts for no team is told so.
      if (a && b) {
        if (!who.activeTeam) return NO_TEAM;
        return a !== who.activeTeam ? missing(`initiative ${a}/${b}`) : or404(initiativeDetail(a, b), `initiative ${a}/${b}`);
      }
      // Work is the active team's: the list answers it alone, whatever `?team=` or `?scope=` asked.
      return a ? missing(seg.join('/')) : initiativeList(who, q);
    }
    case 'document': {
      // A document the same way: the active team's alone, whatever the address or the request names.
      const rev = q.get('revision');
      if (!who.activeTeam) return NO_TEAM;
      if (a !== who.activeTeam) return missing(rev === null ? `document ${seg.slice(1).join('/')}` : `revision ${rev} of ${seg.slice(1).join('/')}`);
      if (rev !== null) return or404(documentRevision(a, b, rest.join('/'), Number(rev)), `revision ${rev} of ${seg.slice(1).join('/')}`);
      return or404(documentDetail(a, b, rest.join('/')), `document ${seg.slice(1).join('/')}`);
    }
    case 'knowledge':
      // The summary answers before the node route, because `summary` names no team of its own.
      if (a === 'summary' && !b) return knowledgeSummary(who);
      if (a === 'log') return ok({ entries: KNOWLEDGE_LOG.filter((r) => r.team === who.activeTeam) });
      // A lesson is the active team's, for the superadmin too, as the gateway answers it; the shared shelf is nobody's
      // own, so any signed-in person opens its lessons, read-only. A team or a scope the request names widens nothing.
      if (a) {
        if (!who.activeTeam) return NO_TEAM;
        if (a !== who.activeTeam && a !== SHARED_TEAM) return missing(`knowledge ${seg.slice(1).join('/')}`);
        return or404(lesson(a, [b, ...rest].join('/'), who.activeTeam), `knowledge ${seg.slice(1).join('/')}`);
      }
      return knowledgeList(who, q);
    case 'search': {
      // As the gateway answers it: one team's search and never the fleet's, a question required, a limit from 1 to 50.
      if (platform) return [400, { error: "search runs as one team and the platform's shared shelf — it has no fleet-wide reading, so not ?scope=platform" }];
      const question = (q.get('q') ?? '').trim();
      if (!question) return [400, { error: 'q required — the question to search for' }];
      const limit = q.get('limit') === null ? 15 : Number(q.get('limit'));
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return [400, { error: 'limit must be a whole number from 1 to 50' }];
      return ok(search(question, limit, q.get('initiative'), who.activeTeam ?? ''));
    }
    case 'plugins':
      // A plugin's evaluation is its owning team's words: the superadmin and that team alone, as the gateway answers it.
      if (a && b === 'eval') {
        const evaluation = pluginEval(a);
        return who.superadmin || (evaluation.found && evaluation.ownerTeam === who.activeTeam) ? ok(evaluation) : [403, { error: 'not permitted' }];
      }
      if (a && b === 'skills' && rest[0]) return or404(skillText(a, rest[0]), `skill ${a}/${rest[0]}`);
      return a ? missing(seg.join('/')) : plugins(who);
    case 'skills': return b ? missing(seg.join('/')) : a ? skillDetail(who, a) : skills(who, q);
    case 'people': return people(who, q, page(q)) ?? BAD_PAGE;
    case 'runs': return a ? missing(seg.join('/')) : runs(who, q);
    case 'activity':
      if (a === 'summary' && !b) return activitySummary(who);
      return a ? missing(seg.join('/')) : activityLog(who, q);
    case 'access': return a ? missing(seg.join('/')) : access(who);
    case 'settings':
      if (a === 'me' && b === 'tokens') return ok(tokensOf(who));
      if (a === 'me' && b === 'client-setup') return ok(clientSetupOf(who));
      if (a === 'me' && b === 'teams') return ok(teamsOf(who));
      if (a === 'team' && b === 'members') {
        // The gateway's own guard (`teamAuthority`): a team's roster is for its admins and for a superadmin.
        const team = q.get('team') ?? '';
        if (!who.superadmin && !who.teams.some((t) => t.slug === team && t.role === 'admin')) return [403, { error: `team admin or superadmin required for ${team}` }];
        return ok(teamMembers(team));
      }
      if (a === 'platform' && b === 'people') return who.superadmin ? ok(PLATFORM_PEOPLE) : [403, { error: 'superadmin required' }];
      return missing(`settings/${a}/${b}`);
    case 'platform': return platformRead(who, seg, q);
    default: return missing(seg.join('/'));
  }
}

/** `?limit&offset` as Platform's lists take them: 10 rows by default, at most 100, from a whole offset of 0 or more. */
function page(q: URLSearchParams): { limit: number; offset: number } | null {
  const limit = Number(q.get('limit') ?? 10);
  const offset = Number(q.get('offset') ?? 0);
  return Number.isInteger(limit) && limit >= 1 && limit <= 100 && Number.isInteger(offset) && offset >= 0 ? { limit, offset } : null;
}
const BAD_PAGE: Answer = [400, { error: 'limit must be a whole number from 1 to 100, and offset one from 0' }];

/**
 * One GET under `/api/console/platform`. Public by its route, not by a parameter: `?scope=` and `?team=` change
 * nothing, and the status is answered alike to everyone but for a member's `needs`, in the gateway's member projection.
 * A report, its duplicate targets and the audit are the superadmin's.
 */
function platformRead(who: Me, seg: string[], q: URLSearchParams): Answer {
  const [, what, id, sub, ...more] = seg;
  const p = page(q);
  if (more.length) return missing(seg.join('/'));
  switch (what) {
    case 'status': return id === undefined ? ok(who.superadmin ? PLATFORM_STATUS : MEMBER_STATUS) : missing(seg.join('/'));
    case 'releases':
      if (sub !== undefined) return missing(seg.join('/'));
      if (id !== undefined) { const release = releaseDetail(id); return release ? ok(release) : UNKNOWN; }
      return p ? ok(releases(p.limit, p.offset)) : BAD_PAGE;
    case 'bugs': {
      if (sub !== undefined && sub !== 'duplicates') return missing(seg.join('/'));
      if (id === undefined) {
        const filter = { state: q.get('state'), impact: q.get('impact'), surface: q.get('surface') };
        const bad = badFilter(filter);
        if (bad) return [400, { error: bad }];
        return p ? ok(bugs(who.superadmin, filter, p.limit, p.offset)) : BAD_PAGE;
      }
      if (!who.superadmin) return REFUSED;
      const found = sub === undefined ? bugReport(id) : duplicates(id);
      return found ? ok(found) : UNKNOWN;
    }
    case 'evaluation': return id === undefined ? ok(evaluation(who.superadmin)) : missing(seg.join('/'));
    case 'usage': return id === undefined ? ok(usage(who.superadmin)) : missing(seg.join('/'));
    case 'knowledge': return id === undefined ? ok(knowledge(who.superadmin, who.activeTeam)) : missing(seg.join('/'));
    case 'audit':
      if (id !== undefined) return missing(seg.join('/'));
      if (!who.superadmin) return REFUSED;
      return audit(q, p) ?? BAD_PAGE;
    case 'query': return id === undefined ? platformQuery(who, q) : missing(seg.join('/'));
    default: return missing(seg.join('/'));
  }
}

/** The review context the console is handed on a document's first showing: `rc_` and 26 base32 characters. */
const CONSOLE_CONTEXT = 'rc_consolereviewcontextfakeaa';

/**
 * The console's presentation (`documents/shown`) and its approval (`documents/approve`), as the gateway takes them: one
 * team, never `?scope=platform`; a document of the team the session acts for, which is the team zz-core acts in; the
 * snapshot the page holds checked against the store's; and Approve signing only under the context `shown` answered.
 * Every 409 carries the gateway's own sentence (`staleAnswer` in services/gateway/src/console-write.ts), and its
 * `detail` the zz-core opening the gateway reads.
 *
 * DELIBERATE: one context for every presentation. zz-core continues the context a page hands back and starts a new one
 * for an unknown one; either way the page holds what it was answered, which is all the console reads.
 */
function present(who: Me, signing: boolean, q: URLSearchParams, body: Record<string, unknown>): Answer {
  const team = q.get('team');
  if (!team) return [400, { error: `${signing ? 'approve' : 'shown'} needs one team — pass ?team=<slug>, not ?scope=platform` }];
  const [initiative, path, held, context] = [body.initiative, body.path, signing ? body.expected_revision : body.content_revision, body.review_context]
    .map((v) => (typeof v === 'string' ? v : ''));
  if (!initiative || !path || !held || (signing && !context)) {
    return [400, { error: signing ? 'initiative, path, expected_revision and review_context required' : 'initiative, path and content_revision required' }];
  }
  const store = team === who.activeTeam ? revisionInStore(team, initiative, path) : null;
  if (!store) return [400, { error: `ERROR: ${initiative}/${path} is not a document of ${who.activeTeam ?? 'any team'}.` }];
  // zz-core's refusal when it resolves no team for the caller, which the gateway answers 400 with zz-core's sentence.
  if (!signing && refusesRecord(team, initiative, path)) return [400, { error: 'the console is not acting for the team this document belongs to, so there is nowhere to record it' }];
  if (held !== store) {
    return [409, signing
      ? { conflict: 'changed', error: `${path} changed after this page showed it, so it was not approved. Reload to read what it says now, then approve that.`,
          detail: `ERROR: APPROVAL_CONFLICT — ${initiative}/${path} is at content revision ${store}, not ${held}.` }
      : { conflict: 'changed', error: `${path} changed after this page loaded it. Reload to read what it says now.`,
          detail: `ERROR: ${initiative}/${path} is at content revision ${store} now, not ${held}.` }];
  }
  if (!signing) return ok({ ok: true, review_context: CONSOLE_CONTEXT, content_revision: held, recorded: true });
  if (context !== CONSOLE_CONTEXT) {
    return [409, { conflict: 'unshown', error: `${path} was not approved: the console has no record of showing you what it says now. Reload the page, then approve.`,
                   detail: `ERROR: PRESENTATION_REQUIRED — the review context ${context} is not one of yours for ${initiative}/${path}.` }];
  }
  return ok({ ok: true, result: `Approved ${initiative}/${path}.` });
}

/**
 * The features a page view may name: the console's feature table's. A closed list, as the gateway's is, so an address
 * or a record's name can never be recorded as one. COUPLED: the gateway's console/page-view.ts keeps the list this one
 * copies.
 */
const PAGE_FEATURES = [
  'home', 'record', 'initiatives', 'approvals', 'knowledge', 'activity', 'runs', 'plugins', 'access',
  'platform-status', 'releases', 'bugs', 'bug', 'evaluation', 'teams', 'people', 'usage', 'audit', 'knowledge-health',
];

/** One write under `/api/console`, as `who`. Accepted, answered in the route's own shape, and not kept but for a team switch. */
function write(who: Me, cookie: string | null, seg: string[], q: URLSearchParams, method: string, body: Record<string, unknown>): Answer {
  const path = seg.join('/');
  // Reads with no write of their own: nothing starts an evaluation, and nothing here changes a team's record.
  if (['knowledge', 'activity', 'runs', 'plugins', 'skills', 'access'].includes(seg[0])) return missing(path);
  // `POST /api/console/platform/bugs/:id/resolve`: the superadmin's alone, refused before the report is looked for.
  const resolving = /^platform\/bugs\/([^/]+)\/resolve$/.exec(path);
  if (resolving && method === 'POST') {
    if (!who.superadmin) return REFUSED;
    const report = bugReport(resolving[1]);
    return report ? resolve(report, body) : UNKNOWN;
  }
  // `POST /api/console/initiatives/:team/:slug/close`: the facts of a close, the outcome the platform's to derive.
  const closing = /^initiatives\/([^/]+)\/([^/]+)\/close$/.exec(path);
  if (closing && method === 'POST') return close(who, closing[1], closing[2], body);
  // `POST /api/console/page-view`: one committed navigation, by its feature. Nothing to say back, so no body.
  if (path === 'page-view' && method === 'POST') {
    if (typeof body.feature !== 'string' || !body.feature) return [400, { error: 'feature required — the destination that was opened' }];
    if (!PAGE_FEATURES.includes(body.feature)) return [400, { error: `${body.feature} is not one of the console's destinations` }];
    return [204, null];
  }
  // `DELETE /api/console/settings/me/applications/:client` and `/browsers/:id`: the caller's own, from a browser alone.
  const revoking = /^settings\/me\/(applications|browsers)\/([^/]+)$/.exec(path);
  if (revoking && method === 'DELETE') {
    if (who.via !== 'session') return [400, { error: 'revoke this from the console, signed in: a token cannot revoke what signs you in' }];
    const answer = revoking[1] === 'applications' ? revokeApplication(who, revoking[2]) : revokeBrowser(who, revoking[2]);
    if (answer[0] === 200) hint('settings');
    return answer;
  }
  if (path === 'settings/me/tokens' && method === 'POST') {
    hint('settings');
    return ok({ token: 'zz_pat_example_0123456789abcdef', label: String(body.label ?? 'console'), email: who.email });
  }
  if (path === 'documents/shown' || path === 'documents/approve') {
    const answer = present(who, path === 'documents/approve', q, body);
    // An approval changes what the initiative's own page shows (the document's approval state) and the bell's
    // projection of what waits on a person, so both are told. A refused approval changed nothing and says nothing.
    if (answer[0] === 200 && path === 'documents/approve') hint('initiatives');
    return answer;
  }
  if (path === 'settings/me/active-team' && method === 'POST') return switchTeam(who, cookie, body);
  if (path === 'settings/platform/enrolments') return ok({ ok: true, url: 'https://console.example.com/enrol#t=example-enrolment', result: `An enrolment link for ${String(body.email)}` });
  return ok({ ok: true, result: `${method} ${path}: done`, revoked: seg.at(-1) });
}

/** The passkey routes: status says passkeys are configured; a ceremony is refused, since there is no authenticator here. */
function auth(seg: string[]): Answer {
  if (seg[0] === 'status') return ok({ configured: true, rpId: 'localhost' });
  return [400, { error: 'This preview has no passkey to offer. Sign in on the deployment.' }];
}

/**
 * How many times each collection has been read since this process started, and the last path that was read.
 *
 * A check needs to see that a tab READ a collection again, not only that what it read changed — the bell's own read is
 * the case that matters and its content is a fixture nothing can alter. Counting is the honest observation: it says a
 * request arrived, which is exactly what "the tab read it again" means.
 */
const reads = new Map<string, number>();
const countRead = (resource: string) => { reads.set(resource, (reads.get(resource) ?? 0) + 1); };

/** The session values whose unread figures are answered as a stand-in (`__nulls`). */
const standingIn = new Set<string>();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://fake');
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const referer = (() => { try { return new URL(req.headers.referer ?? '').pathname; } catch { return ''; } })();
    const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const cookie = cookieOf(req.headers.cookie);
    const who = callerOf(cookie);
    // The state this request is drawn in: the one its session value names, or the process-wide mode.
    const asked = sessionOf(cookie).state;
    const state: string = asked ?? mode;
    const status = req.method === 'GET' && url.pathname === '/api/console/platform/status';
    let answer: Answer;
    /* The test hooks wear the proxied prefix — `/api/console/__hint` — so a browser check reaches them through the app's
     * own origin and never needs to know the gateway's address, which the app's build baked in and nothing serves back.
     * The real gateway has no such routes; a check names them anyway, and against a real gateway it gets a 404. */
    const hook = seg[0] === 'api' && seg[1] === 'console' ? seg[2] : seg[0];
    // `/api/console/__mode?set=empty` switches the world without a rebuild: the build bakes in one gateway address.
    if (hook === '__mode') {
      const next = url.searchParams.get('set') ?? '';
      if (isState(next)) mode = next;
      res.writeHead(MODES.includes(next) || !next ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ mode }));
      return;
    }
    /**
     * The live checks' two hooks, beside `__mode`.
     *
     * `/api/console/__hint?collection=teams` tells every open tab that the collection changed, which is the only way a
     * check can fire a change at a moment it chose. `&rename=<slug>:<name>` first renames one of the fixture's own
     * teams, so a check has something to see arrive: a hint alone proves a tab was told, the new name proves the tab
     * went and read again.
     *
     * DELIBERATE, and it is why this renames rather than adds: `verify` runs the checks and the presses suite against
     * ONE gateway at the same time, so anything this records is also something the presses see. A row this added would
     * be a link the presses would follow to a team page the fixture does not know, which is a 404 this check caused and
     * another suite would report. A rename changes no row, adds no link, and is undone by the next run's fresh process.
     * The console itself never touches this — its own writes are still answered and forgotten.
     *
     * `/api/console/__streams` says how many tabs are following something, so a check waits for a stream to open
     * rather than guessing.
     */
    if (hook === '__hint') {
      const collection = url.searchParams.get('collection') ?? '';
      const rename = url.searchParams.get('rename');
      let renamed: string | null = null;
      if (rename) {
        const [slug, ...rest] = rename.split(':');
        const team = TEAMS.find((t) => t.slug === slug);
        if (team && rest.length) { team.name = rest.join(':'); renamed = team.slug; }
      }
      const reached = (COLLECTIONS as readonly string[]).includes(collection) ? hint(collection) : 0;
      res.writeHead(reached ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ collection, reached, renamed, reads: Object.fromEntries(reads) }));
      return;
    }
    /*
     * `/api/console/__nulls?session=<value>&on=1` answers every figure that session value is sent as null as a number
     * no fixture holds, until `on=0`, so scripts/states-check.ts can see whether a page drew a zero for one. Only a
     * session that names a state can be asked for, which no suite but that check sends: nothing the others read moves.
     */
    if (hook === '__nulls') {
      const value = url.searchParams.get('session') ?? '';
      const fine = sessionOf(value).state !== null && isState(sessionOf(value).state!);
      if (fine && url.searchParams.get('on') === '1') standingIn.add(value);
      else standingIn.delete(value);
      res.writeHead(fine ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ session: value, standingIn: standingIn.has(value) }));
      return;
    }
    if (hook === '__streams') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ streams: liveStreams(), collections: COLLECTIONS, reads: Object.fromEntries(reads) }));
      return;
    }
    // The live stream is not an answer to be serialised: it is a response held open, so it is served before the
    // JSON path below, which would otherwise write a head and end it.
    // A session value asking for a state this fake does not draw is told so, before anything is read or answered.
    if (asked !== null && !isState(asked)) {
      const [code, body] = unknownState(cookie!, asked);
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }
    if (seg[0] === 'api' && seg[1] === 'console' && seg[2] === 'live') {
      if (req.method !== 'GET') { res.writeHead(405, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'GET only' })); return; }
      if (state === 'error') { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'The gateway could not reach its database.' })); return; }
      const parsed = parseNames(url.searchParams.get('collections'));
      if ('status' in parsed) { res.writeHead(parsed.status, { 'content-type': 'text/plain; charset=utf-8' }); res.end(parsed.error); return; }
      // A visitor on the screens before sign-in has no session, and neither has a cookie this fixture does not know.
      if (!who || SIGNED_OUT.test(referer)) { res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Sign in to continue.'); return; }
      serveLive(res, parsed.names);
      return;
    }
    if (seg[0] === 'auth') answer = auth(seg.slice(1));
    else if (seg[0] !== 'api' || seg[1] !== 'console') answer = missing(url.pathname);
    else if (!who || (seg[2] === 'me' && SIGNED_OUT.test(referer))) answer = [401, { error: 'not signed in' }];
    // The status read fails as its own route does when a query fails; every other route, as a gateway with no database.
    else if (state === 'error' && status) answer = [500, { error: "could not read the platform's status" }];
    else if (state === 'error' && seg[2] !== 'me') answer = [503, { error: 'The gateway could not reach its database: connection to 10.0.0.12:5432 refused. Nothing was changed.' }];
    else if (req.method === 'GET') {
      if (seg[2]) countRead(seg[2]);
      answer = read(who, seg.slice(2), url.searchParams);
      // A transform reads the answer by its own idea of the route's shape, so a route that grows a
      // second answer shape reaches it as something it does not recognise. That threw OUT of this
      // handler and killed the process: every page after it reported "cannot reach the platform",
      // and the shape that caused it was the only thing NOT visible in the report. A mode that
      // cannot shape an answer serves it unshaped and says so.
      const shape = (what: string, f: (seg: string[], body: unknown) => unknown) => {
        try { return f(seg.slice(2), answer[1]); }
        catch (err) {
          console.error(`fake-gateway: ${what} could not shape ${url.pathname} — serving it as it is:`, (err as Error).message);
          return answer[1];
        }
      };
      // Every state is handed the request's own query, so a second page is drawn as a second page.
      if (answer[0] === 200 && state === 'empty') {
        const fresh = shape('empty', (s, body) => empty(s, body, url.searchParams));
        answer = fresh === NOT_RECORDED ? UNKNOWN : [200, fresh];
      }
      if (answer[0] === 200 && state === 'extreme') answer = [200, shape('extreme', (s, body) => extreme(s, body, heldTo(who), url.searchParams, who.activeTeam))];
      if (answer[0] === 200 && state === 'partial') answer = [200, shape('partial', partial)];
      if (answer[0] === 200 && cookie !== null && standingIn.has(cookie)) answer = [200, nullsFilled(answer[1])];
    }
    else answer = write(who, cookie, seg.slice(2), url.searchParams, req.method ?? 'POST', (() => { try { return JSON.parse(raw || '{}') ?? {}; } catch { return {}; } })());
    // `slow` holds a page's reads and spares `/me`, as `error` does: who is asking is answered at once, so the page's own
    // loading state is what shows. The status read is held past the five seconds its page gives it.
    setTimeout(() => {
      // A 204, or a 404 that says nothing, has no body to serialise, and a client that is sent one reads it wrong.
      if (answer[1] === null) { res.writeHead(answer[0], { 'cache-control': 'no-store' }); res.end(); return; }
      res.writeHead(answer[0], { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(answer[1]));
    }, state !== 'slow' || (seg[2] === 'me' && !seg[3]) ? 0 : status ? 6000 : 4000);
  });
});

server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address() as { port: number };
  // verify.ts reads this line to learn the address.
  console.log(`fake-gateway listening on http://127.0.0.1:${p}${mode === 'normal' ? '' : ` (${mode})`}`);
});

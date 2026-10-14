/**
 * A fake ZZ gateway: answers every `/api/console/*` and `/auth/*` route the console calls, from
 * the synthetic fixtures beside this file, and changes nothing anywhere.
 *
 *   node scripts/fake-gateway/server.ts [--port 0] [--mode normal|empty|error|slow|extreme]
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
 * answer waits four seconds, so the loading state can be looked at), `extreme` (a busy platform: six-figure counts,
 * hundreds of rows, names longer than any layout planned for). `GET /__mode?set=<mode>` switches it while running.
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
 *
 * Fleet's reads are answered the same way. `GET /api/console/platform/usage` and `/platform/knowledge` are public, the
 * superadmin's answer naming the teams and the questions a member's leaves out; `GET /api/console/platform/audit` is
 * the superadmin's alone and refused like a report. `GET /api/console/teams`, `/teams/:slug` and `/people` are the
 * superadmin's reads with each team's and person's figures, filtered and paged; a member is still answered their own
 * team's records in the fields they had before.
 *
 * Work's reads are the caller's active team's, for the superadmin too, and `?team=` or `?scope=platform` widen nothing:
 * `GET /api/console/home`, `/record?period`, `/approvals?tab`, the paged `/initiatives?state&flow&q&limit&offset` and the
 * prepared `/work/query`, one fixture each, the approvals in them the caller's own. `?waiting=1` still answers the
 * bell's projection. `POST /api/console/initiatives/:team/:slug/close` is answered as the platform decides a close and
 * refuses one, and forgotten like every other write.
 */
import http from 'node:http';
import type { Me, Overview } from '../../src/lib/api-shapes.ts';
import { COLLECTIONS, hint, liveStreams, parseNames, serveLive } from './live.ts';
import { clientSetupOf, signedIn, teamsOf, tokensOf } from './people.ts';
import { audit } from './platform-audit.ts';
import { badFilter, bugReport, bugs, duplicates, resolve } from './platform-bugs.ts';
import { evaluation } from './platform-evaluation.ts';
import { knowledge } from './platform-knowledge.ts';
import { PLATFORM_PEOPLE, people, rosterOf, teamMembers } from './platform-people.ts';
import { releaseDetail, releases } from './platform-releases.ts';
import { MEMBER_STATUS, PLATFORM_STATUS } from './platform-status.ts';
import { TEAMS, team, teams } from './platform-teams.ts';
import { usage } from './platform-usage.ts';
import { ACTIVITY, PLUGINS, SKILLS, overview, pluginEval, runs, skillDetail, skillText } from './platform.ts';
import { search } from './search.ts';
import { empty, extreme } from './states.ts';
import { KNOWLEDGE, KNOWLEDGE_LOG, WAITING, documentDetail, documentRevision, initiativeDetail, knowledgeBody, refusesRecord, revisionInStore } from './work.ts';
import { approvals } from './work-approvals.ts';
import { home } from './work-home.ts';
import { close, initiativeList } from './work-initiatives.ts';
import { workQuery } from './work-query.ts';
import { record } from './work-record.ts';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1] ?? 0) || 0;
const MODES = ['normal', 'empty', 'error', 'slow', 'extreme'];
let mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'normal';
if (!MODES.includes(mode)) throw new Error(`--mode ${mode}: ${MODES.join(', ')}`);

const SIGNED_OUT = /^\/(login|enrol|signed-out)(\/|$)/;

type Answer = [status: number, body: unknown];
const ok = (body: unknown): Answer => [200, body];
const missing = (what: string): Answer => [404, { error: `${what} does not exist on this deployment` }];
const or404 = (body: unknown, what: string): Answer => (body ? ok(body) : missing(what));
/** Platform's refusals: a fixed sentence that names no role, person or team, and a 404 that echoes nothing asked. */
const REFUSED: Answer = [403, { error: 'not permitted' }];
const UNKNOWN: Answer = [404, null];

/** The one team a member is held to; nothing for a superadmin, who may open any team's records. */
const heldTo = (who: Me): string | null => (who.superadmin ? null : who.activeTeam);

/** The census as one team's, the way the gateway counts it in team scope: one team, its own people and work, and no
 *  event without a team. */
function teamCensus(o: Overview, team: string): Overview {
  const t = TEAMS.find((x) => x.slug === team);
  const people = rosterOf(team);
  return { ...o, counts: {
    ...o.counts, teams: 1, activeTeams: t?.status === 'active' ? 1 : 0, people: people.length, superadmins: people.filter((p) => p.role === 'superadmin').length,
    documents: t?.documents ?? 0, initiatives: t?.initiatives ?? 0, unattributedEvents: 0,
  } };
}

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
  const own = heldTo(who);
  const foreign = (team: string | undefined) => own !== null && team !== own;
  const mine = <T extends { team: string | null }>(rows: T[]) => (platform ? rows : rows.filter((r) => r.team === who.activeTeam));
  const period = q.get('period') ?? 'all';
  const [head, a, b, ...rest] = seg;
  switch (head) {
    case 'me': return ok(who);
    case 'overview': return ok(own ? teamCensus(overview(period), own) : overview(period));
    case 'home': return a ? missing(seg.join('/')) : ok(home(who));
    case 'record': return a ? missing(seg.join('/')) : record(who, q);
    case 'approvals': return a ? missing(seg.join('/')) : approvals(who, q);
    case 'work': return a === 'query' && !b ? workQuery(who, q) : missing(seg.join('/'));
    // Whom Teams and People answer, and in which shape, is their fixtures' to decide: the superadmin's read, filtered
    // and paged, and the gateway's refusal to anybody else.
    case 'teams': return a ? team(who, a) : teams(who, q, page(q)) ?? BAD_PAGE;
    case 'initiatives': {
      // The bell's own projection — see WAITING in work.ts. It answers before the detail route,
      // because `?waiting=1` names no initiative of its own.
      if (q.get('waiting') === '1') return ok({ waiting: mine(WAITING) });
      if (a && b) return foreign(a) ? missing(`initiative ${a}/${b}`) : or404(initiativeDetail(a, b), `initiative ${a}/${b}`);
      // Work is the active team's: the list answers it alone, whatever `?team=` or `?scope=` asked.
      return a ? missing(seg.join('/')) : initiativeList(who, q);
    }
    case 'document': {
      const rev = q.get('revision');
      if (foreign(a)) return missing(rev === null ? `document ${seg.slice(1).join('/')}` : `revision ${rev} of ${seg.slice(1).join('/')}`);
      if (rev !== null) return or404(documentRevision(a, b, rest.join('/'), Number(rev)), `revision ${rev} of ${seg.slice(1).join('/')}`);
      return or404(documentDetail(a, b, rest.join('/')), `document ${seg.slice(1).join('/')}`);
    }
    case 'knowledge':
      if (a === 'log') return ok({ entries: mine(KNOWLEDGE_LOG) });
      if (a) return foreign(a) ? missing(`knowledge ${seg.slice(1).join('/')}`) : or404(knowledgeBody(a, [b, ...rest].join('/'), own), `knowledge ${seg.slice(1).join('/')}`);
      return ok({ nodes: mine(KNOWLEDGE) });
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
      return ok({ plugins: PLUGINS });
    case 'skills': return a ? or404(skillDetail(a), `skill ${a}`) : ok({ skills: SKILLS });
    case 'people': return people(who, q, page(q)) ?? BAD_PAGE;
    case 'runs': return ok(runs(period));
    case 'activity': {
      const limit = Number(q.get('limit') ?? 200);
      const events = mine(ACTIVITY).filter((e) => q.get('failed') !== '1' || e.ok === false).slice(0, limit);
      return ok({ events, limit });
    }
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
 * The features a page view may name: the destinations the console's feature table will hold when every phase has
 * landed, and the ones today's pages have. A closed list, as the gateway's is, so an address or a record's name can
 * never be recorded as one. COUPLED: the gateway's console/page-view.ts keeps the list this one copies.
 */
const PAGE_FEATURES = [
  'home', 'record', 'initiatives', 'approvals', 'knowledge', 'activity', 'runs', 'plugins', 'access', 'settings',
  'platform-status', 'releases', 'bugs', 'bug', 'evaluation', 'teams', 'people', 'usage', 'audit', 'knowledge-health',
];

/** One write under `/api/console`, as `who`. Accepted, answered in the route's own shape, and not kept. */
function write(who: Me, seg: string[], q: URLSearchParams, method: string, body: Record<string, unknown>): Answer {
  const path = seg.join('/');
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
  if (path === 'settings/me/active-team') return ok({ actingFor: String(body.team ?? who.activeTeam) });
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://fake');
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const referer = (() => { try { return new URL(req.headers.referer ?? '').pathname; } catch { return ''; } })();
    const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const who = signedIn(req.headers.cookie);
    const status = req.method === 'GET' && url.pathname === '/api/console/platform/status';
    let answer: Answer;
    /* The test hooks wear the proxied prefix — `/api/console/__hint` — so a browser check reaches them through the app's
     * own origin and never needs to know the gateway's address, which the app's build baked in and nothing serves back.
     * The real gateway has no such routes; a check names them anyway, and against a real gateway it gets a 404. */
    const hook = seg[0] === 'api' && seg[1] === 'console' ? seg[2] : seg[0];
    // `/api/console/__mode?set=empty` switches the world without a rebuild: the build bakes in one gateway address.
    if (hook === '__mode') {
      const next = url.searchParams.get('set') ?? '';
      if (MODES.includes(next)) mode = next;
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
    if (hook === '__streams') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ streams: liveStreams(), collections: COLLECTIONS, reads: Object.fromEntries(reads) }));
      return;
    }
    // The live stream is not an answer to be serialised: it is a response held open, so it is served before the
    // JSON path below, which would otherwise write a head and end it.
    if (seg[0] === 'api' && seg[1] === 'console' && seg[2] === 'live') {
      if (req.method !== 'GET') { res.writeHead(405, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'GET only' })); return; }
      if (mode === 'error') { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'The gateway could not reach its database.' })); return; }
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
    else if (mode === 'error' && status) answer = [500, { error: "could not read the platform's status" }];
    else if (mode === 'error' && seg[2] !== 'me') answer = [503, { error: 'The gateway could not reach its database: connection to 10.0.0.12:5432 refused. Nothing was changed.' }];
    else if (req.method === 'GET') {
      if (seg[2]) countRead(seg[2]);
      answer = read(who, seg.slice(2), url.searchParams);
      // A transform reads the answer by its own idea of the route's shape, so a route that grows a
      // second answer shape — `/initiatives?waiting=1` returns `{ waiting }` where the list returns
      // `{ initiatives }` — reaches it as something it does not recognise. That threw OUT of this
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
      if (answer[0] === 200 && mode === 'empty') answer = [200, shape('empty', empty)];
      if (answer[0] === 200 && mode === 'extreme') answer = [200, shape('extreme', (s, body) => extreme(s, body, heldTo(who)))];
    }
    else answer = write(who, seg.slice(2), url.searchParams, req.method ?? 'POST', (() => { try { return JSON.parse(raw || '{}') ?? {}; } catch { return {}; } })());
    setTimeout(() => {
      // A 204, or a 404 that says nothing, has no body to serialise, and a client that is sent one reads it wrong.
      if (answer[1] === null) { res.writeHead(answer[0], { 'cache-control': 'no-store' }); res.end(); return; }
      res.writeHead(answer[0], { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(answer[1]));
    }, mode !== 'slow' ? 0 : status ? 6000 : 4000);
  });
});

server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address() as { port: number };
  // verify.ts reads this line to learn the address.
  console.log(`fake-gateway listening on http://127.0.0.1:${p}${mode === 'normal' ? '' : ` (${mode})`}`);
});

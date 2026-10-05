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
 * Who is calling: the signed-in superadmin in `people.ts`, except on the screens a visitor sees
 * before signing in (`/login`, `/enrol`, `/signed-out`), where `/me` answers 401 as it does for a
 * browser with no session. The page's own address arrives as the Referer.
 *
 * Writes answer success and are forgotten, so every run starts from the same data.
 *
 * `--mode` draws the states a page has to design for, from the same routes: `empty` (a fresh deployment, nothing
 * recorded), `error` (every read but /me fails with the gateway's own sentence), `slow` (every answer waits four
 * seconds, so the loading state can be looked at), `extreme` (a busy platform: six-figure counts, hundreds of rows,
 * names longer than any layout planned for). `GET /__mode?set=<mode>` switches it while running.
 */
import http from 'node:http';
import { ME, MY_CLIENT_SETUP, MY_TEAMS, MY_TOKENS, PEOPLE, PLATFORM_PEOPLE, TEAMS, teamDetail, teamMembers } from './people.ts';
import { ACTIVITY, PLUGINS, SKILLS, overview, pluginEval, runs, skillDetail, skillText } from './platform.ts';
import { empty, extreme } from './states.ts';
import { INITIATIVES, KNOWLEDGE, KNOWLEDGE_LOG, WAITING, documentDetail, documentRevision, initiativeDetail, knowledgeBody } from './work.ts';

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

/** One GET under `/api/console`, by path segments and query. */
function read(seg: string[], q: URLSearchParams): Answer {
  const platform = q.get('scope') === 'platform';
  const mine = <T extends { team: string | null }>(rows: T[]) => (platform ? rows : rows.filter((r) => r.team === ME.activeTeam));
  const period = q.get('period') ?? 'all';
  const [head, a, b, ...rest] = seg;
  switch (head) {
    case 'me': return ok(ME);
    case 'overview': return ok(overview(period));
    case 'teams': return a ? or404(teamDetail(a), `team ${a}`) : ok({ teams: TEAMS });
    case 'initiatives':
      // The bell's own projection — see WAITING in work.ts. It answers before the detail route,
      // because `?waiting=1` names no initiative of its own.
      if (q.get('waiting') === '1') return ok({ waiting: mine(WAITING) });
      if (a && b) return or404(initiativeDetail(a, b), `initiative ${a}/${b}`);
      return ok({ initiatives: q.get('team') ? INITIATIVES.filter((i) => i.team === q.get('team')) : mine(INITIATIVES) });
    case 'document': {
      const rev = q.get('revision');
      if (rev !== null) return or404(documentRevision(a, b, rest.join('/'), Number(rev)), `revision ${rev} of ${seg.slice(1).join('/')}`);
      return or404(documentDetail(a, b, rest.join('/')), `document ${seg.slice(1).join('/')}`);
    }
    case 'knowledge':
      if (a === 'log') return ok({ entries: mine(KNOWLEDGE_LOG) });
      if (a) return or404(knowledgeBody(a, [b, ...rest].join('/')), `knowledge ${seg.slice(1).join('/')}`);
      return ok({ nodes: mine(KNOWLEDGE) });
    case 'plugins':
      if (a && b === 'eval') return ok(pluginEval(a));
      if (a && b === 'skills' && rest[0]) return or404(skillText(a, rest[0]), `skill ${a}/${rest[0]}`);
      return ok({ plugins: PLUGINS });
    case 'skills': return a ? or404(skillDetail(a), `skill ${a}`) : ok({ skills: SKILLS });
    case 'people': return ok({ people: platform ? PEOPLE : PEOPLE.filter((p) => p.teams.some((t) => t.startsWith(`${ME.activeTeam} `))) });
    case 'runs': return ok(runs(period));
    case 'activity': {
      const limit = Number(q.get('limit') ?? 200);
      const events = mine(ACTIVITY).filter((e) => q.get('failed') !== '1' || e.ok === false).slice(0, limit);
      return ok({ events, limit });
    }
    case 'settings':
      if (a === 'me' && b === 'tokens') return ok(MY_TOKENS);
      if (a === 'me' && b === 'client-setup') return ok(MY_CLIENT_SETUP);
      if (a === 'me' && b === 'teams') return ok(MY_TEAMS);
      if (a === 'team' && b === 'members') return ok(teamMembers(q.get('team') ?? ''));
      if (a === 'platform' && b === 'people') return ok(PLATFORM_PEOPLE);
      return missing(`settings/${a}/${b}`);
    default: return missing(seg.join('/'));
  }
}

/** One write under `/api/console`. Accepted, answered in the route's own shape, and not kept. */
function write(seg: string[], q: URLSearchParams, method: string, body: Record<string, unknown>): Answer {
  const path = seg.join('/');
  if (path === 'ask') {
    const node = KNOWLEDGE.find((n) => n.team === q.get('team')) ?? KNOWLEDGE[0];
    return ok({ answer: `From what ${q.get('team')} has written down: ${node.title.toLowerCase()}. The node cites the initiative it came from.`, citations: [{ path: `_knowledge/${node.path}`, title: node.title }] });
  }
  if (path === 'settings/me/tokens' && method === 'POST') {
    return ok({ token: 'zz_pat_example_0123456789abcdef', label: String(body.label ?? 'console'), email: ME.email });
  }
  if (path === 'settings/me/active-team') return ok({ actingFor: String(body.team ?? ME.activeTeam) });
  if (path === 'settings/platform/enrolments') return ok({ ok: true, url: 'https://console.example.com/enrol#t=example-enrolment', result: `An enrolment link for ${String(body.email)}` });
  return ok({ ok: true, result: `${method} ${path}: done`, revoked: seg.at(-1) });
}

/** The passkey routes: status says passkeys are configured; a ceremony is refused, since there is no authenticator here. */
function auth(seg: string[]): Answer {
  if (seg[0] === 'status') return ok({ configured: true, rpId: 'localhost' });
  return [400, { error: 'This preview has no passkey to offer. Sign in on the deployment.' }];
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://fake');
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const referer = (() => { try { return new URL(req.headers.referer ?? '').pathname; } catch { return ''; } })();
    const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    let answer: Answer;
    // `/__mode?set=empty` switches the world without a rebuild: the build bakes in one gateway address.
    if (seg[0] === '__mode') {
      const next = url.searchParams.get('set') ?? '';
      if (MODES.includes(next)) mode = next;
      res.writeHead(MODES.includes(next) || !next ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ mode }));
      return;
    }
    if (seg[0] === 'auth') answer = auth(seg.slice(1));
    else if (seg[0] !== 'api' || seg[1] !== 'console') answer = missing(url.pathname);
    else if (seg[2] === 'me' && SIGNED_OUT.test(referer)) answer = [401, { error: 'not signed in' }];
    else if (mode === 'error' && seg[2] !== 'me') answer = [503, { error: 'The gateway could not reach its database: connection to 10.0.0.12:5432 refused. Nothing was changed.' }];
    else if (req.method === 'GET') {
      answer = read(seg.slice(2), url.searchParams);
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
      if (answer[0] === 200 && mode === 'extreme') answer = [200, shape('extreme', extreme)];
    }
    else answer = write(seg.slice(2), url.searchParams, req.method ?? 'POST', (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })());
    setTimeout(() => {
      res.writeHead(answer[0], { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(answer[1]));
    }, mode === 'slow' ? 4000 : 0);
  });
});

server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address() as { port: number };
  // verify.ts reads this line to learn the address.
  console.log(`fake-gateway listening on http://127.0.0.1:${p}${mode === 'normal' ? '' : ` (${mode})`}`);
});

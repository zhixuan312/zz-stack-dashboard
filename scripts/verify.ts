/**
 * Verify a Meridian project against the standard, in one command, at the depth you ask for.
 *
 *   pnpm verify           the gate once, one production build, the route policy, the first-load and HTML size checks, and
 *                         the navigation smoke of up to three routes (scripts/navigate.ts) on desktop and the phone drawer
 *   pnpm verify --full    the navigation of every rail route, then every exhaustive suite: the browser audit of every page
 *                         and embed view (scripts/audit.ts), every control pressed and every link followed
 *                         (scripts/interactions.ts), the whole keyboard path (scripts/keyboard.ts), the product's own
 *                         browser checks (`browserChecks` in scripts/verify.config.ts), the assistant walk-through
 *                         (scripts/assistant.ts), the live-data checks (scripts/live.ts) and Web Vitals (scripts/vitals.ts)
 *   pnpm verify --perf    the default, then the 20-sample navigation protocol (scripts/perf.ts): every rail route, on a desktop
 *                         and through the phone drawer, warm, cold and right after a live refresh, the p95 reported
 *   pnpm verify --full --perf   both deep suites; the gate and the build are shared, so each runs once
 *
 * It prints one line per phase (`ok`, `warn`, `FAIL` or `not run`, and the seconds), then one coverage line saying what
 * ran and what did not, then the outcome. Nothing that did not run is reported as passed. The trace, with the commit, the
 * toolchain, the browser, the routes and how many times the gate and the build ran, is written to out/verify.txt.
 * Exit 0 only when every check that ran passed.
 *
 * The browser needs Chrome and a backend its presses cannot hurt, read from scripts/verify.config.ts and app/:
 * - A project that kept its own data layer names a fake API (`fakeApi`), or says its pages call none (`noLiveApi`). The
 *   fake starts first, and the app is built and served against it, so no press reaches a live backend.
 * - A data URL (`DATABASE_URL`, or any `dataUrls` names) that resolves to a host that is not this machine is not safe
 *   either: the walk-throughs change data, and an adopted app's `.env` usually points at production.
 * Without either, the default runs the static checks and reports the browser as `not run`, with the reason, and exits 0
 * when they pass. `--full` and `--perf` fail on the same lack, listing every missing piece before they build anything. Restore the
 * data after a `--full` run: the walk-through flags rows and a press can delete.
 *
 * The routes, the readiness mappings and the budgets come from scripts/verify.config.ts, which the team owns: it is read
 * through the types below, so a project set up by an earlier release, whose config lacks a field, still runs.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { bin } from './lib/bin.ts';
import { launch } from './lib/chrome.ts';
import type { BudgetsConfig, NavigationCheck } from './lib/budgets.ts';
import { finalOutcome, resolveCoverage, selectSmokeRoutes, suiteCoverage, suiteOutcome } from './lib/coverage.ts';
import { APP_DIR, railRoutes } from './lib/routes.ts';
import { sampleSurfaces } from './lib/sample.ts';
import verifyConfig from './verify.config.ts';

/** The fields of the team's config that verify reads, each optional: an older product's config has only some of them. */
type VerifyConfig = BudgetsConfig & {
  detailRoutes?: string[];
  fakeApi?: { script: string; env: string };
  noLiveApi?: true;
  dataUrls?: string[];
  allowRemoteData?: true;
  browserChecks?: string[];
  navigationChecks?: NavigationCheck[];
  smokeRoutes?: string[];
  personas?: Record<string, { cookie: { name: string; value: string }; expectedRoutes: readonly string[]; deniedProbe?: Record<string, string> }>;
};
const config = verifyConfig as VerifyConfig;

const ROOT = path.resolve(import.meta.dirname, '..');
const OPTIONS = ['--full', '--perf', '--as'];

// `--as` is the one option that consumes the argument after it: a comma-separated persona list is its value, not a stray
// argument. Every other argument must be a known option. An unknown option is refused here, before anything runs.
const argv = process.argv.slice(2);
const unknown: string[] = [];
let asList = '';
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--as') { asList = argv[++i] ?? ''; continue; }
  if (!OPTIONS.includes(a)) unknown.push(a);
}
if (unknown.length) {
  console.error(`verify: ${unknown.join(', ')} ${unknown.length === 1 ? 'is not an option' : 'are not options'}. pnpm verify takes ${OPTIONS.join(', ')}.`);
  process.exit(1);
}
const full = argv.includes('--full');
const perf = argv.includes('--perf');
const depth = full && perf ? 'full+perf' : full ? 'full' : perf ? 'perf' : 'default';
/** The flags of the deep modes that were given, for the messages that name them. */
const flags = argv.join(' ');

// The personas a run may sign the browser in as, from the team's config. `--as` is validated HERE, at argv parsing:
// the gate is the first thing this script runs and takes around forty seconds, so a refusal after it is one a test that
// spawns this script and reads its output never sees. An unknown persona, or `--as` beside `--perf`, stops the run
// before the gate, the build or any server.
const personaConfig = config.personas ?? {};
const declaredPersonas = Object.keys(personaConfig);
const asPersonas = asList ? asList.split(',').map((s) => s.trim()).filter(Boolean) : [];
const undeclared = asPersonas.filter((n) => !declaredPersonas.includes(n));
if (undeclared.length) {
  console.error(`verify: --as names ${undeclared.join(', ')}, which ${undeclared.length === 1 ? 'is not a declared persona' : 'are not declared personas'}. Declared personas: ${declaredPersonas.join(', ')}.`);
  process.exit(1);
}
if (asPersonas.length && perf) {
  console.error('verify: --as cannot be combined with --perf. Run pnpm verify --as <persona> on its own.');
  process.exit(1);
}

// A project that has not adopted the assistant has no walk-through to run, only the pages. Through APP_DIR, like the
// route discovery and check.ts: a project that keeps its routes under `src/app` has the assistant there, and asking for
// `app/api/...` alone would skip the walk-through without saying so.
const hasAssistant = fs.existsSync(path.join(ROOT, APP_DIR, 'api/assistant/route.ts'));
// The live checks drive the template's own Members page (its invitation sheet and Remove dialog) across two tabs. A
// product that removed it has nothing for them to drive: the suite is not applicable, said so, rather than not run.
// The stream itself is Meridian's, proven on the sample in Meridian's own runs; a product's own live pages prove
// themselves through `browserChecks`.
const hasLiveSample = sampleSurfaces(ROOT, APP_DIR).members;
const own = config.browserChecks ?? [];
const SUITES = ['audit', 'presses', 'keyboard', ...(hasAssistant ? ['assistant'] : []), ...(hasLiveSample ? ['live'] : []), 'vitals', ...(own.length ? ['browserChecks'] : []), ...(perf ? ['perf'] : [])];
const ranSuites = new Set<string>();
const failedSuites = new Set<string>();

// ---- the report ----

type Status = 'ok' | 'warn' | 'FAIL' | 'not run' | 'n/a';
const started = Date.now();
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); };
const secs = (since: number) => (Date.now() - since) / 1000;
const phase = (status: Status, name: string, took: number | null, detail = '') =>
  log(`${status.padEnd(7)} ${name}${took === null ? '' : ` (${took.toFixed(1)}s)`}${detail ? ` ${detail}` : ''}`);
/** What a phase printed beneath its line, indented. */
const beneath = (text: string | string[]) => (Array.isArray(text) ? text : text.split('\n')).filter((l) => l.trim()).forEach((l) => log(`        ${l}`));
// Announced before it runs, not only after: a run people wait on should say which phase it is in. It is not a phase line.
const announce = (name: string) => console.error(`… ${name}`);

const children: ChildProcess[] = [];
// Declared before anything can call finish(): an early exit (a config naming a route that is gone) stops them too.
/** The suites running now: each ends its own Chrome on SIGTERM (scripts/lib/chrome.ts), so it is asked, not killed. */
const suites = new Set<ChildProcess>();
let gates = 0;
let builds = 0;
let current = 'the start';
let browser: { ran: boolean; reason: string | null } = { ran: false, reason: null };
/** The routes the depth measures: the smoke's up to three, or every rail route in a deep mode. */
let selected: string[] = [];
/** The routes the navigation step presses: `selected`, except that `--perf` alone adds the 20-sample protocol to the smoke. */
let smoke: string[] = [];
let covered = { data: 0, interaction: 0 };
let htmlMissing = false;

const chromePath = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');

const git = (...a: string[]) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const nextVersion = () => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/next/package.json'), 'utf8')).version as string; } catch { return 'unknown'; } };

/** What a run saw, for a person comparing runs: the commit, the toolchain, the browser and the machine. */
function traceHeader(code: number): string[] {
  const sha = git('rev-parse', '--short', 'HEAD');
  const dirty = sha ? (git('status', '--porcelain') ?? '').length > 0 : false;
  const chrome = fs.existsSync(chromePath) ? (spawnSync(chromePath, ['--version'], { encoding: 'utf8', timeout: 5000 }).stdout.trim() || chromePath) : 'none found';
  const cpus = os.cpus();
  return [
    `verify trace: ${new Date(started).toISOString()}`,
    `mode: ${depth}; depth: ${depth}; exit ${code}; total ${secs(started).toFixed(1)}s`,
    `commit: ${sha ? `${sha}${dirty ? ' (working tree has changes)' : ''}` : 'not a git checkout'}`,
    `toolchain: node ${process.version}; next ${nextVersion()}; ${process.env.npm_config_user_agent?.split(' ')[0] ?? 'no package manager'}`,
    `browser: ${chrome}; profile: ${os.platform()} ${os.arch()}, ${cpus.length} CPUs (${cpus[0]?.model ?? 'unknown'}), local, not the reference profile`,
    `selected routes: ${selected.length ? selected.join(', ') : 'none'}`,
    `gate runs: ${gates}`,
    `build runs: ${builds}`,
    '',
  ];
}

/** The coverage line: the last line before the outcome, and the one line a caller reads to know what the depth was. */
function coverageLine(): string {
  const { notRun, failed } = suiteCoverage(SUITES, ranSuites, failedSuites);
  if (htmlMissing) notRun.unshift('html');
  const n = selected.length;
  const where = browser.ran ? 'ran' : `not run (${browser.reason ?? `stopped at ${current}`})`;
  const personae = asPersonas.length ? `; personas ${asPersonas.join(', ')}` : '';
  return `coverage: ${depth}; browser ${where}; ${n} routes; data configured ${covered.data}/${n}; interaction configured ${covered.interaction}/${n}${personae}; not run: ${notRun.length ? notRun.join(', ') : 'none'}${failed.length ? `; failed: ${failed.join(', ')}` : ''}`;
}

function finish(code: number, outcome: string): never {
  stopAll();
  // One gate and one build is a contract of the default, not an accident: a run that did either twice is not that run.
  if (code === 0 && (gates !== 1 || builds !== 1)) { phase('FAIL', 'trace', null, `the gate ran ${gates} times and the build ${builds}, not once each`); code = 1; outcome = 'fix the issues above and run pnpm verify again'; }
  log(coverageLine());
  log(`verify: ${outcome} (${secs(started).toFixed(1)}s)`);
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/verify.txt'), [...traceHeader(code), ...lines].join('\n') + '\n');
  process.exit(code);
}
const FIX = 'fix the issues above and run pnpm verify again';

// ---- what is safe to run against ----

/** Can this hostname only be this machine — or a name that can only resolve inside it? */
function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true;
  if (/^127\./.test(h)) return true;
  // A name with no dot cannot be a public address: a compose service (`postgres`), a container name, a bare hostname.
  return !h.includes('.');
}

/** The `.env` files Next loads into the build and the server, in its own order: a later file wins over an earlier one. */
function envFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim();
      out[m[1]] = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v;
    }
  }
  return out;
}

/**
 * Why the presses and the walk-throughs cannot run here, or null when they can. An adopted project kept its own data
 * layer, which may be a live backend, and a direct database connection is the same hazard through a different door: its
 * DATABASE_URL comes from .env, and verify builds and starts it in this folder. Decided before anything starts, because
 * by the time a press lands the damage is done.
 */
function unsafeBackend(): { reason: string; fix: string } | null {
  const manifest = path.join(ROOT, '.meridian/manifest.json');
  if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).route === 'adopt' && !config.fakeApi && !config.noLiveApi) {
    return {
      reason: 'no fakeApi or noLiveApi',
      fix: `this project kept its own data layer: say in scripts/verify.config.ts where the presses go, a fakeApi that answers every route the pages call (see .agents/skills/zz-meridian/references/existing-project.md, step 5), or noLiveApi: true when the pages read and write nothing outside this repository`,
    };
  }
  const fromFiles = envFiles();
  const offenders = ['DATABASE_URL', ...(config.dataUrls ?? [])].flatMap((name) => {
    const value = process.env[name] ?? fromFiles[name];
    if (!value) return [];
    let host: string;
    // Not a URL is not something this can judge; the app will fail on it long before a press.
    try { host = new URL(value).hostname; } catch { return []; }
    return isLocalHost(host) ? [] : [`${name} → ${host}`];
  });
  if (offenders.length && !config.allowRemoteData) {
    return {
      reason: `data URL not on this machine: ${offenders.join(', ')}`,
      fix: `a data URL is not on this machine (${offenders.join(', ')}): point it at a local copy for the run, or set allowRemoteData: true in scripts/verify.config.ts when you know what the presses reach`,
    };
  }
  return null;
}

// ---- before anything is built: the routes, the mappings and what the depth needs ----

let rail: { routes: string[]; landing: string } | null = null;
let railReason: string | null = null;
try { rail = await railRoutes(); } catch (e) { railReason = (e as Error).message; }

const invalid: string[] = [];
if (rail) {
  try {
    smoke = full ? rail.routes : selectSmokeRoutes({ smokeRoutes: config.smokeRoutes, nav: rail.routes, landing: rail.landing });
    selected = full || perf ? rail.routes : smoke;
  } catch (e) { invalid.push((e as Error).message); }
}
const checks = Array.isArray(config.navigationChecks) ? config.navigationChecks : [];
const coverage = rail ? resolveCoverage(full ? 'full' : perf ? 'perf' : 'default', selected, checks, rail.routes) : { routes: [], errors: [], warnings: [] };
invalid.push(...coverage.errors);
covered = { data: coverage.routes.filter((r) => r.data === 'configured').length, interaction: coverage.routes.filter((r) => r.interaction === 'configured').length };

const unsafe = unsafeBackend();
const chromeMissing = fs.existsSync(chromePath) ? null : `Chrome not found at ${chromePath} (set CHROME)`;
const baselinePath = 'scripts/verify.baseline.json';

if (full || perf) {
  // A deep mode needs all of it, and says every piece that is missing at once, before it spends a build.
  const missing = [
    ...invalid,
    ...(railReason ? [railReason] : []),
    ...(unsafe ? [unsafe.fix] : []),
    ...(chromeMissing ? [chromeMissing] : []),
    ...(!full || fs.existsSync(path.join(ROOT, baselinePath)) ? [] : [`${baselinePath} is missing: record it with node scripts/sizes.ts --write-baseline from a build whose sizes you reviewed`]),
  ];
  if (missing.length) {
    for (const m of missing) log(`FAIL    ${m}`);
    browser.reason = unsafe?.reason ?? chromeMissing ?? railReason ?? 'the configuration is incomplete';
    finish(1, `${flags} needs ${missing.length} more ${missing.length === 1 ? 'thing' : 'things'}; nothing was built`);
  }
} else if (invalid.length) {
  for (const m of invalid) log(`FAIL    ${m}`);
  browser.reason = 'the configuration is invalid';
  finish(1, 'fix the configuration above and run pnpm verify again; nothing was built');
}

// `--as` drives the browser as each persona, so it needs the same three things the deep modes do — a readable rail, a
// backend its presses cannot hurt, and Chrome — and it names every missing piece at once before spending a build.
if (asPersonas.length && !full && !perf) {
  const missing = [...(railReason ? [railReason] : []), ...(unsafe ? [unsafe.fix] : []), ...(chromeMissing ? [chromeMissing] : [])];
  if (missing.length) {
    for (const m of missing) log(`FAIL    ${m}`);
    browser.reason = unsafe?.reason ?? chromeMissing ?? railReason ?? 'the configuration is incomplete';
    finish(1, `--as needs ${missing.length} more ${missing.length === 1 ? 'thing' : 'things'}; nothing was built`);
  }
}

// The default never refuses for a missing backend or Chrome: it runs the static checks and says what it could not.
const browserReason = unsafe?.reason ?? chromeMissing ?? (railReason ? `no rail routes: ${railReason}` : null);
browser.reason = browserReason;
// Pages are fetched for their size by the same server the browser uses, which needs a backend that is safe, not Chrome.
const serve = unsafe === null;

// ---- the processes ----

const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

// The assistant is off unless configured: the build and the first start must not see the caller's own variables.
// BLANKED, not deleted: `next start` loads `.env.local` itself, where a person keeps their own model, and Next does not
// overwrite a variable that is already set — so a deleted `ASSISTANT_*` came straight back from that file and the
// "assistant off" start failed with "the page has 1 assistant element(s)" while nothing was wrong (`assistantConfig`
// treats a blank value as unset). Reported in issue #7 against `e4a6225`. Every name the assistant reads is blanked,
// set in the shell or not: a variable kept only in `.env.local` is absent here and would come back from it (issue #16).
const clean: NodeJS.ProcessEnv = { ...process.env };
for (const k of ['ASSISTANT_PROVIDER', 'ASSISTANT_API_KEY', 'ASSISTANT_MODEL', 'ASSISTANT_BASE_URL', ...Object.keys(clean).filter((k) => k.startsWith('ASSISTANT_'))]) clean[k] = '';

function step(name: string, cmd: string, args: string[], env = clean, last = false) {
  current = name;
  announce(name);
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  phase(ok ? 'ok' : 'FAIL', name, secs(t), ok && last ? r.stdout.trim().split('\n').pop() : '');
  if (!ok) { beneath((r.stdout + r.stderr).trim().split('\n').slice(-60)); finish(1, FIX); }
  return r.stdout;
}

function stop(c: ChildProcess) { try { process.kill(-c.pid!, 'SIGTERM'); } catch { /* already gone */ } }
function stopAll() {
  for (const c of children) stop(c);
  for (const c of suites) c.kill('SIGTERM');
}
process.on('exit', stopAll);
// An interrupted run does not emit 'exit' by itself, and the detached servers and running suites would outlive it.
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));

/** Start the built app on a free port with the given environment and wait until it answers. */
async function start(env: NodeJS.ProcessEnv) {
  const port = await freePort();
  const server = spawn(bin('next'), ['start', '-p', String(port)], { cwd: ROOT, env, stdio: 'ignore', detached: true });
  children.push(server);
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).status < 500) return { port, server }; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  phase('FAIL', 'the built app did not start', null);
  return finish(1, FIX);
}

/** Run a node script to completion and keep what it printed; `echo` also shows its progress (stderr) as it goes, for a run measured in minutes. */
const run = (script: string, extra: string[], env: NodeJS.ProcessEnv = process.env, echo = false) => new Promise<{ status: number | null; out: string; took: number }>((resolve) => {
  const t = Date.now();
  const child = spawn('node', [script, ...extra], { cwd: ROOT, env: { ...env, DPR: process.env.DPR ?? '1' } as NodeJS.ProcessEnv });
  suites.add(child);
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => { out += d; if (echo) process.stderr.write(d); });
  child.on('close', (status) => { suites.delete(child); resolve({ status, out: out.trim(), took: secs(t) }); });
});

/** The JSON a script prints on its last line after `<tag>: `, or null when it printed none. */
function summaryOf<T>(out: string, tag: string): T | null {
  const last = out.split('\n').pop() ?? '';
  if (!last.startsWith(`${tag}: `)) return null;
  try { return JSON.parse(last.slice(tag.length + 2)) as T; } catch { return null; }
}

/** A suite's line. One that left a case unrun is `not run`, stays in the coverage line's not-run list, and fails nothing. */
function reportSuite(name: string, label: string, r: { status: number | null; out: string; took: number }) {
  const outcome = suiteOutcome(r.status);
  if (outcome === 'ok') ranSuites.add(name);
  if (outcome === 'FAIL') failedSuites.add(name);
  phase(outcome, label, r.took);
  const out = r.out.trim().split('\n');
  if (outcome === 'FAIL') beneath(out.slice(-60));
  else if (outcome === 'not run') beneath([...out.filter((l) => l.startsWith('not run')), out.at(-1) ?? '']);
  else beneath([...out.filter((l) => l.startsWith('n/a')), out.at(-1) ?? '']);
  return outcome !== 'FAIL';
}

// ---- the sequence ----

let ok = true;

// 1. The gate, once.
gates++;
// The tests only this repository has (tests/cli-*, the package's own, and tests/deep-*, the browser-fixture tests of the checks) are not the project's: no adopted or created project has them.
step('gate', 'node', ['scripts/gate.ts', '--without-cli-tests']);

// A product whose pages call a live API is checked against its fake (scripts/verify.config.ts): the presses approve,
// revoke and delete whatever a page offers. The fake starts first, because its address goes into the build.
let app = clean;
if (config.fakeApi && serve) {
  current = 'the fake API';
  const api = spawn('node', [config.fakeApi.script, '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  children.push(api);
  const apiUrl = await new Promise<string>((resolve) => {
    let buf = '';
    api.stdout!.on('data', (d) => { buf += d; const m = /listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
    api.on('close', () => resolve(''));
  });
  if (!apiUrl) { phase('FAIL', `the fake API (${config.fakeApi.script}) did not start`, null); finish(1, FIX); }
  app = { ...clean, [config.fakeApi.env]: apiUrl };
  phase('ok', 'the fake API', null, `is serving at ${apiUrl} (${config.fakeApi.env})`);
}

// 2. The build, once, and 3. the route policy on it: every non-API route static or partial, unless verify.config.ts says why not.
builds++;
step('build', bin('next'), ['build'], app);
step('route policy', 'node', ['scripts/route-policy.ts'], app, true);

// The built app, for the page sizes and the browser. The assistant is off in this start.
let server = serve ? await start(app) : null;
const baseUrl = server && `http://127.0.0.1:${server.port}`;

// 4. First-load against the cap and the baseline, then every capped route's complete HTML from the running app.
current = 'sizes';
announce('sizes');
const sizes = await run('scripts/sizes.ts', baseUrl ? ['--base', baseUrl] : [], app);
{
  const rows = sizes.out.split('\n').slice(0, -1);
  const PHASE = /^(ok|FAIL|warn|not run)\s+(first-load|html) (.*)$/;
  // A build or a baseline that could not be read says so in one line and has no phase lines of its own.
  if (sizes.status !== 0) { ok = false; if (!rows.some((l) => PHASE.test(l))) phase('FAIL', 'sizes', sizes.took); }
  for (const l of rows) {
    const m = PHASE.exec(l);
    if (m) phase(m[1] as Status, m[2], sizes.took, m[3]); else beneath(l.replace(/^FAIL\s+/, ''));
  }
  const html = summaryOf<{ html: { status: Status } }>(sizes.out, 'sizes')?.html.status;
  htmlMissing = Object.keys(config.budgets?.htmlKb ?? {}).length > 0 && html !== 'ok' && html !== 'FAIL';
}

// 5. The navigation smoke of the selected routes; every rail route in --full.
if (browserReason) {
  phase('not run', 'browser', null, `(${browserReason})`);
} else {
  current = 'navigation';
  announce('navigation');
  const nav = await run('scripts/navigate.ts', ['--base', baseUrl!, '--mode', full ? 'full' : 'default', '--routes', smoke.join(',')], app);
  const result = summaryOf<{ status: 'ok' | 'warn' | 'FAIL' | 'not-run'; reason?: string }>(nav.out, 'navigate');
  const status: Status = nav.status !== 0 || !result || result.status === 'FAIL' ? 'FAIL' : result.status === 'not-run' ? 'not run' : result.status;
  phase(status, 'navigation', nav.took, status === 'not run' ? `(${result?.reason ?? 'no reason given'})` : '');
  beneath(nav.out.split('\n').filter((l) => !l.startsWith('navigate: ')).slice(-60));
  if (status === 'FAIL') ok = false;
  if (status === 'not run') browser = { ran: false, reason: result?.reason ?? 'navigation did not run' };
  else browser = { ran: true, reason: null };
  if (!result) beneath(nav.out.split('\n').slice(-20));
}

// 5b. --as: the persona work, once per persona. The gate and the build above ran ONCE for the whole list. Each persona
// gets a FRESH server, because a persona's presses can change the sample's state (they suspend members) and the next
// persona must start from the sample as it was written. Every server this starts is stopped by its own PID.
if (asPersonas.length) {
  current = 'the personas';
  announce(`the personas: ${asPersonas.join(', ')}`);
  if (!browser.ran) {
    ok = false;
    phase('FAIL', 'the personas', null, `(--as needs the browser: ${browser.reason ?? 'the browser did not run'})`);
  } else {
    const personaPage = await launch();
    try {
      for (const name of asPersonas) {
        const persona = config.personas![name];
        const fresh = await start(app);
        const here = `http://127.0.0.1:${fresh.port}`;
        const problems: string[] = [];
        try {
          // (a) The rail's links, as the browser drew them, against this persona's hand-written routes.
          const railRun = await run('scripts/rail.ts', ['--base', here, '--as', name], app);
          const links = summaryOf<string[]>(railRun.out, 'rail');
          if (!links) problems.push(`${name}: the rail suite printed no links (${railRun.out.split('\n').filter(Boolean).slice(-1)[0] ?? 'no output'})`);
          else {
            const want = [...persona.expectedRoutes];
            const missing = want.filter((r) => !links.includes(r));
            const extra = links.filter((r) => !want.includes(r));
            if (missing.length) problems.push(`${name}: the rail is missing ${missing.join(', ')}`);
            if (extra.length) problems.push(`${name}: the rail shows ${extra.join(', ')}, which this persona is not expected to see`);
          }
          // (b) The role-dependent routes this persona expects, every control pressed at 1440px as that person.
          const roleRoutes = ['/keys', '/members', '/settings'].filter((r) => persona.expectedRoutes.includes(r));
          if (roleRoutes.length) {
            const presses = await run('scripts/interactions.ts', ['--base', here, '--as', name, '--width', '1440', '--routes', roleRoutes.join(',')], app);
            if (presses.status !== 0) problems.push(`${name}: the presses failed on ${roleRoutes.join(', ')} — ${presses.out.split('\n').filter(Boolean).slice(-1)[0] ?? 'no output'}`);
          }
          // (c) Follow every expected route, and open every other rail route expecting NoAccess and no protected record.
          for (const route of persona.expectedRoutes) {
            await personaPage.open(here + route, { width: 1440, height: 900, theme: 'dark', cookie: persona.cookie });
            const denied = await personaPage.eval<boolean>('(async () => { await new Promise((r) => setTimeout(r, 400)); return !!document.querySelector("[data-no-access]"); })()');
            if (denied) problems.push(`${name}: ${route} is expected of this persona, but the page shows NoAccess`);
          }
          const deniedProbe = persona.deniedProbe ?? {};
          const others = rail!.routes.filter((r) => !persona.expectedRoutes.includes(r));
          for (const route of others) {
            await personaPage.open(here + route, { width: 1440, height: 900, theme: 'dark', cookie: persona.cookie });
            const denied = await personaPage.eval<boolean>('(async () => { const end = Date.now() + 5000; while (Date.now() < end) { if (document.querySelector("[data-no-access]")) return true; await new Promise((r) => setTimeout(r, 100)); } return false; })()');
            if (!denied) problems.push(`${name}: ${route} should show NoAccess for this persona, and does not`);
            const probe = deniedProbe[route];
            if (probe) {
              const text = await personaPage.eval<string>('document.body.innerText');
              if (text.includes(probe)) problems.push(`${name}: ${route} leaked "${probe}"`);
            }
          }
        } finally {
          stop(fresh.server);
        }
        if (problems.length) { ok = false; phase('FAIL', `persona ${name}`, null, problems.join('; ')); }
        else phase('ok', `persona ${name}`, null, `the rail matches its ${persona.expectedRoutes.length} routes`);
      }
    } finally {
      personaPage.close();
    }
  }
}

// 6. --perf: the 20-sample protocol, alone and before the suites that change data, so nothing else loads the machine.
if (perf && !browser.ran) {
  ok = false;
  phase('FAIL', 'performance', null, `(--perf needs the browser: ${browser.reason ?? 'navigation did not run'})`);
} else if (perf && baseUrl) {
  current = 'performance';
  announce('performance: 20 samples per route, device and condition (many minutes)');
  const timed = await run('scripts/perf.ts', ['--base', baseUrl], app, true);
  const result = summaryOf<{ status: 'ok' | 'warn' | 'FAIL' }>(timed.out, 'perf');
  ranSuites.add('perf');
  const status: Status = timed.status !== 0 || !result || result.status === 'FAIL' ? 'FAIL' : result.status;
  phase(status, 'performance: 20 samples per route, device and condition, p95 reported against the budgets', timed.took);
  beneath(timed.out.split('\n').filter((l) => !l.startsWith('perf: ') && !l.startsWith('… ')));
  if (status === 'FAIL') ok = false;
}

// 7. --full: every exhaustive suite.
if (full && browser.ran && baseUrl) {
  let port = server!.port;
  let on: { status: number | null; out: string; took: number } = { status: 0, out: '', took: 0 };
  let llmUrl = '';
  let key = '';
  if (hasAssistant) {
    // This start has no assistant variables. The assistant must be absent.
    current = 'assistant';
    announce('the assistant, absent');
    const off = await run('scripts/assistant.ts', ['--base', baseUrl, '--expect', 'off'], app);
    stop(server!.server);
    reportSuite('assistant', 'assistant absent without its variables', off);
    if (suiteOutcome(off.status) === 'FAIL') { ok = false; finish(1, FIX); }

    // Pointed at the fake LLM, the audit and the presses then see the launcher.
    const fake = spawn('node', ['scripts/fake-llm.ts', '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
    children.push(fake);
    llmUrl = await new Promise<string>((resolve) => {
      let buf = '';
      fake.stdout!.on('data', (d) => { buf += d; const m = /fake-llm listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
      fake.on('close', () => resolve(''));
    });
    if (!llmUrl) { phase('FAIL', 'the fake LLM did not start', null); finish(1, FIX); }
    // A distinctive key per run: the walk-through searches everything the browser can get for it.
    key = `verify-${randomBytes(16).toString('hex')}`;
    server = await start({ ...app, ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_BASE_URL: llmUrl, ASSISTANT_API_KEY: key, ASSISTANT_MODEL: 'fake' });
    port = server.port;

    // The walk-through changes the sample's data (it suspends members), so it runs first and alone; the audit and the
    // presses then run on what it left, and their presses never change what it reads.
    current = 'assistant';
    announce('the assistant walk-through');
    on = await run('scripts/assistant.ts', ['--base', `http://127.0.0.1:${port}`, '--expect', 'on', '--llm', llmUrl, '--key', key]);
    reportSuite('assistant', 'assistant walk-through', on);
    if (suiteOutcome(on.status) === 'FAIL') ok = false;
  }

  // The audit, the presses and the keyboard walk each run their own browser, so they run side by side against the one built app.
  current = 'the browser suites';
  announce('the audit, every control and link, the keyboard path' + (own.length ? ', and the product\'s own checks' : ''));
  const here = `http://127.0.0.1:${port}`;
  const [audit, presses, keys, ...extras] = await Promise.all([
    run('scripts/audit.ts', ['--base', here]),
    run('scripts/interactions.ts', ['--base', here]),
    run('scripts/keyboard.ts', ['--base', here]),
    ...own.map((script) => run(script, ['--base', here])),
  ]);
  reportSuite('audit', 'audit: every page at 5 widths in both themes', audit);
  reportSuite('presses', 'every control pressed and every link followed', presses);
  reportSuite('keyboard', 'the whole keyboard path', keys);
  extras.forEach((r, i) => reportSuite('browserChecks', own[i], r));
  if ([audit, presses, keys, ...extras].some((r) => suiteOutcome(r.status) === 'FAIL')) ok = false;

  // Live data: two tabs, a quiet or restarted stream, a hidden or offline tab and a burst (scripts/live.ts). It times what a
  // second tab sees, so it runs alone and after the presses, which change members. The server with LIVE_DROP_HINTS=1 is the
  // same build with its change hints dropped; the restart case starts and restarts a server of its own.
  if (hasLiveSample) {
    current = 'live data';
    announce('live data, alone');
    const dropped = await start({ ...app, LIVE_DROP_HINTS: '1' });
    const live = await run('scripts/live.ts', ['--base', here, '--drop-base', `http://127.0.0.1:${dropped.port}`], app);
    stop(dropped.server);
    reportSuite('live', 'live data: two tabs, a silent stream, a restart, a hidden and an offline tab, a burst', live);
    if (suiteOutcome(live.status) === 'FAIL') { ok = false; beneath(live.out.split('\n').slice(-40)); }
  } else {
    phase('n/a', 'live data', null, '(the sample Members page the live checks drive is not in this product; its own live pages prove themselves through browserChecks)');
  }

  // Web Vitals on a mid-range phone, alone: CPU throttling measures the machine too, so nothing else runs beside it.
  current = 'web vitals';
  announce('Web Vitals on a mid-range phone, alone');
  const vitals = await run('scripts/vitals.ts', ['--base', here]);
  reportSuite('vitals', 'LCP, INP and CLS on a mid-range phone', vitals);
  if (suiteOutcome(vitals.status) === 'FAIL') ok = false;
}

stopAll();
current = 'the end';
if (!ok) finish(1, FIX);
finish(0, finalOutcome(full, SUITES.filter((s) => !ranSuites.has(s))));

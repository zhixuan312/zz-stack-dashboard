/**
 * The browser suites: a production build walked by a real browser, run by `test:t2` and `test:release`.
 *
 *   node scripts/browser.ts --depth fn[,timed][,perf] [--built]
 *
 * `fn` is the function-only set, run whenever a change can alter what a page draws or what a control does:
 * scripts/navigate.ts with its budgets unjudged, the audit of every page at every width in both themes
 * (scripts/audit.ts), every control pressed and every link followed (scripts/interactions.ts), the whole keyboard path
 * (scripts/keyboard.ts), the assistant walk-through (scripts/assistant.ts), the product's own `browserChecks` and the
 * `personas` of scripts/verify.config.ts.
 *
 * `timed` is what judges a time and belongs on a quiet machine: the navigation of every rail route with its budgets
 * judged, the live-data checks (scripts/live.ts), the product's own `timedChecks` and the Web Vitals floors
 * (scripts/vitals.ts). It runs last, alone.
 *
 * `perf` is the 20-sample navigation protocol (scripts/perf.ts). It runs only where CI is true and only for the weekly
 * job, which calls `pnpm test:t2` on a fresh clone; a local run reports it not run rather than judging the machine.
 *
 * `--built` reuses the production build the caller already made (test:release builds once).
 *
 * The build's sizes (scripts/sizes.ts) run once against the app this run starts, whatever the depth: first-load bytes of
 * every route and every page's gzipped HTML, each against its budget and baseline. The HTML needs an app serving the
 * build, so it runs here rather than beside the build itself, which starts nothing.
 *
 * The presses and the walk-throughs change data, so nothing runs against a backend that is not proven local: a data URL
 * that resolves to another host, or an adopted project that has not said where its presses go, reports the browser not
 * run with the reason, never passed. Chrome absent is the same. One line per suite (`ok`, `FAIL` or `not run`), then
 * `browser: {...}` with what ran. Exit 0 when every suite that ran passed, 1 when one failed, 2 when nothing failed and
 * something did not run.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { answers, bin, freePort, spawnNext } from './lib/bin.ts';
import { CHROME, launch } from './lib/chrome.ts';
import { fakeModelArgs, fakeModelProblems, type FakeModelStep } from './lib/config-hooks.ts';
import { declaredNotRun, selectSmokeRoutes } from './lib/coverage.ts';
import { clearParts, readParts } from './lib/tier2.ts';
import { unsafeDataUrls } from './lib/data-url.ts';
import { APP_DIR, railRoutes } from './lib/routes.ts';
import { sampleSurfaces } from './lib/sample.ts';
import { holdArgs } from './lib/args.ts';
import verifyConfig from './verify.config.ts';

/** The fields of the team's config the browser suites read, each optional: an older product's config has only some. */
type BrowserConfig = {
  fakeApi?: { script: string; env: string };
  noLiveApi?: true;
  dataUrls?: string[];
  allowRemoteData?: true;
  browserChecks?: (string | { script: string; browsers: number })[];
  timedChecks?: string[];
  navigationChecks?: { path: string }[];
  smokeRoutes?: string[];
  fakeModel?: FakeModelStep[];
  personas?: Record<string, { cookie: { name: string; value: string }; expectedRoutes: readonly string[]; deniedProbe?: Record<string, string>; pressRoutes?: readonly string[] }>;
  refusal?: 'explain' | 'absent';
};
const config = verifyConfig as BrowserConfig;

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
holdArgs('browser', args, ['--depth', '--built']);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] ?? d : d; };
const depth = new Set(opt('--depth', 'fn').split(',').map((s) => s.trim()).filter(Boolean));
const built = args.includes('--built');
const want = (d: string) => depth.has(d);

type Status = 'ok' | 'warn' | 'FAIL' | 'not run' | 'n/a';
type Ran = { status: number | null; out: string; err: string; took: number };

const started = Date.now();
const secs = (since: number) => (Date.now() - since) / 1000;
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); };
const notRun: string[] = [];
/** What a project left unrun by configuration (no navigation check, no drawer on a phone): reported, never holding the marker. */
const declared: string[] = [];
let failed = false;
const ran: string[] = [];

function phase(status: Status, name: string, took: number | null, detail = ''): void {
  log(`${status.padEnd(7)} ${name}${took === null ? '' : ` (${took.toFixed(1)}s)`}${detail ? ` ${detail}` : ''}`);
}
function beneath(text: string, keep = 60): void {
  for (const l of text.split('\n').filter((l) => l.trim()).slice(-keep)) log(`        ${l}`);
}

// ---- what is safe to run against ----

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

/** Why the presses and the walk-throughs cannot run here, or null when they can. Decided before anything starts. */
function unsafeBackend(): { reason: string; fix: string } | null {
  const manifest = path.join(ROOT, '.meridian/manifest.json');
  if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).route === 'adopt' && !config.fakeApi && !config.noLiveApi) {
    return {
      reason: 'no fakeApi or noLiveApi',
      fix: 'this project kept its own data layer: set fakeApi or noLiveApi in scripts/verify.config.ts — fakeApi: { script, env } starts a fake API the browser stage builds and serves the app against, and noLiveApi: true says the pages read and write nothing outside this repository',
    };
  }
  const fromFiles = envFiles();
  const named = ['DATABASE_URL', ...(config.dataUrls ?? [])];
  const offenders = unsafeDataUrls(Object.fromEntries(named.map((name) => [name, process.env[name] ?? fromFiles[name] ?? ''])), {
    PGHOST: process.env.PGHOST ?? fromFiles.PGHOST,
    PGHOSTADDR: process.env.PGHOSTADDR ?? fromFiles.PGHOSTADDR,
    PGSERVICE: process.env.PGSERVICE ?? fromFiles.PGSERVICE,
  });
  if (offenders.length && !config.allowRemoteData) {
    return {
      reason: `data URL not proven local: ${offenders.join(', ')}`,
      fix: `a data destination is not proven local (${offenders.join(', ')}): point the data URL at a local backend — an explicit loopback address or an owned local socket, forwarding an owned container to loopback rather than trusting its DNS name`,
    };
  }
  return null;
}

// ---- the processes ----

const children: ChildProcess[] = [];
const suites = new Set<ChildProcess>();
function stop(c: ChildProcess) { try { process.kill(-c.pid!, 'SIGTERM'); } catch { /* already gone */ } }
/** Every child is asked, not killed: each suite ends its own Chrome on SIGTERM. */
function stopAll() { for (const c of children) stop(c); for (const c of suites) c.kill('SIGTERM'); }
process.on('exit', stopAll);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));

function run(script: string, extra: string[], env: NodeJS.ProcessEnv = process.env): Promise<Ran> {
  const t = Date.now();
  // Announced before it starts, not only after: a suite that stops making progress leaves its command line as the last
  // line of the log, so where it stalled is visible without attaching to the process.
  console.log(`… ${script}${extra.length ? ` ${extra.join(' ')}` : ''}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...extra], { cwd: ROOT, env });
    suites.add(child);
    let out = '';
    let err = '';
    // Streamed as it arrives and captured for the report: a suite that stops making progress is visible in the log at
    // once, instead of the log staying silent until the child finally exits.
    child.stdout.on('data', (d) => { out += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    child.on('close', (status) => { suites.delete(child); resolve({ status, out: out.trim(), err: err.trim(), took: secs(t) }); });
  });
}

function step(name: string, cmd: string, a: string[], env: NodeJS.ProcessEnv = process.env): Ran {
  const t = Date.now();
  const r = spawnSync(cmd, a, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const status = r.status ?? 1;
  phase(status === 0 ? 'ok' : 'FAIL', name, secs(t));
  if (status !== 0) { beneath((r.stdout ?? '') + (r.stderr ?? '')); failed = true; }
  return { status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim(), took: secs(t) };
}

async function start(env: NodeJS.ProcessEnv): Promise<{ port: number; server: ChildProcess }> {
  const port = await freePort();
  const server = spawnNext(port, env);
  children.push(server);
  if (!(await answers(port))) {
    phase('FAIL', 'the built app did not start', null);
    failed = true;
    return { port, server };
  }
  return { port, server };
}

/** What a suite's exit code says: 0 passed, 2 left a case unrun (neither pass nor failure), anything else failed. */
const outcomeOf = (r: Ran): Status => (r.status === 0 ? 'ok' : r.status === 2 ? 'not run' : 'FAIL');

function report(name: string, r: Ran): void {
  const status = outcomeOf(r);
  phase(status, name, r.took);
  if (status === 'ok') ran.push(name);
  else if (status === 'FAIL') { failed = true; beneath(`${r.out}\n${r.err}`); }
  else {
    // A suite left unrun only by the project's own configuration — a rail route with no navigation check, a rail not in
    // a drawer on a phone — is not waiting on evidence a rerun could bring. It is reported as not run with its reason and
    // does not hold the last-green marker; anything else not run is evidence missing, and does.
    const entries = notRunEntries(r.out);
    if (entries.length && entries.every(declaredNotRun)) declared.push(`${name}: ${entries.join('; ')}`);
    else notRun.push(name);
  }
  if (status === 'ok' && r.out) beneath(r.out, 6);
}

/** The `notRun` list a suite's own summary printed (`navigate: {...}`, `perf: {...}`), or nothing when it printed none. */
function notRunEntries(out: string): string[] {
  const line = /^(?:navigate|perf): (\{.*\})$/m.exec(out)?.[1];
  if (!line) return [];
  try { return (JSON.parse(line) as { notRun?: string[] }).notRun ?? []; } catch { return []; }
}

function finish(): never {
  stopAll();
  // The Tier 2 values this run's suites recorded, gathered once: the run's table and record (test-run) read them.
  const tier2 = readParts(ROOT).flatMap((p) => p.values);
  clearParts(ROOT);
  const state = { ran, failed, notRun, declared, tier2, seconds: Number(secs(started).toFixed(1)) };
  log(`browser: ${JSON.stringify(state)}`);
  process.exit(failed ? 1 : notRun.length ? 2 : 0);
}

// ---- the sequence ----

const missing: string[] = [];
if (!fs.existsSync(CHROME)) missing.push(`Chrome not found at ${CHROME} (set CHROME)`);
else if (spawnSync(CHROME, ['--version'], { encoding: 'utf8' }).status !== 0) missing.push(`Chrome at ${CHROME} does not run (set CHROME)`);
const unsafe = unsafeBackend();
if (unsafe) missing.push(unsafe.fix);
const fakeSteps = config.fakeModel ?? [];
const stepProblems = fakeModelProblems(fakeSteps);
if (stepProblems.length) missing.push(...stepProblems);

if (missing.length) {
  for (const m of missing) log(`not run browser: ${m}`);
  for (const d of ['fn', 'timed', 'perf']) if (want(d)) notRun.push(`${d}: ${missing.join('; ')}`);
  finish();
}
if (want('perf') && process.env.CI !== 'true') {
  log('not run perf: the 20-sample protocol runs where CI is true, in the weekly job');
  notRun.push('perf');
  depth.delete('perf');
}
if (!depth.size) finish();

if (!built) {
  step('build: next build', bin('next'), ['build'], { ...process.env, MERIDIAN_TYPES_CHECKED: '1' });
  if (failed) finish();
}

// The assistant is off unless configured: blanked, not deleted, because `next start` loads `.env.local` itself and does
// not overwrite a variable that is already set.
const clean: NodeJS.ProcessEnv = { ...process.env };
for (const k of ['ASSISTANT_PROVIDER', 'ASSISTANT_API_KEY', 'ASSISTANT_MODEL', 'ASSISTANT_BASE_URL', ...Object.keys(clean).filter((k) => k.startsWith('ASSISTANT_'))]) clean[k] = '';

let app = clean;
if (config.fakeApi) {
  const api = spawn(process.execPath, [config.fakeApi.script, '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  children.push(api);
  const apiUrl = await new Promise<string>((resolve) => {
    let buf = '';
    api.stdout!.on('data', (d) => { buf += String(d); const m = /listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
    api.on('close', () => resolve(''));
  });
  if (!apiUrl) { phase('FAIL', `the fake API (${config.fakeApi.script}) did not start`, null); failed = true; finish(); }
  app = { ...clean, [config.fakeApi.env]: apiUrl };
  phase('ok', 'the fake API', null, `is serving at ${apiUrl} (${config.fakeApi.env})`);
}

const hasAssistant = fs.existsSync(path.join(ROOT, APP_DIR, 'api/assistant/route.ts'));
const hasLiveSample = sampleSurfaces(ROOT, APP_DIR).members;
const own = (config.browserChecks ?? []).map((c) => (typeof c === 'string' ? { script: c, browsers: 1 } : c));
const ownTimed = config.timedChecks ?? [];
const refusal = config.refusal === 'absent'
  ? { absent: true, selector: '[data-missing-page]', page: 'the missing page' }
  : { absent: false, selector: '[data-no-access]', page: 'NoAccess' };

let server = await start(app);
if (failed) finish();

// The size checks, against the app this run started: first-load bytes from the build's own stats, then every page's
// gzipped HTML through the served response. One call, once, so neither figure is measured twice. Each verdict is its own
// phase, as the check prints it: a FAIL fails the run, and a warning ("growth not configured") is never reported as a
// pass — an adopted project has no HTML baseline until it records one.
const sized = await run('scripts/sizes.ts', ['--base', `http://127.0.0.1:${server.port}`]);
{
  const verdicts = sized.out.split('\n').flatMap((l) => {
    const m = /^(ok|warn|FAIL|not run)\s+(first-load|html)\s+(.*)$/.exec(l);
    return m ? [{ status: m[1] as Status, name: m[2], detail: m[3] }] : [];
  });
  if (!verdicts.length) { failed = true; phase('FAIL', 'sizes', sized.took, '(printed no verdict)'); beneath(`${sized.out}\n${sized.err}`); }
  for (const v of verdicts) {
    phase(v.status, `sizes: ${v.name}`, sized.took, v.detail);
    if (v.status === 'FAIL') { failed = true; beneath(sized.out.split('\n').filter((l) => l.startsWith('FAIL')).join('\n')); }
    else if (v.status === 'warn') {
      // A figure past its budget, or growth not judged under this Node major: reported with its numbers, never a failure
      // and never a not-run — the check ran and said what it measured (Tier 2, docs/testing.md).
      ran.push(`sizes: ${v.name}`);
    }
    else if (v.status === 'not run') {
      // A size check left unrun because the baseline is the release's, not the project's, is the project's own
      // configuration (declaredNotRun): reported with the reason, and not holding the marker any more than navigation is.
      const entry = `sizes: ${v.name}${v.detail ? ` (${v.detail})` : ''}`;
      (declaredNotRun(v.detail) ? declared : notRun).push(entry);
    }
    else ran.push(`sizes: ${v.name}`);
  }
  if (sized.status !== 0) failed = true;
}
if (failed) finish();

// The navigation: every rail route when the config maps them all, else the smoke routes with their data and interaction
// reported not configured. A product mid-adoption has no mappings yet; the smoke is what its own run can prove. The
// function run is read here; the timed one runs last, in the timed block below, so what judges a time runs alone.
let navPlan: { label: string; args: (timing: 'on' | 'off') => string[] } | null = null;
if (want('fn') || want('timed')) {
  let rail: { routes: string[]; landing: string };
  try { rail = await railRoutes(); } catch (e) { phase('FAIL', 'the rail routes could not be read', null, (e as Error).message); failed = true; finish(); }
  const mapped = new Set((config.navigationChecks ?? []).map((c) => c.path));
  const full = rail.routes.every((r) => mapped.has(r));
  let navRoutes = rail.routes;
  if (!full) {
    try { navRoutes = selectSmokeRoutes({ smokeRoutes: config.smokeRoutes, nav: rail.routes, landing: rail.landing }); }
    catch { navRoutes = rail.routes.slice(0, 3); }
  }
  navPlan = {
    label: full ? 'every rail route' : `the smoke routes ${navRoutes.join(', ')}`,
    args: (timing) => ['--base', `http://127.0.0.1:${server.port}`, '--mode', full ? 'full' : 'default', '--timing', timing, '--routes', navRoutes.join(',')],
  };
  if (want('fn')) {
    const nav = await run('scripts/navigate.ts', navPlan.args('off'), app);
    report(`navigation: ${navPlan.label}, its budgets unjudged`, nav);
  }
  if (failed) finish();

  // --as the personas, each against a fresh server: a persona's presses change the sample's state.
  if (want('fn') && config.personas && Object.keys(config.personas).length) {
    const personaPage = await launch();
    try {
      for (const name of Object.keys(config.personas)) {
        const persona = config.personas[name];
        const fresh = await start(app);
        const here = `http://127.0.0.1:${fresh.port}`;
        const problems: string[] = [];
        try {
          const railRun = await run('scripts/rail.ts', ['--base', here, '--as', name], app);
          const links = /^rail: (.*)$/m.exec(railRun.out)?.[1];
          if (!links) problems.push(`${name}: the rail suite printed no links (${railRun.out.split('\n').filter(Boolean).slice(-1)[0] ?? 'no output'})`);
          else {
            const shown = JSON.parse(links) as string[];
            const expected = [...persona.expectedRoutes];
            const absent = expected.filter((r) => !shown.includes(r));
            const extra = shown.filter((r) => !expected.includes(r));
            if (absent.length) problems.push(`${name}: the rail is missing ${absent.join(', ')}`);
            if (extra.length) problems.push(`${name}: the rail shows ${extra.join(', ')}, which this persona is not expected to see`);
          }
          const roleRoutes = (persona.pressRoutes ?? persona.expectedRoutes).filter((r) => persona.expectedRoutes.includes(r));
          if (roleRoutes.length) {
            const presses = await run('scripts/interactions.ts', ['--base', here, '--as', name, '--width', '1440', '--routes', roleRoutes.join(',')], app);
            if (presses.status !== 0) problems.push(`${name}: the presses failed on ${roleRoutes.join(', ')} — ${presses.out.split('\n').filter(Boolean).slice(-1)[0] ?? 'no output'}`);
          }
          for (const route of persona.expectedRoutes) {
            await personaPage.open(here + route, { width: 1440, height: 900, theme: 'dark', cookie: persona.cookie });
            const denied = await personaPage.eval<boolean>(`(async () => { await new Promise((r) => setTimeout(r, 400)); return !!document.querySelector(${JSON.stringify(refusal.selector)}); })()`);
            if (denied) problems.push(`${name}: ${route} is expected of this persona, but the page shows ${refusal.page}`);
          }
          const deniedProbe = persona.deniedProbe ?? {};
          for (const route of rail.routes.filter((r) => !persona.expectedRoutes.includes(r))) {
            await personaPage.open(here + route, { width: 1440, height: 900, theme: 'dark', cookie: persona.cookie });
            const denied = await personaPage.eval<boolean>(`(async () => { const end = Date.now() + 5000; while (Date.now() < end) { if (document.querySelector(${JSON.stringify(refusal.selector)})) return true; await new Promise((r) => setTimeout(r, 100)); } return false; })()`);
            if (!denied) problems.push(`${name}: ${route} should show ${refusal.page} for this persona, and does not`);
            if (refusal.absent && (await personaPage.eval<boolean>('!!document.querySelector("[data-no-access]")'))) problems.push(`${name}: ${route} shows NoAccess, and the product's refusal is absent`);
            const probe = deniedProbe[route];
            if (probe) {
              const text = await personaPage.eval<string>('document.body.innerText');
              if (text.includes(probe)) problems.push(`${name}: ${route} leaked "${probe}"`);
            }
          }
        } finally {
          stop(fresh.server);
        }
        if (problems.length) { failed = true; phase('FAIL', `persona ${name}`, null, problems.join('; ')); }
        else phase('ok', `persona ${name}`, null, `the rail matches its ${persona.expectedRoutes.length} routes`);
      }
    } finally {
      personaPage.close();
    }
    if (failed) finish();
  }
}

// The function-only suites that change data: the assistant walk first, alone, then the audit, the presses, the keyboard
// walk and the product's own checks side by side against the one built app.
if (want('fn')) {
  let here = `http://127.0.0.1:${server.port}`;
  if (hasAssistant) {
    const off = await run('scripts/assistant.ts', ['--base', here, '--expect', 'off'], app);
    report('assistant absent without its variables', off);
    if (failed) { stop(server.server); finish(); }

    const fake = spawn(process.execPath, ['scripts/fake-llm.ts', '--port', '0', ...fakeModelArgs(fakeSteps)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
    children.push(fake);
    const llmUrl = await new Promise<string>((resolve) => {
      let buf = '';
      fake.stdout!.on('data', (d) => { buf += String(d); const m = /fake-llm listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
      fake.on('close', () => resolve(''));
    });
    if (!llmUrl) { phase('FAIL', 'the fake LLM did not start', null); failed = true; stop(server.server); finish(); }
    // A distinctive key per run: the walk-through searches everything the browser can get for it.
    const key = `browser-${randomBytes(16).toString('hex')}`;
    stop(server.server);
    server = await start({ ...app, ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_BASE_URL: llmUrl, ASSISTANT_API_KEY: key, ASSISTANT_MODEL: 'fake' });
    if (failed) finish();
    here = `http://127.0.0.1:${server.port}`;
    const on = await run('scripts/assistant.ts', ['--base', here, '--expect', 'on', '--llm', llmUrl, '--key', key], app);
    report('assistant walk-through', on);
    if (failed) finish();
  } else {
    phase('n/a', 'assistant walk-through', null, '(this product has no assistant)');
  }

  const [audit, presses, keys, ...extras] = await Promise.all([
    run('scripts/audit.ts', ['--base', here]),
    run('scripts/interactions.ts', ['--base', here]),
    run('scripts/keyboard.ts', ['--base', here]),
    ...own.map((c) => run(c.script, ['--base', here], { ...process.env, VERIFY_BROWSERS: String(c.browsers) })),
  ]);
  report('audit: every page at every width in both themes', audit);
  report('every control pressed and every link followed', presses);
  report('the whole keyboard path', keys);
  extras.forEach((r, i) => report(`the product's check ${own[i].script}`, r));
  if (failed) finish();
}

// The timed set, last and alone: what judges a time must not share the machine with anything else.
if (want('timed')) {
  const here = `http://127.0.0.1:${server.port}`;
  if (navPlan) {
    report(`navigation: ${navPlan.label}, its budgets judged`, await run('scripts/navigate.ts', navPlan.args('on'), app));
    if (failed) finish();
  }
  if (hasLiveSample) {
    const dropped = await start({ ...app, LIVE_DROP_HINTS: '1' });
    const live = await run('scripts/live.ts', ['--base', here, '--drop-base', `http://127.0.0.1:${dropped.port}`], app);
    stop(dropped.server);
    report('live data: two tabs, a silent stream, a restart, a hidden and an offline tab, a burst', live);
  } else {
    phase('n/a', 'live data', null, '(the sample Members page the live checks drive is not in this product)');
  }
  for (const script of ownTimed) report(`the product's timed check ${script}`, await run(script, ['--base', here]));
  report('LCP, INP, CLS and dropped frames on a mid-range phone', await run('scripts/vitals.ts', ['--base', here]));
  if (failed) finish();
}

if (want('perf')) {
  report('performance: 20 samples per route, device and condition, p95 against the budgets', await run('scripts/perf.ts', ['--base', `http://127.0.0.1:${server.port}`]));
}

finish();

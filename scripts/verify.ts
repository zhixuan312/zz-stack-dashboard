/**
 * Verify a Meridian project against the standard, in one command: the gate, a production build, the built app started
 * on a free port, the browser audit of every page and embed view against it, every control pressed and every link
 * followed (scripts/interactions.ts), the whole keyboard path (scripts/keyboard.ts), the product's own browser checks
 * (`browserChecks` in scripts/verify.config.ts), LCP, INP and CLS on a mid-range phone (scripts/vitals.ts), and a report.
 *
 * Two steps depend on the project, read from scripts/verify.config.ts and app/:
 * - With a fake API configured, it starts first and the app is built and served against it, so the presses (Approve,
 *   Revoke and Delete included) never reach a live backend.
 * - With the assistant (app/api/assistant/route.ts), the app starts twice: without it, then pointed at a fake LLM for the
 *   walk-through (scripts/assistant.ts: asks, approves and dismisses on /members, then the thread, the switch, the
 *   layout, a refused key and the key's absence from the browser).
 *
 *   pnpm verify [--quick] [--extra /requests/req_1,/customers/acme]
 *
 * The detail pages in scripts/verify.config.ts are checked by default; --extra replaces them for one run.
 * Exit 0 only when everything passes. The report is written to out/verify.txt.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import config from './verify.config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

const argv = process.argv.slice(2);
// The detail pages in scripts/verify.config.ts are checked by default; --extra replaces them for one run.
const pass = argv.includes('--extra') || !config.detailRoutes.length ? argv : [...argv, '--extra', config.detailRoutes.join(',')];
// A project that has not adopted the assistant has no walk-through to run, only the pages.
const hasAssistant = fs.existsSync(path.join(ROOT, 'app/api/assistant/route.ts'));
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); };
const finish = (code: number) => {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/verify.txt'), lines.join('\n') + '\n');
  process.exit(code);
};

const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

// The assistant is off unless configured: the build and the first start must not see the caller's own variables.
const clean: NodeJS.ProcessEnv = { ...process.env };
for (const k of Object.keys(clean)) if (k.startsWith('ASSISTANT_')) delete clean[k];

function step(name: string, cmd: string, args: string[], env = clean) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const ok = r.status === 0;
  log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  if (!ok) { log((r.stdout + r.stderr).trim().split('\n').slice(-60).join('\n')); finish(1); }
  return r.stdout;
}

const children: ChildProcess[] = [];
const stopAll = () => { for (const c of children) { try { process.kill(-c.pid!, 'SIGTERM'); } catch { /* already gone */ } } };
process.on('exit', stopAll);
const stop = (c: ChildProcess) => { try { process.kill(-c.pid!, 'SIGTERM'); } catch { /* already gone */ } };

/** Start the built app on a free port with the given environment and wait until it answers. */
async function start(env: NodeJS.ProcessEnv) {
  const port = await freePort();
  const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port)], { cwd: ROOT, env, stdio: 'ignore', detached: true });
  children.push(server);
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).status < 500) return { port, server }; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  log('FAIL the built app did not start'); finish(1);
  throw new Error('unreachable');
}

/** Run a node script to completion and keep what it printed. */
const run = (script: string, extra: string[], env: NodeJS.ProcessEnv = process.env) => new Promise<{ status: number | null; out: string }>((resolve) => {
  const child = spawn('node', [script, ...extra], { cwd: ROOT, env: { ...env, DPR: process.env.DPR ?? '1' } as NodeJS.ProcessEnv });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  child.on('close', (status) => resolve({ status, out: out.trim() }));
});

step('gate: tokens, registry, specifications, contrast, lint, types, tests', 'node', ['scripts/gate.ts']);

// A product whose pages call a live API is checked against its fake (scripts/verify.config.ts): the presses below
// approve, revoke and delete whatever a page offers. The fake starts first, because its address goes into the build.
let app = clean;
if (config.fakeApi) {
  const api = spawn('node', [config.fakeApi.script, '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  children.push(api);
  const apiUrl = await new Promise<string>((resolve) => {
    let buf = '';
    api.stdout!.on('data', (d) => { buf += d; const m = /listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
    api.on('close', () => resolve(''));
  });
  if (!apiUrl) { log(`FAIL the fake API (${config.fakeApi.script}) did not start`); finish(1); }
  app = { ...clean, [config.fakeApi.env]: apiUrl };
  log(`ok   the fake API is serving at ${apiUrl} (${config.fakeApi.env})`);
}
step('production build', 'pnpm', ['exec', 'next', 'build'], app);

let on: { status: number | null; out: string } = { status: 0, out: '' };
let port: number;
if (hasAssistant) {
  // Start 1: no assistant variables. The assistant must be absent.
  const first = await start(app);
  const off = await run('scripts/assistant.ts', ['--base', `http://127.0.0.1:${first.port}`, '--expect', 'off'], app);
  stop(first.server);
  log(off.out);
  if (off.status !== 0) { log('FAIL assistant off'); finish(1); }

  // Start 2: pointed at the fake LLM. The audit and the presses then see the launcher.
  const fake = spawn('node', ['scripts/fake-llm.ts', '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
  children.push(fake);
  const llmUrl = await new Promise<string>((resolve) => {
    let buf = '';
    fake.stdout!.on('data', (d) => { buf += d; const m = /fake-llm listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
    fake.on('close', () => resolve(''));
  });
  if (!llmUrl) { log('FAIL the fake LLM did not start'); finish(1); }
  // A distinctive key per run: the walk-through searches everything the browser can get for it.
  const key = `verify-${randomBytes(16).toString('hex')}`;
  ({ port } = await start({ ...app, ASSISTANT_PROVIDER: 'openai-compatible', ASSISTANT_BASE_URL: llmUrl, ASSISTANT_API_KEY: key, ASSISTANT_MODEL: 'fake' }));
  log(`ok   the built app is serving on port ${port}`);

  // The walk-through changes the sample's data (it suspends members), so it runs first and alone; the audit and the
  // presses then run on what it left, and their presses never change what it reads.
  on = await run('scripts/assistant.ts', ['--base', `http://127.0.0.1:${port}`, '--expect', 'on', '--llm', llmUrl, '--key', key]);
  log(on.out);
  if (on.status !== 0) log('FAIL assistant on');
} else {
  ({ port } = await start(app));
  log(`ok   the built app is serving on port ${port} (no assistant in this project, so no walk-through)`);
}

// The audit and the presses each run their own browser, so they run side by side against the one built app.
const t = Date.now();
const base = ['--base', `http://127.0.0.1:${port}`, ...pass];
const own = config.browserChecks ?? [];
const [audit, presses, keys, ...extras] = await Promise.all([
  run('scripts/audit.ts', base),
  run('scripts/interactions.ts', base),
  run('scripts/keyboard.ts', base),
  ...own.map((script) => run(script, ['--base', `http://127.0.0.1:${port}`])),
]);
log(audit.status === 0 ? 'ok   browser audit' : 'FAIL browser audit');
log(audit.out.split('\n').slice(-80).join('\n'));
log(presses.status === 0 ? 'ok   every control and link works' : 'FAIL controls or links that do nothing');
log(presses.out.split('\n').slice(-40).join('\n'));
log(keys.status === 0 ? 'ok   the whole keyboard path, every stop ringed and on top' : 'FAIL the keyboard path');
log(keys.out.split('\n').slice(-30).join('\n'));
extras.forEach((r, i) => {
  log(r.status === 0 ? `ok   ${own[i]}` : `FAIL ${own[i]}`);
  log(r.out.split('\n').slice(-30).join('\n'));
});
log(`(browser checks ${((Date.now() - t) / 60_000).toFixed(1)} min)`);

// Web Vitals on a mid-range phone, alone: CPU throttling measures the machine too, so nothing else runs beside it.
const vitals = await run('scripts/vitals.ts', base);
log(vitals.status === 0 ? 'ok   LCP, INP and CLS on a mid-range phone' : 'FAIL Web Vitals on a mid-range phone');
log(vitals.out.split('\n').slice(-30).join('\n'));
stopAll();
const ok = audit.status === 0 && presses.status === 0 && keys.status === 0 && extras.every((r) => r.status === 0) && on.status === 0 && vitals.status === 0;
log(ok ? '\nverify: the project meets the Meridian standard' : '\nverify: fix the issues above and run pnpm verify again');
finish(ok ? 0 : 1);

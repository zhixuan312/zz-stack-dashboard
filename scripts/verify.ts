/**
 * Verify the console against the Meridian standard, in one command: the gate, a production build pointed at the fake
 * gateway (scripts/fake-gateway), the built app started on a free port, the browser audit of every page against it,
 * every control pressed and every link followed (scripts/interactions.ts), the whole keyboard path of every page
 * (scripts/keyboard.ts), and a report. Core Web Vitals are `pnpm vitals`, apart: they depend on the machine.
 *
 *   pnpm verify [--quick] [--extra /teams/atlas,/plugins/sdlc]
 *
 * Without --extra, the detail pages in scripts/fake-gateway/routes.ts are checked beside every static route.
 *
 * Why a fake gateway: the presses approve, revoke and archive whatever a page offers, so they must never reach the
 * real deployment. `next.config.ts` bakes `ZZ_GATEWAY` into the build's rewrites, so the gateway starts first and the
 * build is made against it. That build is for checking only; the image the release ships is built without it.
 *
 * Meridian's own verify also walks its assistant; the console has not adopted the assistant, so it has no such step.
 *
 * Exit 0 only when everything passes. The report is written to out/verify.txt.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { DETAIL_ROUTES } from './fake-gateway/routes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
// The fake gateway's records give the detail pages worth seeing; --extra replaces them.
const pass = argv.includes('--extra') ? argv : [...argv, '--extra', DETAIL_ROUTES.join(',')];
const lines: string[] = [];
const log = (s: string) => { console.log(s); lines.push(s); };
const finish = (code: number) => {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/verify.txt'), lines.join('\n') + '\n');
  process.exit(code);
};

const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

// The build must not see a gateway from the caller's own environment: only the fake one.
const clean: NodeJS.ProcessEnv = { ...process.env };
delete clean.ZZ_GATEWAY;
delete clean.ZZ_DEV_PAT;

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

step('gate: tokens, specifications, contrast, types, tests', 'node', ['scripts/gate.ts']);

// The fake gateway first: its address goes into the build.
const gateway = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], detached: true });
children.push(gateway);
const gatewayUrl = await new Promise<string>((resolve) => {
  let buf = '';
  gateway.stdout!.on('data', (d) => { buf += d; const m = /fake-gateway listening on (\S+)/.exec(buf); if (m) resolve(m[1]); });
  gateway.on('close', () => resolve(''));
});
if (!gatewayUrl) { log('FAIL the fake gateway did not start'); finish(1); }
const withGateway: NodeJS.ProcessEnv = { ...clean, ZZ_GATEWAY: gatewayUrl };
step('production build, against the fake gateway', 'pnpm', ['exec', 'next', 'build'], withGateway);
const { port } = await start(withGateway);
log(`ok   the built app is serving on port ${port}, reading the fake gateway at ${gatewayUrl}`);

// The audit and the presses each run their own browser, so they run side by side against the one built app.
const t = Date.now();
const base = ['--base', `http://127.0.0.1:${port}`, ...pass];
const [audit, presses, keys] = await Promise.all([run('scripts/audit.ts', base), run('scripts/interactions.ts', base), run('scripts/keyboard.ts', ['--base', `http://127.0.0.1:${port}`])]);
log(audit.status === 0 ? 'ok   browser audit' : 'FAIL browser audit');
log(audit.out.split('\n').slice(-80).join('\n'));
log(presses.status === 0 ? 'ok   every control and link works' : 'FAIL controls or links that do nothing');
log(presses.out.split('\n').slice(-40).join('\n'));
log(keys.status === 0 ? 'ok   the whole keyboard path' : 'FAIL keyboard path');
log(keys.out.split('\n').filter((l) => !l.startsWith('ok ')).slice(-30).join('\n'));
log(`(browser checks ${((Date.now() - t) / 60_000).toFixed(1)} min)`);
stopAll();
const ok = audit.status === 0 && presses.status === 0 && keys.status === 0;
log(ok ? '\nverify: the project meets the Meridian standard' : '\nverify: fix the issues above and run pnpm verify again');
finish(ok ? 0 : 1);

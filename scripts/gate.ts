/**
 * Every gate the system must pass before a commit, in order; stops at the first failure. The type check, the lint and
 * the tests read the same tree and write nothing the others read, so they run side by side once the checks before them
 * pass: each runs to its end, and their lines print in the order below.
 *
 * The gate never runs tests/deep-*, the browser-fixture tests of the checks: they drive real browsers and take minutes.
 * They run on their own: pnpm exec vitest run tests/deep- --no-file-parallelism
 *
 *   pnpm gate   (or npm run gate: the tools run from node_modules/.bin, under any package manager)
 *   node scripts/gate.ts --without-cli-tests   also leaves out tests/cli-*, the package's own tests that only this
 *                                              repository has. The default verify runs it this way, and the release
 *                                              runs those tests in a step of their own
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bin } from './lib/bin.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const withoutCliTests = process.argv.includes('--without-cli-tests');
const STEPS: [string, string[]][] = [
  ['tokens are fresh', ['node', 'scripts/tokens.ts', '--check']],
  // A product build (brand.ts --product) has no card previews, so no registry to keep fresh.
  ...(fs.existsSync(path.join(ROOT, 'src/system/registry.ts')) ? [['the registry is fresh', ['node', 'scripts/registry.ts', '--check']] as [string, string[]]] : []),
  ['specifications are consistent', ['node', 'scripts/check.ts']],
  // A product's own rules, beside Meridian's, so check.ts is never patched: present only where the product wrote one.
  ...(fs.existsSync(path.join(ROOT, 'scripts/check.local.ts')) ? [['the product\'s own rules hold', ['node', 'scripts/check.local.ts']] as [string, string[]]] : []),
  ['contrast holds in every theme and accent', ['node', 'scripts/contrast.ts']],
  // Route types first: a page added since the last build would otherwise fail against stale generated routes.
  ['route types are generated', [bin('next'), 'typegen']],
  ['types check', [bin('tsc'), '--noEmit']],
  // eslint-config-next is what every Next project runs; a template that fails it hands its users errors on day one.
  // The staged copies of an update session are for reading, never linted as source.
  ['lint passes', [bin('eslint'), '.', '--ignore-pattern', '.meridian/']],
  ['tests pass', [bin('vitest'), 'run', '--exclude', 'tests/deep-*', '--exclude', '**/node_modules/**', ...(withoutCliTests ? ['--exclude', 'tests/cli-*'] : [])]],
];

/** The steps that run side by side, from the first of them to the end. */
const TOGETHER = STEPS.findIndex(([name]) => name === 'types check');

const report = (name: string, t: number, r: { status: number | null; out: string; error?: Error }, cmd: string) => {
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${(t / 1000).toFixed(1)}s)`);
  // A tool that could not start (not installed) has no output, only the error.
  if (!ok) console.log(`${r.out}${r.error ? `${cmd}: ${r.error.message}` : ''}`.trim().split('\n').slice(-40).join('\n'));
  return ok;
};

for (const [name, [cmd, ...args]] of STEPS.slice(0, TOGETHER)) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  if (!report(name, Date.now() - t, { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, error: r.error }, cmd)) process.exit(1);
}

const together = await Promise.all(STEPS.slice(TOGETHER).map(([name, [cmd, ...args]]) => new Promise<{ name: string; cmd: string; t: number; status: number | null; out: string; error?: Error }>((resolve) => {
  const t = Date.now();
  let out = '';
  const child = spawn(cmd, args, { cwd: ROOT });
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('error', (error) => resolve({ name, cmd, t: Date.now() - t, status: null, out, error }));
  child.on('close', (status) => resolve({ name, cmd, t: Date.now() - t, status, out }));
})));
// Each line is reported, the failed ones with their output: none is cut short by another's failure.
if (!together.map((r) => report(r.name, r.t, r, r.cmd)).every(Boolean)) process.exit(1);
// An adopted project has no tests/deep-*, so it has nothing to say about them.
const hasDeepTests = fs.existsSync(path.join(ROOT, 'tests')) && fs.readdirSync(path.join(ROOT, 'tests')).some((f) => f.startsWith('deep-'));
const left = withoutCliTests
  ? ' (the tests only this repository has left out: tests/cli-*, tests/deep-*)'
  : hasDeepTests ? ' (tests/deep-* left out: pnpm exec vitest run tests/deep- --no-file-parallelism runs them)' : '';
console.log(`gate: every check passed${left}`);

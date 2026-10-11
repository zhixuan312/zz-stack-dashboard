/**
 * Every gate the system must pass before a commit, in order; stops at the first failure.
 *
 *   pnpm gate   (or npm run gate: the tools run from node_modules/.bin, under any package manager)
 *   node scripts/gate.ts --without-cli-tests   leaves out the tests only this repository has, neither shipped:
 *                                              tests/cli-* (the package's own) and tests/deep-* (the browser-fixture
 *                                              tests of the checks). The default verify runs it this way, and the
 *                                              release runs those tests in a step of their own
 */
import { spawnSync } from 'node:child_process';
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
  ['tests pass', [bin('vitest'), 'run', ...(withoutCliTests ? ['--exclude', 'tests/cli-*', '--exclude', 'tests/deep-*', '--exclude', '**/node_modules/**'] : [])]],
];

for (const [name, [cmd, ...args]] of STEPS) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  if (!ok) {
    // A tool that could not start (not installed) has no output, only the error.
    console.log(`${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `${cmd}: ${r.error.message}` : ''}`.trim().split('\n').slice(-40).join('\n'));
    process.exit(1);
  }
}
console.log(`gate: every check passed${withoutCliTests ? " (the tests only this repository has left out: tests/cli-*, tests/deep-*)" : ''}`);

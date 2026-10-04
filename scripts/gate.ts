/**
 * Every gate the system must pass before a commit, in order; stops at the first failure.
 *
 *   pnpm gate   (or npm run gate: the tools run from node_modules/.bin, under any package manager)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bin } from './lib/bin.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
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
  ['lint passes', [bin('eslint'), '.']],
  ['tests pass', [bin('vitest'), 'run']],
];

for (const [name, [cmd, ...args]] of STEPS) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  if (!ok) {
    console.log((r.stdout + r.stderr).trim().split('\n').slice(-40).join('\n'));
    process.exit(1);
  }
}
console.log('gate: every check passed');

// The failure this catches is specific: a dangling symlink made `audit:design` die with
// ERR_MODULE_NOT_FOUND against a path in a deleted temp directory, which reads as a broken
// script rather than a missing dependency and so never got fixed.
import { execFileSync } from 'node:child_process';
import { execOutput } from '../scripts/lib/exec.ts';
import { lstatSync, existsSync, realpathSync, readFileSync } from 'node:fs';
let code = 0;
for (const p of ['node_modules/puppeteer', 'node_modules/puppeteer-core', 'node_modules/@puppeteer']) {
  if (!existsSync(p)) continue;
  try {
    const st = lstatSync(p);
    if (st.isSymbolicLink() && !existsSync(realpathSync(p) + '/package.json')) {
      console.error('FAIL ' + p + ' is a dangling symlink'); code = 1;
    }
  } catch { console.error('FAIL ' + p + ' cannot be resolved'); code = 1; }
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = (pkg.devDependencies ?? {}).puppeteer ?? (pkg.dependencies ?? {}).puppeteer;
if (!declared) {
  console.error('FAIL puppeteer is used by audit:design but declared nowhere'); code = 1;
}
let out = '';
try { out = execFileSync('node', ['scripts/design-metrics.ts'], { stdio: 'pipe', timeout: 300000 }).toString(); }
catch (e) { out = execOutput(e); }
if (/ERR_MODULE_NOT_FOUND|Cannot find package/.test(out)) {
  console.error('FAIL audit:design still dies on module resolution'); code = 1;
}
if (!code) console.log('PASS puppeteer declared (' + declared + '), no dangling links, audit:design resolves');
process.exitCode = code;

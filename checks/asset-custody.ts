import { readFileSync, readdirSync, existsSync } from 'node:fs';
const fail = (m: string): void => { console.error('FAIL ' + m); process.exitCode = 1; };

const ignore = readFileSync('.dockerignore', 'utf8').split('\n').map((s) => s.trim());
/* `design/` is 38MB of source art, tracked in git (a master that lives on one laptop is a
 * master the team does not have) and shipped to nobody. The failure is INVISIBLE if this
 * line goes missing — the image builds fine, just fatter, forever — which is exactly the
 * kind of thing a check is for and a review is not. `checks/` rides along for the same
 * reason `tests` does: it runs in CI, never in the container. */
for (const entry of ['design', 'checks']) {
  if (!ignore.includes(entry)) fail('.dockerignore has no `' + entry + '` entry');
}

const CUSTODY: [string, number][] = [['design/in-use', 12], ['design/reference', 10]];
for (const [dir, want] of CUSTODY) {
  if (!existsSync(dir)) { fail(dir + ' does not exist'); continue; }
  const n = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
  if (n !== want) fail(`${dir} holds ${n} PNGs, expected ${want}`);
}

/* AC-1.1's OTHER HALF. The spec asks for two folders AND a README saying which is which
 * and why; this check counted the folders and never looked for the README. It happens to
 * exist — it predates this work — so the criterion was satisfied by luck, and a check that
 * is right by luck tells you nothing the day somebody tidies the file away. */
if (!existsSync('design/README.md')) {
  fail('design/README.md is missing — nothing says which folder is which, or why');
} else {
  const readme = readFileSync('design/README.md', 'utf8');
  for (const dir of ['in-use', 'reference']) {
    if (!readme.includes(dir)) fail(`design/README.md does not explain design/${dir}/`);
  }
}

const stray = readdirSync('public/assets').filter((f) => f.endsWith('.png'));
if (stray.length) fail('brand source still under public/assets: ' + stray.join(', '));

if (!process.exitCode) console.log('PASS asset custody');

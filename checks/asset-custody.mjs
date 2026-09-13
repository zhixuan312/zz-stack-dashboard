import { readFileSync, readdirSync, existsSync } from 'node:fs';
const fail = (m) => { console.error('FAIL ' + m); process.exitCode = 1; };

const ignore = readFileSync('.dockerignore', 'utf8').split('\n').map((s) => s.trim());
/* `design/` is 38MB of source art, tracked in git (a master that lives on one laptop is a
 * master the team does not have) and shipped to nobody. The failure is INVISIBLE if this
 * line goes missing — the image builds fine, just fatter, forever — which is exactly the
 * kind of thing a check is for and a review is not. `checks/` rides along for the same
 * reason `tests` does: it runs in CI, never in the container. */
for (const entry of ['design', 'checks']) {
  if (!ignore.includes(entry)) fail('.dockerignore has no `' + entry + '` entry');
}

for (const [dir, want] of [['design/in-use', 12], ['design/reference', 10]]) {
  if (!existsSync(dir)) { fail(dir + ' does not exist'); continue; }
  const n = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
  if (n !== want) fail(`${dir} holds ${n} PNGs, expected ${want}`);
}

const stray = readdirSync('public/assets').filter((f) => f.endsWith('.png'));
if (stray.length) fail('brand source still under public/assets: ' + stray.join(', '));

if (!process.exitCode) console.log('PASS asset custody');

import { readFileSync, readdirSync, existsSync } from 'node:fs';
const fail = (m: string): void => { console.error('FAIL ' + m); process.exitCode = 1; };

const ignore = readFileSync('.dockerignore', 'utf8').split('\n').map((s) => s.trim());
/* `design/` is source art: tracked in git, shipped to nobody. Drop the .dockerignore entry
 * and the image still builds, just permanently fatter, with no error anywhere. `checks/` is
 * excluded for the same reason `tests` is: it runs in CI, never in the container. */
for (const entry of ['design', 'checks']) {
  if (!ignore.includes(entry)) fail('.dockerignore has no `' + entry + '` entry');
}

const CUSTODY: [string, number][] = [['design/in-use', 12], ['design/reference', 10]];
for (const [dir, want] of CUSTODY) {
  if (!existsSync(dir)) { fail(dir + ' does not exist'); continue; }
  const n = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
  if (n !== want) fail(`${dir} holds ${n} PNGs, expected ${want}`);
}

/* The two folders do not say which is which, or why; the README does, so counting the
 * folders alone is not enough. */
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

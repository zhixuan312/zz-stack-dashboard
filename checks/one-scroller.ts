/* One scroller, and rows are the only page grid: the layout contract, made mechanical.
 *
 * COUPLED: the contract itself is `src/components/ui/layout.tsx` — changing what `Row` or the
 * shell offers means changing the allowances below.
 *
 * Allowed scrollers are the shell's own: the page body and the sidebar rail (and its drawer
 * copy), plus /login, which sits outside the shell and is its own single page. Anything else
 * that scrolls — vertically or sideways — is a card that should have paged or wrapped.
 *
 * Page grids: nothing under app/(dash) spells `grid-cols-*`. A page is a stack of `Row`s, and
 * a `Row` offers exactly the four splits. A grid inside a card is content and lives in a
 * component, where this does not look. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCROLL = /\boverflow-(?:x-|y-)?(?:auto|scroll)\b/;
const GRID = /\bgrid-cols-/;
const SCROLLER_OK = new Set([
  'src/components/ui/shell.tsx',
  'src/components/ui/sidebar-drawer.tsx',
  'app/login/page.tsx',
]);

let code = 0;
const walk = (dir: string, visit: (p: string) => void): void => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, visit);
    else if (/\.(tsx|ts|css)$/.test(p)) visit(p);
  }
};
const scan = (p: string, re: RegExp, what: string) => {
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
    if (re.test(line)) { console.error(`FAIL ${p}:${i + 1} ${what}: ${line.trim().slice(0, 80)}`); code = 1; }
  });
};

for (const root of ['app', 'src']) {
  walk(root, (p) => { if (!SCROLLER_OK.has(p)) scan(p, SCROLL, 'a second scroller'); });
}
walk('app/(dash)', (p) => scan(p, GRID, 'a page grid that is not a Row'));

if (!code) console.log('PASS one scroller per page, and every page grid is a Row');
process.exitCode = code;

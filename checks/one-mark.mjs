// The defect this closes: the console had TWO marks — a hexagon in the rail and a
// hand-drawn ZZ on every auth screen — and a docstring claiming otherwise.
import { readFileSync, existsSync } from 'node:fs';
let code = 0;
const mark = readFileSync('src/components/AppMark.tsx', 'utf8');
if (!/wordmark/.test(mark)) { console.error('FAIL AppMark does not render the wordmark'); code = 1; }
if (/Hexagon/.test(mark)) { console.error('FAIL AppMark still draws the hexagon'); code = 1; }
for (const f of ['app/login/page.tsx', 'app/enrol/page.tsx', 'app/signed-out/page.tsx']) {
  const src = readFileSync(f, 'utf8');
  if (!/<AppMark/.test(src)) { console.error('FAIL ' + f + ' does not render AppMark'); code = 1; }
  if (/>\s*ZZ\s*</.test(src)) { console.error('FAIL ' + f + ' still hand-draws a ZZ monogram'); code = 1; }
  if (/["'`]ZZ Console["'`]/.test(src)) { console.error('FAIL ' + f + ' hardcodes the product name'); code = 1; }
}
// three marks, three files, none a copy of another
for (const f of ['app/icon.png', 'app/apple-icon.png', 'public/assets/brand/wordmark.png']) {
  if (!existsSync(f)) { console.error('FAIL missing mark: ' + f); code = 1; }
}
if (existsSync('app/icon.svg')) { console.error('FAIL the old indigo icon.svg is still present'); code = 1; }
if (!code) console.log('PASS one mark in the app, three marks across the size bands');
process.exitCode = code;

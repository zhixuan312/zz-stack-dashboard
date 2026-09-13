// The defect this closes: the console had TWO marks — a hexagon in the rail and a
// hand-drawn ZZ on every auth screen — and a docstring claiming otherwise.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
let code = 0;
const mark = readFileSync('src/components/AppMark.tsx', 'utf8');
/* The SRC ATTRIBUTE, not the word. `/wordmark/` matched this component's own docstring,
 * so AppMark could stop rendering the mark entirely and still pass. */
if (!/src=["']\/assets\/brand\/wordmark\.png["']/.test(mark)) {
  console.error('FAIL AppMark does not render the wordmark raster'); code = 1;
}
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

/* THE CHECK USED TO ASSERT "not the OLD second mark" AND CALL THAT "one mark".
 *
 * It named the hexagon and the hand-drawn ZZ monogram — the two that existed — and so it
 * caught history rather than the rule. A mutation test put a fresh `<svg><polygon>` logo in
 * the rail beside AppMark and this file still printed PASS. A check that only recognises the
 * defect it was written for is a regression test wearing an invariant's name.
 *
 * What the rule actually is: the brand is drawn in ONE place. Two things follow, and both
 * are enumerable rather than clever. A brand raster is referenced only by AppMark. And an
 * inline `<svg>` literal — the way you draw a mark by hand — appears in exactly two files,
 * neither of them a logo: the rail's Sparkle (one piece of ornament, by decision) and
 * TrendChart (a chart is SVG; that is not a mark). Anything else is a second mark, whatever
 * shape it takes, and the allowlist is what makes the next one fail instead of the last one.
 */
const MARK_FILE = 'src/components/AppMark.tsx';
/* A COUNT, not a membership test. A file-level allowlist let a second hand-drawn mark be
 * added to Sidebar.tsx — already allowlisted for its one Sparkle — and still pass. The
 * numbers are the ones that exist: the rail's single Sparkle, and TrendChart's two (a chart
 * is SVG; that is not a mark). Raising one is a decision somebody makes on purpose. */
const SVG_ALLOWED = new Map([
  ['src/components/Sidebar.tsx', 1],
  ['src/components/charts/TrendChart.tsx', 2],
]);
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const q = d + '/' + e.name;
    if (e.isDirectory()) walk(q, out);
    else if (q.endsWith('.tsx')) out.push(q);
  }
  return out;
};
for (const f of [...walk('app'), ...walk('src')]) {
  const src = readFileSync(f, 'utf8');
  if (/assets\/brand\/(wordmark|favicon)/.test(src) && f !== MARK_FILE) {
    console.error('FAIL ' + f + ' renders a brand mark directly; AppMark is the only place'); code = 1;
  }
  const svgs = (src.match(/<svg/g) || []).length;
  const allowed = SVG_ALLOWED.get(f) ?? 0;
  if (svgs > allowed) {
    console.error(`FAIL ${f} has ${svgs} inline <svg> literals, allowed ${allowed}. If it is a mark,`
      + ' use AppMark; if it genuinely is not, raise the count in SVG_ALLOWED and say why.'); code = 1;
  }
}
if (!code) console.log('PASS one mark in the app, three marks across the size bands');
process.exitCode = code;

// COUPLED: design-metrics.ts keeps its own inline copy of lum()/ratio(), because Puppeteer
// serialises measureInPage into the browser and a serialised function cannot close over an
// import. This asserts the two copies still agree.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ratio } from '../scripts/lib/contrast.ts';
const src = readFileSync('scripts/design-metrics.ts', 'utf8');
/* The slice is design-metrics' own TypeScript source, and `new Function` is a JavaScript
 * parser that does not strip types — an annotated copy reaches it as a SyntaxError on a
 * colon. Stripping with the same function Node uses to run these files makes this compare the
 * exact text Node executes. */
const body = stripTypeScriptTypes(
  src.slice(src.indexOf('const lum ='), src.indexOf('const over =')),
);
const theirs = new Function(`
  ${body}
  const hex = (h) => { const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }; };
  return (a, b) => ratio(hex(a), hex(b));
`)();
const SAMPLE = [['#14161a','#f7f8fa'],['#4a5bd0','#ffffff'],['#221b26','#f8efea'],
                ['#7548d8','#f8efea'],['#ffffff','#7548d8'],['#a98cf5','#f8efea']];
let code = 0;
for (const [a, b] of SAMPLE) {
  const mine = ratio(a, b), them = theirs(a, b);
  if (Math.abs(mine - them) > 1e-9) {
    console.error(`FAIL ${a} on ${b}: shared=${mine.toFixed(4)} design-metrics=${them.toFixed(4)}`);
    code = 1;
  }
}
if (!code) console.log('PASS both contrast implementations agree on all ' + SAMPLE.length + ' samples');
process.exitCode = code;

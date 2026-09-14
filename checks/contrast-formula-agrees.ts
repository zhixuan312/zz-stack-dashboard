// design-metrics.ts keeps its own inline copy of lum()/ratio() because Puppeteer serialises
// measureInPage into the browser and a serialised function cannot close over an import.
// Two copies of one formula drift. This asserts they do not.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ratio } from '../scripts/lib/contrast.ts';
const src = readFileSync('scripts/design-metrics.ts', 'utf8');
/* The slice is design-metrics' own SOURCE, and that source is TypeScript. `new Function`
 * is a JavaScript parser and nothing else — it does not strip types, so an annotated copy
 * reaches it as a SyntaxError on a colon. Stripping it with the same function Node itself
 * uses to run these files is not a workaround: it makes this check compare the exact text
 * Node executes, which is what "the two copies agree" is supposed to mean. */
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

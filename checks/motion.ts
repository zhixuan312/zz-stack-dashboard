/* The motion vocabulary stays in one file, stays reversible, and never moves the shell.
 *
 * Motion is the easiest discipline to lose one call site at a time: a keyframe written next to
 * the component that wanted it, a transition with no reduced-motion story, a transform on a
 * wrapper above the fixed shell that makes the whole frame drift with page scroll. Each of those
 * renders without an error, so each is asserted here.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let code = 0;
const fail = (m: string): void => { console.error('FAIL ' + m); code = 1; };

const MOTION = 'app/motion.css';
if (!existsSync(MOTION)) fail(`${MOTION} is missing`);
const motion = existsSync(MOTION) ? readFileSync(MOTION, 'utf8') : '';
const globals = readFileSync('app/globals.css', 'utf8');

/* 1. It is actually loaded. A motion file nothing imports is a vocabulary nobody speaks. */
if (!/@import\s+["']\.\/motion\.css["']/.test(globals)) fail('app/globals.css does not import ./motion.css');

/* 2. Every keyframe lives in motion.css — in a stylesheet or inline in a component alike. */
const walk = (d: string, out: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(p)) out.push(p);
  }
  return out;
};
for (const f of [...walk('app'), ...walk('src')]) {
  if (f === MOTION) continue;
  if (/@keyframes\s/.test(readFileSync(f, 'utf8'))) fail(`${f} declares a @keyframes; motion lives in ${MOTION}`);
}

/* 3. The reduced-motion contract: durations AND delays collapse. Collapsing only the duration
 *    leaves a staggered row waiting at its invisible first frame for its delay. */
const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(motion);
if (!reduced) fail(`${MOTION} has no prefers-reduced-motion: reduce block`);
else {
  for (const p of ['animation-duration', 'animation-delay', 'transition-duration']) {
    if (!reduced[1].includes(p)) fail(`the reduced-motion block no longer collapses ${p}`);
  }
}

/* 4. The one animation CSS cannot express asks the same question. */
const ticker = readFileSync('src/components/ui/ticker.tsx', 'utf8');
if (!/prefers-reduced-motion:\s*reduce/.test(ticker)) fail('Ticker no longer checks prefers-reduced-motion');

/* 5. Nothing transforms the frame. A transform, filter or will-change on html or body turns the
 *    shell's `position: fixed` ancestor-relative, and the whole console scrolls with the page. */
for (const [file, css] of [['app/globals.css', globals], [MOTION, motion]] as const) {
  for (const m of css.matchAll(/(^|\})\s*([^{}]+)\{([^}]*)\}/g)) {
    const selectors = m[2].split(',').map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim());
    if (!selectors.some((s) => /^(html|body)$/.test(s))) continue;
    if (/\b(transform|filter|will-change|animation)\s*:/.test(m[3])) {
      fail(`${file}: a rule on ${selectors.join(', ')} sets transform/filter/will-change/animation`);
    }
  }
}

if (!code) console.log('PASS motion in one file, reduced motion collapses it, the shell never moves');
process.exitCode = code;

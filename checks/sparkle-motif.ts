import { readFileSync } from 'node:fs';
let code = 0;
const rail = readFileSync('src/components/Sidebar.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
if (/sparkle[^\n]*\.(png|svg)/i.test(rail)) {
  console.error('FAIL the sparkle is loaded as a file; it must be inline so it renders before assets do');
  code = 1;
}
if (!/function Sparkle\(/.test(rail)) { console.error('FAIL no inline Sparkle component'); code = 1; }
/* DELIBERATE: scoped to the Sparkle function's own body rather than matched near it in the
 * file. Sidebar.tsx carries `<Icon ... aria-hidden />` on every nav row, so a proximity match
 * is satisfied by an unrelated icon even when the sparkle's own <svg> has lost aria-hidden.
 * Cut the Sparkle function out first, then assert inside it. */
const sparkle = rail.match(/function Sparkle\([\s\S]*?\n\}/);
if (!sparkle) { console.error('FAIL cannot isolate the Sparkle component body'); code = 1; }
else if (!/<svg[^>]*aria-hidden/.test(sparkle[0])) {
  console.error('FAIL the sparkle <svg> itself is not aria-hidden; it is decorative'); code = 1;
}
if (!/\{active \? <Sparkle \/> : null\}/.test(rail)) {
  console.error('FAIL the sparkle does not mark the active nav item'); code = 1;
}
if (!/--ring/.test(css)) { console.error('FAIL the focus ring token was removed'); code = 1; }
if (!/\.focus-ring:focus-visible[\s\S]{0,240}var\(--ring\)/.test(css)) {
  console.error('FAIL the focus ring no longer applies --ring'); code = 1;
}
if (!code) console.log('PASS sparkle inline on the active item, focus ring intact');
process.exitCode = code;

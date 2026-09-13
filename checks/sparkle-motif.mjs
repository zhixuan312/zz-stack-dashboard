import { readFileSync } from 'node:fs';
let code = 0;
const rail = readFileSync('src/components/Sidebar.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
if (/sparkle[^\n]*\.(png|svg)/i.test(rail)) {
  console.error('FAIL the sparkle is loaded as a file; it must be inline so it renders before assets do');
  code = 1;
}
if (!/function Sparkle\(/.test(rail)) { console.error('FAIL no inline Sparkle component'); code = 1; }
if (!/<svg[\s\S]{0,200}aria-hidden|aria-hidden[\s\S]{0,200}<svg/.test(rail)) {
  console.error('FAIL the sparkle is not aria-hidden; it is decorative'); code = 1;
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

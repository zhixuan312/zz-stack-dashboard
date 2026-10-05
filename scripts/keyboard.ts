/**
 * The whole keyboard path of every page: Tab from the top until focus comes back round, and check each stop.
 *
 *   node scripts/keyboard.ts [--base http://localhost:3100] [--routes /,/teams]
 *
 * Fails (exit 1) when the first stop inside the shell is not "Skip to content", when a stop shows no focus ring (an outline, or a
 * ring drawn as a box shadow, on the control or the frame around it), when a focused control is hidden under
 * something else such as the sticky top bar (WCAG 2.4.11), or when a visible control is never reached at all.
 * The audit (scripts/audit.ts) checks the first eighteen stops of every page at every width; this walks all of them.
 */
import { launch } from './lib/chrome.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...discover().filter((r) => r !== '/this-page-does-not-exist'), ...config.detailRoutes];

/** Tag every visible control the keyboard should reach; return how many. */
const TAG = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[aria-hidden="true"],[inert],.sr-only'); };
  const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => vis(el) && el.tabIndex >= 0);
  all.forEach((el, i) => el.setAttribute('data-kb', i));
  return all.length;
})()`;

/** The focused element: its tag, whether it shows a ring, and whether it is on top where it sits. */
const STOP = `(() => {
  const el = document.activeElement; if (!el || el === document.body) return null;
  el.setAttribute('data-kb-hit', '');
  const ringed = (n) => { if (!n) return false; const c = getComputedStyle(n); return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (/rgb|oklch|oklab|color/.test(c.boxShadow) && c.boxShadow !== 'none'); };
  const ring = ringed(el) || ringed(el.parentElement) || ringed(el.parentElement && el.parentElement.parentElement);
  // The first line box, not the whole rectangle: a link that wraps has its centre over the text beside it.
  const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
  const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
  const hit = document.elementFromPoint(x, y);
  const onTop = !!hit && (hit === el || el.contains(hit) || hit.contains(el) || !!hit.closest('[data-radix-popper-content-wrapper]'));
  const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40);
  return { kb: el.getAttribute('data-kb'), name, ring, onTop, covered: onTop ? '' : (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').slice(0, 2).join('.') : 'nothing') };
})()`;

const page = await launch();
let failures = 0;
for (const route of ROUTES) {
  await page.open(base + route, { width: 1440, height: 900, theme: 'dark', wait: 2500 });
  const total = await page.eval<number>(TAG);
  const reached = new Set<string>();
  const problems: string[] = [];
  let first = '';
  for (let i = 0; i < 400; i++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    // The stop is judged once its geometry has SETTLED, not at a fixed two frames. The focus styles
    // (the skip link sliding in) paint after the key event rather than with it, so some wait is
    // owed — but on a loaded runner the paint lands later than two frames, and an element read
    // before its style arrives is at its unfocused position: the skip link is 64px above the
    // viewport until `focus-visible` moves it down, and `elementFromPoint` clamped to y=0 there
    // returns the rail's brand row. That is a reachable, on-top skip link reported as
    // `hidden under div.flex.h-16`. Measured: this walk is 0 issues on a laptop and reported that
    // one issue on CI at the same commit, twice passing and once failing on the runner.
    //
    // Waiting for the rect to hold across three frames cannot hide a real failure: a stop that is
    // genuinely covered stays covered no matter how long the wait.
    await page.eval(`(() => new Promise((resolve) => {
      let last = '', same = 0, frames = 0;
      const step = () => {
        const el = document.activeElement;
        const r = el && el !== document.body ? (el.getClientRects()[0] ?? el.getBoundingClientRect()) : null;
        const now = r ? [r.left, r.top, r.width, r.height].join() : '';
        same = now === last ? same + 1 : 0;
        last = now;
        if (same >= 2 || ++frames > 12) resolve(true); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }))()`);
    const s = await page.eval<{ kb: string | null; name: string; ring: boolean; onTop: boolean; covered: string } | null>(STOP);
    if (!s) continue;
    if (i === 0 || (!first && s)) first = first || s.name;
    if (s.kb !== null && reached.has(s.kb)) break;
    if (s.kb !== null) reached.add(s.kb);
    if (!s.ring) problems.push(`no focus ring: ${s.name}`);
    if (!s.onTop) problems.push(`hidden under ${s.covered}: ${s.name}`);
  }
  // A control counts as reached when it, or a control inside it, took focus: a radio group is entered at its checked
  // radio and moved through with the arrow keys, as ARIA's radio pattern asks.
  const missed = await page.eval<string[]>(`(() => [...document.querySelectorAll('[data-kb]')].filter((el) => !el.matches('[data-kb-hit]') && !el.querySelector('[data-kb-hit]')).map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40)))()`);
  // Bypass blocks (WCAG 2.4.1) is owed where blocks repeat: inside the shell, with its rail. A standalone screen has none.
  const shell = await page.eval<boolean>(`!!document.querySelector('a[href="#content"]')`);
  if (shell && !/skip to content/i.test(first)) problems.push(`first stop is "${first}", not Skip to content`);
  for (const m of missed) problems.push(`never reached: ${m}`);
  const unique = [...new Set(problems)];
  if (unique.length) { failures += unique.length; console.log(`FAIL ${route} (${reached.size} of ${total} stops)\n  ${unique.slice(0, 12).join('\n  ')}`); }
  else console.log(`ok   ${route} (${reached.size} stops, every one ringed and on top)`);
}
page.close();
console.log(`\nkeyboard: ${failures} issues across ${ROUTES.length} routes`);
process.exit(failures ? 1 : 0);

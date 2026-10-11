/**
 * Screenshot routes of the running app at exact widths, in either theme.
 *
 *   node scripts/shot.ts <path ...> [--width 1440,390] [--theme light,dark] [--full] [--base http://localhost:3100] [--out out/shots]
 *                                   [--press "<name>" ...]
 *                                   [--point "<chart label>" --at 0.6]
 *
 * Motion is reduced, so every page shows its final state. Files land in out/shots/<route>-<width>-<theme>.png.
 *
 * `--press` opens what only a press shows (a dialog, a sheet, a menu, a popover) before the shot: the control whose
 * accessible name or text is `<name>` is pressed with the mouse, as a person presses it, and repeated `--press` flags
 * press in order (a row's menu, then an item in it). The file name ends with the last name pressed. A name that matches
 * nothing fails, so a shot never shows the closed page under the open state's name.
 * `--point` captures a chart's readout, using the mouse at desktop widths and a held touch on phones. `--at` is a
 * fraction of the chart's width (0 to 1). A missing readout or one outside the chart fails the capture.
 */
import path from 'node:path';
import { launch, type Page } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? (args.splice(i, 1), true) : false; };
const presses: string[] = [];
for (let i = args.indexOf('--press'); i >= 0; i = args.indexOf('--press')) presses.push(args.splice(i, 2)[1]);
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const widths = opt('--width', '1440').split(',').map(Number);
const themes = opt('--theme', 'light').split(',') as ('light' | 'dark')[];
const out = opt('--out', 'out/shots');
const full = flag('--full');
const point = opt('--point', '');
const at = Number(opt('--at', '0.6'));
if (!Number.isFinite(at) || at < 0 || at > 1) throw new Error('--at must be a number from 0 to 1');
const routes = args.length ? args : ['/'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Press the visible control named `name` with the mouse, once it has stopped moving; false when nothing matches. */
async function press(page: Page, name: string): Promise<boolean> {
  const where = `(() => {
    const want = ${JSON.stringify(name)};
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ');
    const all = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="combobox"], summary')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const el = all.find((x) => named(x) === want) ?? all.find((x) => named(x).startsWith(want));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`;
  let at = await page.eval<{ x: number; y: number } | null>(where);
  for (let i = 0; i < 20 && at; i++) {
    await sleep(100);
    const next = await page.eval<{ x: number; y: number } | null>(where);
    if (next && next.x === at.x && next.y === at.y) break;
    at = next;
  }
  if (!at) return false;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'] as const) await page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await sleep(500);
  return true;
}

const page = await launch();
let failed = false;
try {
  for (const r of routes) {
    for (const w of widths) {
      for (const t of themes) {
        await page.open(base + r, { width: w, height: w < 600 ? 844 : 900, theme: t });
        const missing = [];
        for (const p of presses) if (!(await press(page, p))) { missing.push(p); break; }
        if (missing.length) { console.log(`FAIL ${r} at ${w}px ${t}: nothing to press named "${missing[0]}"`); failed = true; continue; }
        if (point) {
          const location = await page.eval<{ x: number; y: number } | null>(`(() => {
            const el = [...document.querySelectorAll('svg[role="img"][tabindex="0"]')].find((el) => el.getAttribute('aria-label')?.startsWith(${JSON.stringify(point)}));
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width * ${at}, y: r.top + r.height / 2 };
          })()`);
          if (!location) { console.log(`FAIL ${r}: no chart named "${point}"`); failed = true; continue; }
          if (w < 600) await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [location] });
          else await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...location });
          await sleep(500);
          const readout = await page.eval<{ fits: boolean; detail: string }>(`(() => {
            const el = [...document.querySelectorAll('svg[role="img"][tabindex="0"]')].find((el) => el.getAttribute('aria-label')?.startsWith(${JSON.stringify(point)}));
            const tip = el?.parentElement?.querySelector('div[aria-hidden]');
            const r = tip?.getBoundingClientRect();
            const chart = el?.getBoundingClientRect();
            const fits = !!r && !!chart && getComputedStyle(tip).opacity > 0.05 && r.left >= Math.max(0, chart.left) - 1 && r.right <= Math.min(innerWidth, chart.right) + 1;
            return { fits, detail: JSON.stringify({ viewport: innerWidth, chart: chart && { left: chart.left, right: chart.right }, readout: r && { left: r.left, right: r.right } }) };
          })()`);
          if (!readout.fits) { console.log(`FAIL ${r} at ${w}px ${t}: readout missing or outside its chart: ${readout.detail}`); failed = true; }
        }
        const name = (r.replace(/^\//, '').replace(/[/?=&#]+/g, '-') || 'overview') + (presses.length ? `-${slug(presses.at(-1)!)}` : '') + (point ? `-${slug(point)}-point-${at}` : '') + `-${w}-${t}.png`;
        const h = await page.shot(path.join(out, name), { full });
        console.log(`${path.join(out, name)} ${w}x${h}`);
        if (point && w < 600) await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
    }
  }
} finally {
  page.close();
}
process.exitCode = failed ? 1 : 0;

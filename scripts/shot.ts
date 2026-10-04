/**
 * Screenshot routes of the running app at exact widths, in either theme.
 *
 *   node scripts/shot.ts <path ...> [--width 1440,390] [--theme light,dark] [--full] [--base http://localhost:3100] [--out out/shots]
 *
 * Motion is reduced, so every page shows its final state. Files land in out/shots/<route>-<width>-<theme>.png.
 */
import path from 'node:path';
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? (args.splice(i, 1), true) : false; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const widths = opt('--width', '1440').split(',').map(Number);
const themes = opt('--theme', 'light').split(',') as ('light' | 'dark')[];
const out = opt('--out', 'out/shots');
const full = flag('--full');
const routes = args.length ? args : ['/'];

const page = await launch();
for (const r of routes) {
  for (const w of widths) {
    for (const t of themes) {
      await page.open(base + r, { width: w, height: w < 600 ? 844 : 900, theme: t });
      const name = (r.replace(/^\//, '').replace(/[/?=&#]+/g, '-') || 'overview') + `-${w}-${t}.png`;
      const h = await page.shot(path.join(out, name), { full });
      console.log(`${path.join(out, name)} ${w}x${h}`);
    }
  }
}
page.close();

/**
 * Load a route and print every error the page logged, with its text.
 *
 *   node scripts/hydration-probe.ts <path ...> [--base http://localhost:3100] [--width 1024] [--theme light]
 *
 * Why this exists: `next start` serves a production build, where a hydration mismatch arrives as minified React error
 * #418 whose two differing strings are opaque args — enough to know something disagreed, not enough to know what.
 * `next dev` renders the same page with the same server/client split and reports the mismatch UNMINIFIED, with the
 * component stack. So a #418 is diagnosed against `next dev` and then confirmed against the build.
 *
 * Read-only: it navigates, waits, prints, and presses nothing. `Page.errors` is the harness's own collector for
 * uncaught exceptions and console errors since the last `open()`.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const base = opt('--base', 'http://localhost:3100');
const width = Number(opt('--width', '1024'));
const theme = opt('--theme', 'light') as 'light' | 'dark';
const rate = Number(opt('--throttle', '1'));
const routes = args.length ? args : ['/'];

const page = await launch();
try {
  for (const route of routes) {
    if (rate > 1) await page.send('Emulation.setCPUThrottlingRate', { rate });
    await page.open(`${base}${route}`, { width, theme, wait: 4000 });
    console.log(`\n===== ${route} @${width}px ${theme} =====`);
    console.log(page.errors.length ? page.errors.join('\n') : '(no error logged)');
  }
} finally {
  page.close();
}

/**
 * No page disagrees with its own server HTML, however slowly it hydrates. One of verify's `browserChecks`.
 *
 *   node scripts/hydration-check.ts [--base http://localhost:3100] [--rate 20] [--loads 2]
 *
 * React hydrates a page a `<Suspense>` boundary at a time, and the shell's boundaries come first. They read `/me`, so
 * a boundary that hydrates later can find the answer already in the cache; a component that draws it on that first
 * render draws something the server never sent, and React throws #418 and renders the boundary again from nothing.
 * Whether that happens is a race between the network and the main thread, which is why it was seen once in a run on
 * the CI runner, on `/settings`, and never on a laptop: the audit catches the exception when it occurs and cannot make
 * it occur.
 *
 * This makes it occur. It loads each route with the main thread slowed (20 times by default), so every read the page
 * shares with the shell has answered long before the page's own boundary hydrates, and fails on any hydration error.
 * Run against the console before `useHydrated` existed (`src/lib/api.ts`), it reported `/settings` on 4 loads in 6 at
 * 20 times and on none at 6 times or unthrottled; after it, none in 10.
 *
 * What it does NOT prove: that a page is right once hydrated, or that a mismatch React recovers from silently (text
 * that differs inside `suppressHydrationWarning`) is absent. It reads the errors React reports.
 *
 * Fails (exit 1) on a load that reports a hydration error, naming the route and the error.
 */
import { launch } from './lib/chrome.ts';
import { railRoutes } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const rate = Number(opt('--rate', '20'));
const loads = Number(opt('--loads', '2'));

/** Every rail route, and one detail route of each shape: a second document page hydrates exactly as the first does. */
const shape = (route: string) => { const [path, query] = route.split('?'); return `${path.split('/').slice(0, 2).join('/')}/${path.split('/').length}${query ? '?' : ''}`; };
const details = [...new Map(config.detailRoutes.map((r) => [shape(r), r])).values()];
const routes = [...(await railRoutes()).routes, ...details];

/** React's own codes for a tree that did not match, and its unminified wording for the same. */
const HYDRATION = /#41[89]|#42[0-5]|hydrat/i;

const page = await launch();
const problems: string[] = [];
try {
  for (const route of routes) {
    let failed = 0;
    let first = '';
    for (let i = 0; i < loads; i++) {
      await page.send('Emulation.setCPUThrottlingRate', { rate });
      // Long enough for a slowed main thread to finish hydrating every boundary, which is when the error is thrown.
      await page.open(`${base}${route}`, { width: 1440, theme: 'dark', wait: 400 + rate * 250 });
      const errors = page.errors.filter((e) => HYDRATION.test(e));
      if (errors.length) { failed++; first ||= errors[0].split('\n')[0].slice(0, 140); }
    }
    console.log(`${failed ? 'FAIL' : 'ok  '} ${route}${failed ? `: ${failed} of ${loads} loads · ${first}` : ''}`);
    if (failed) problems.push(route);
  }
} finally {
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
  page.close();
}

console.log(`\nhydration: ${problems.length} of ${routes.length} routes disagreed with their server HTML, main thread slowed ${rate} times, ${loads} loads each`);
process.exit(problems.length ? 1 : 0);

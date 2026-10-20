/**
 * Every rail route and every detail route drawn in a browser in the `slow` state, as each person, held to the five
 * seconds an explicit state has: one of verify's `timedChecks` (Task I-142; spec AC-2.9), which `pnpm verify --timed`
 * runs alone and one at a time, after the live data and before Web Vitals.
 *
 *   node scripts/states-timed.ts [--base http://localhost:3100] [--as superadmin,member] [--routes /,/record]
 *
 * The routes and the people are scripts/states-check.ts's, read with the same options: every rail route the navigation
 * checks in scripts/verify.config.ts name and every address under its `detailRoutes`, for each persona it declares. So
 * is the observer installed before each page's own scripts, which records the first frame with an explicit state on
 * screen: the route's content, a refusal or an error. `slow` is asked for per request by the session value
 * `<person>+slow` (reconciliation 79): the fake gateway holds every page read past the bound each read is given
 * (`SLOW_MS`, scripts/fake-gateway/states-partial.ts) and spares `/me`, so the explicit state is a refusal, drawn
 * before anything is read, or the page's own word that the platform did not answer in time. Each page is opened at 1440px in the dark theme, from a blank page, one at
 * a time in one browser, so no page this check opens loads the one it is timing.
 *
 * A row passes when its explicit state is on screen within five seconds of navigation start; it fails naming the route,
 * the person and the time, or that none arrived in the `SETTLE_MS` (eighteen seconds) a page is given. What each state
 * draws, and that `slow` shows loading at once, are states-check's, which `--full` runs beside the other suites: this
 * judges the time alone.
 *
 * One line per route and person, then the failures. Exits 1 when any failed or nothing was opened.
 */
import type { Page } from './lib/chrome.ts';
import config from './verify.config.ts';
import { observe, people, SETTLE_MS, targets, undeclared, type Frames, type Target } from './states-check.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The time an explicit state has to be on screen in under `slow`, from navigation start (spec AC-2.9). */
export const BOUND_MS = 5_000;

/** One `slow` row held to the bound, by the first frame its observer recorded with an explicit state. */
export function boundRule(f: Pick<Frames, 'explicit'>): { problems: string[]; said: string } {
  if (f.explicit === null) return { problems: [`no explicit state within the ${SETTLE_MS / 1000} s a page is given, past the ${BOUND_MS} ms bound`], said: '' };
  if (f.explicit > BOUND_MS) return { problems: [`explicit state at ${Math.round(f.explicit)} ms, past the ${BOUND_MS} ms bound`], said: '' };
  return { problems: [], said: `explicit state at ${Math.round(f.explicit)} ms, within ${BOUND_MS} ms` };
}

/** One page as one session value, read as soon as its explicit state is on screen, or once its window has passed. */
async function visit(page: Page, t: Target, value: string): Promise<Frames> {
  await page.send('Page.navigate', { url: 'about:blank' });
  const { identifier } = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: observe(t) })).result;
  try {
    await page.open(base + t.path, { width: 1440, height: 900, theme: 'dark', wait: 0, cookie: { name: 'zz_console', value } });
    for (;;) {
      const f = await page.eval<Frames & { now: number }>('({ ...window.__states, now: performance.now() })');
      if (f.explicit !== null || f.now >= SETTLE_MS) return f;
      await sleep(100);
    }
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
}

if (import.meta.main) {
  console.log(`states timed: ${targets.length} routes as ${people.map(([p]) => p).join(', ')} in slow, one at a time; an explicit state within ${BOUND_MS} ms of navigation`);
  const failures: string[] = undeclared.length ? [`no content selector declared for ${undeclared.join(', ')}`] : [];
  let rows = 0;
  // Imported here, so a test of the rule above loads no browser and none of its process handlers.
  const { launch } = await import('./lib/chrome.ts');
  const page = await launch();
  try {
    for (const [who] of people) {
      const value = `${config.personas![who].cookie.value}+slow`;
      for (const t of targets) {
        rows++;
        let r: { problems: string[]; said: string };
        try { r = boundRule(await visit(page, t, value)); } catch (e) { r = { problems: [(e as Error).message], said: '' }; }
        for (const p of r.problems) failures.push(`${t.path} as ${who} in slow: ${p}`);
        console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${who.padEnd(10)} ${t.path.padEnd(64)} ${r.problems.length ? r.problems.join('; ') : r.said}`);
      }
    }
  } finally {
    page.close();
  }
  for (const f of failures) console.log(`FAIL  ${f}`);
  console.log(`\nstates timed: ${rows} route and person rows in slow; ${failures.length} failed`);
  process.exit(failures.length || !rows ? 1 : 0);
}

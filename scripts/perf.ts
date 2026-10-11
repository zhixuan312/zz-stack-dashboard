/**
 * The navigation protocol, twenty times over: every rail route, on a desktop and through the real phone drawer, warm, cold
 * and right after a live refresh, with the nearest-rank p95 of each metric held to the budget.
 *
 *   node scripts/perf.ts --base http://127.0.0.1:3000 [--config scripts/verify.config.ts] [--rail /,/a,/b]
 *
 * It is the journey of scripts/navigate.ts (the press time and the frame clock are the page's own) taken `--samples` times,
 * 20 by default, with no retake: every sample counts, and what is reported is the p95 of the lot, never the best of them.
 * - warm: the destination's prefetch and the chunks it brought in finished first, as a visitor who waited would have. A
 *   journey starts from the rail route before its destination (the one after it for the first), so the order a person
 *   browses in is the one measured.
 * - cold: a fresh browser (no cache, no storage, no router state) for every sample, and the page refuses every prefetch of
 *   the destination before it leaves the page. The sample is void, and fails, if the browser's own record shows a request
 *   for the destination made before the press. Other routes are still prefetched and awaited, as in the warm sample, so
 *   the two differ in the destination alone.
 * - after-live: the tab triggers its live provider's resync (an `online` event) and waits until `refreshCollections`
 *   answered `{ ok: true }` and the router read that followed has finished, then presses at once. Nothing is written, so
 *   there is nothing to reset. The starting page is a rail route that registers live data.
 * A sample that never gets ready, shows a wrong result or leaves a dead control fails its combination outright.
 *
 * One line per route, device and condition, and a JSON summary on the last line:
 *
 *   ok|warn|FAIL <route> <device> <condition> shell <median>/<p95>/<max> ms · data … · interactive …[ · drawer <median> ms][ · <reasons>]
 *   perf: {...}
 *
 * A p95 over its budget is a `warn`, a report and never a failure: the protocol is statistical evidence, run weekly, not
 * a release gate. A sample that never got ready or whose control did nothing is a FAIL. Exit non-zero on a FAIL, on a
 * missing mapping (named before anything is sampled) and on a missing Chrome: this is an explicit mode, so a lack of
 * Chrome is never a pass. `--samples` and `--routes` narrow a run for working on the protocol;
 * a narrowed run reports `warn`, never `ok`. The mappings and budgets come from scripts/verify.config.ts.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { budgetsOf } from './lib/budgets.ts';
import { launch, type Page } from './lib/chrome.ts';
import { resolveCoverage } from './lib/coverage.ts';
import { railRoutes } from './lib/routes.ts';
import { summary } from './lib/timing.ts';
import { BUDGET_KEY, DEVICES, Fail, drawerRoutes, journey, liveRefresh, METRICS, prepare, startFor, type Condition, type Device, type Metric, type NavConfig } from './navigate.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const PROTOCOL_SAMPLES = 20;
/** How long a rail route has to answer a live resync before it is called not live. */
const PROBE_WAIT = 4000;
const CONDITIONS: Condition[] = ['warm', 'cold', 'afterLive'];
const started = Date.now();

type Stats = { median: number; p95: number; max: number };
type Result = {
  route: string;
  device: Device;
  condition: Condition;
  status: 'ok' | 'warn' | 'FAIL';
  samples: number;
  shell: Stats | null;
  data: Stats | null;
  interactive: Stats | null;
  drawerMedianMs?: number;
  refused?: number;
  problems: string[];
};

const stats = (xs: number[]): Stats | null => (xs.length ? summary(xs) : null);
const cell = (s: Stats | null): string => (s ? `${Math.round(s.median)}/${Math.round(s.p95)}/${Math.round(s.max)} ms` : 'failed');
const text = (r: Result): string =>
  `${r.status.padEnd(7)} ${r.route} ${r.device} ${r.condition} shell ${cell(r.shell)} · data ${cell(r.data)} · interactive ${cell(r.interactive)}`
  + (r.drawerMedianMs !== undefined ? ` · drawer ${Math.round(r.drawerMedianMs)} ms` : '')
  + (r.problems.length ? ` · ${r.problems.join('; ')}` : '');

const out = (o: Record<string, unknown>) => console.log(`perf: ${JSON.stringify(o)}`);

/** Chrome itself did not start, as opposed to a page or the app failing once it had. */
class ChromeStartError extends Error {}

async function openTab(refuse?: string): Promise<Page> {
  let page: Page;
  try { page = await launch(); } catch (e) { throw new ChromeStartError((e as Error).message); }
  try {
    await prepare(page, refuse);
  } catch (e) {
    page.close();
    throw e;
  }
  return page;
}

/**
 * Every rail route that answers a live resync with a verified refresh, so an after-live journey can start from one, and every
 * route whose phone page has the console's drawer, so any journey can.
 */
async function startRoutes(routes: string[]): Promise<{ live: string[]; starts: string[] }> {
  const page = await openTab();
  const live: string[] = [];
  let starts: string[] = [];
  try {
    starts = await drawerRoutes(page, base, routes);
    for (const route of routes) {
      await page.send('Network.clearBrowserCache');
      await page.open(base + route, { width: 1440, theme: 'dark', wait: 200 });
      try {
        await liveRefresh(page, PROBE_WAIT);
        live.push(route);
      } catch (e) {
        if (!(e instanceof Fail)) throw e;
      }
    }
  } finally {
    page.close();
  }
  return { live, starts };
}

async function main(): Promise<number> {
  const samples = Number(opt('--samples') ?? PROTOCOL_SAMPLES);
  if (!Number.isInteger(samples) || samples < 2) { console.error('--samples must be a whole number of at least 2'); return 1; }

  const config = ((await import(pathToFileURL(path.resolve(ROOT, opt('--config') ?? 'scripts/verify.config.ts')).href)) as { default?: NavConfig }).default ?? {};
  const budgets = budgetsOf(config);
  const checks = Array.isArray(config.navigationChecks) ? config.navigationChecks : [];

  let rail: { routes: string[]; landing: string };
  try {
    const named = opt('--rail')?.split(',').filter(Boolean);
    rail = named ? { routes: named, landing: named.includes('/') ? '/' : named[0] } : await railRoutes();
  } catch (e) {
    const reason = (e as Error).message;
    console.log(`FAIL    perf: ${reason}`);
    out({ status: 'FAIL', errors: [reason] });
    return 1;
  }

  // The protocol covers the whole rail; a missing or broken mapping is named before a browser starts.
  const coverage = resolveCoverage('perf', rail.routes, checks, rail.routes);
  if (coverage.errors.length) {
    for (const e of coverage.errors) console.log(`FAIL    ${e}`);
    out({ status: 'FAIL', errors: coverage.errors });
    return 1;
  }
  const narrowed = opt('--routes')?.split(',').filter(Boolean);
  const unknown = (narrowed ?? []).filter((r) => !rail.routes.includes(r));
  if (unknown.length) {
    const errors = unknown.map((r) => `${r}: not one of the rail routes (${rail.routes.join(', ')})`);
    errors.forEach((e) => console.log(`FAIL    ${e}`));
    out({ status: 'FAIL', errors });
    return 1;
  }
  const routes = narrowed ?? rail.routes;
  const partial = narrowed !== undefined || samples !== PROTOCOL_SAMPLES;

  let live: string[];
  let starts: string[];
  const results: Result[] = [];
  const shared: Partial<Record<Device, Page>> = {};
  try {
    try {
      ({ live, starts } = await startRoutes(rail.routes));
    } catch (e) {
      const first = (e as Error).message.split('\n')[0];
      const reason = e instanceof ChromeStartError ? `Chrome could not start (${first})` : `the rail's routes could not be probed (${first})`;
      console.log(`FAIL    perf: ${reason}`);
      out({ status: 'FAIL', errors: [reason] });
      return 1;
    }

    /** The tab the warm and after-live samples of a device share: the cache and router state are reset by every journey. */
    const tab = async (device: Device) => (shared[device] ??= await openTab());

    for (const device of DEVICES) {
      for (const condition of CONDITIONS) {
        const limits = Object.fromEntries(METRICS.map((m) => [m, budgets.navigation[condition][BUDGET_KEY[m]][device]])) as Record<Metric, number>;
        for (const route of routes) {
          const check = checks.find((c) => c.path === route);
          const start = startFor(rail.routes, route, condition === 'afterLive' ? live.filter((r) => starts.includes(r)) : starts);
          console.error(`… ${condition} ${device} ${route}`);
          const series: Record<Metric, number[]> = { shell: [], data: [], interactive: [] };
          const drawer: number[] = [];
          const problems: string[] = [];
          let refused = 0;
          let taken = 0;
          if (start === undefined) problems.push(condition === 'afterLive' ? 'no other rail route registers live data to start from' : 'the rail has no other route to start from');
          for (let i = 0; i < samples && !problems.length; i++) {
            let page: Page | null = null;
            try {
              page = condition === 'cold' ? await openTab(route) : await tab(device);
              const sample = await journey(page, device, start!, route, check, { origin: base, condition });
              taken++;
              refused += sample.refused ?? 0;
              if (sample.drawerMs !== undefined) drawer.push(sample.drawerMs);
              for (const name of METRICS) {
                const m = sample[name];
                if (m && 'fail' in m) problems.push(`sample ${i + 1} ${name} ${m.fail.kind}: ${m.fail.message}`);
                else if (m) series[name].push(m.ms);
              }
            } catch (e) {
              // The tab may be in any state after an error that is not a verdict: start the shared one again.
              if (!(e instanceof Fail) && condition !== 'cold') { shared[device]?.close(); delete shared[device]; }
              problems.push(`sample ${i + 1} ${e instanceof Fail ? `${e.kind}: ${e.message}` : (e as Error).message}`);
            } finally {
              if (condition === 'cold') page?.close();
            }
          }
          const broken = problems.length > 0;
          if (!broken) {
            for (const name of METRICS) {
              const s = stats(series[name]);
              if (s && s.p95 > limits[name]) problems.push(`${name} p95 ${Math.round(s.p95)} ms over its ${limits[name]} ms budget`);
            }
          }
          const result: Result = {
            route, device, condition, status: broken ? 'FAIL' : problems.length ? 'warn' : 'ok', samples: taken,
            shell: stats(series.shell), data: stats(series.data), interactive: stats(series.interactive),
            drawerMedianMs: drawer.length ? summary(drawer).median : undefined,
            refused: condition === 'cold' ? refused : undefined,
            problems,
          };
          results.push(result);
          console.log(text(result));
        }
      }
    }
  } finally {
    for (const page of Object.values(shared)) page?.close();
  }

  const failed = results.some((r) => r.status === 'FAIL');
  const took = (Date.now() - started) / 1000;
  const over = results.filter((r) => r.status === 'warn').length;
  const status = failed ? 'FAIL' : partial || over ? 'warn' : 'ok';
  if (partial) console.log(`warn    a narrowed run (${samples} samples, ${routes.length} of ${rail.routes.length} routes) is not the protocol`);
  console.log(`${failed ? 'FAIL   ' : over ? 'warn   ' : 'ok     '} perf ${results.length} combinations · ${results.filter((r) => r.status === 'FAIL').length} failed · ${over} over a p95 budget (reported) · ${took.toFixed(0)} s`);
  out({ status, samples, routes, live, took, partial, results });
  return failed ? 1 : 0;
}

process.exit(await main());

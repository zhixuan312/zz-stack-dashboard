/**
 * The navigation protocol, twenty times over: every rail route, on a desktop and through the real phone drawer, warm, cold
 * and right after a live refresh, with the nearest-rank p95 of each metric held to the budget.
 *
 *   node scripts/perf.ts --base http://127.0.0.1:3000 [--config scripts/verify.config.ts] [--rail /,/a,/b] [--homes /b=Name]
 *                        [--routes /a,/b] [--samples <n>] [--rate <n>]
 *
 * It is the journey of scripts/navigate.ts (the press time and the frame clock are the page's own) taken `--samples` times,
 * 20 by default, with no retake: every sample counts, and what is reported is the p95 of the lot, never the best of them.
 * - warm: the destination's prefetch and the chunks it brought in finished first, as a visitor who waited would have. A
 *   journey starts from the rail route before its destination (the one after it for the first) whose rail links to it, so
 *   the order a person browses in is the one measured. A workspace's home that no other route's rail links to is reached
 *   through the workspace menu, as scripts/navigate.ts reaches it (`journeyStart` in scripts/lib/journey.ts); any other destination no rail links
 *   to is a problem.
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
 * A p95 over its budget is a `warn`, a report and never a failure: the protocol is statistical evidence. A sample that
 * never got ready or whose control did nothing is a FAIL. Exit non-zero on a FAIL, on a missing mapping (named before
 * anything is sampled) and on a missing Chrome: this diagnostic reports, and a lack of Chrome is never a pass.
 * `--samples` and `--routes` narrow a run; a narrowed run reports `warn`, never `ok`. The test commands run it through
 * scripts/browser.ts --depth perf, only where `CI` is true: the weekly job calls `pnpm test:t2` on a fresh clone, and the
 * protocol measures a quiet runner. The mappings and budgets come from scripts/verify.config.ts.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { budgetsOf, limitsFor } from './lib/budgets.ts';
import { launch, type Page } from './lib/chrome.ts';
import { declaredNotRun, resolveCoverage, unconfiguredRoutes } from './lib/coverage.ts';
import { recordPart } from './lib/tier2.ts';
import { railRoutes } from './lib/routes.ts';
import { summary } from './lib/timing.ts';
import { DEVICES, Fail, drawerRoutes, journey, journeyStart, liveRefresh, METRICS, prepare, type Condition, type Device, type Metric, type NavConfig, workspaceHomes } from './lib/journey.ts';
import { holdArgs } from './lib/args.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
holdArgs('perf', args, ['--base', '--config', '--homes', '--rail', '--rate', '--routes', '--samples']);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const PROTOCOL_SAMPLES = 20;
/** How long a rail route has to start a live resync, while it is sent online events, before it is called not live. */
const PROBE_WAIT = 8000;
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
async function startRoutes(routes: string[]): Promise<{ live: string[]; starts: string[]; drawn: Record<string, string[]>; redirected?: string }> {
  const page = await openTab();
  const live: string[] = [];
  let starts: string[] = [];
  let drawn: Record<string, string[]> = {};
  let redirected: string | undefined;
  try {
    ({ starts, drawn, redirected } = await drawerRoutes(page, base, routes));
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
  return { live, starts, drawn, ...(redirected !== undefined ? { redirected } : {}) };
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
  // A workspace's home that no rail links to is reached through the workspace menu, as navigate reaches it.
  let homes: Map<string, string>;
  try {
    homes = await workspaceHomes(args);
  } catch (e) {
    console.log(`FAIL    perf: ${(e as Error).message}`);
    out({ status: 'FAIL', errors: [(e as Error).message] });
    return 1;
  }

  // The protocol covers the whole rail; a missing or broken mapping is named before a browser starts. A route the
  // project has configured no navigation check for has nothing for the protocol to sample: that is declared
  // configuration, reported not run with the reason and never a pass — the suite exits 2, so it does not hold the marker.
  const coverage = resolveCoverage('perf', rail.routes, checks, rail.routes);
  const unconfigured = unconfiguredRoutes(rail.routes, checks);
  const errors = coverage.errors.filter((e) => !declaredNotRun(`${e.split(',')[0]}`));
  if (errors.length) {
    for (const e of errors) console.log(`FAIL    ${e}`);
    out({ status: 'FAIL', errors });
    return 1;
  }
  const unrun = unconfigured.map((r) => `${r}: no navigation check is configured`);
  for (const l of unrun) console.log(`not run ${l}`);
  const narrowed = opt('--routes')?.split(',').filter(Boolean);
  const unknown = (narrowed ?? []).filter((r) => !rail.routes.includes(r));
  if (unknown.length) {
    const errors = unknown.map((r) => `${r}: not one of the rail routes (${rail.routes.join(', ')})`);
    errors.forEach((e) => console.log(`FAIL    ${e}`));
    out({ status: 'FAIL', errors });
    return 1;
  }
  const routes = (narrowed ?? rail.routes).filter((r) => !unconfigured.includes(r));
  const partial = narrowed !== undefined || samples !== PROTOCOL_SAMPLES;
  if (!routes.length) {
    console.log('not run perf: no rail route in this run has a navigation check configured');
    out({ status: 'not-run', routes, notRun: unrun });
    return 2;
  }

  const perfValues: { check: string; page: string; unit: 'ms'; value: number; samples: number[] }[] = [];
  let live: string[];
  let starts: string[];
  let drawn: Record<string, string[]>;
  const results: Result[] = [];
  const shared: Partial<Record<Device, Page>> = {};
  try {
    try {
      let redirected: string | undefined;
      ({ live, starts, drawn, redirected } = await startRoutes(rail.routes));
      if (redirected !== undefined) {
        const reason = `every rail route redirected to ${redirected}: is sign-in on for this build?`;
        console.log(`FAIL    perf: ${reason}`);
        out({ status: 'FAIL', errors: [reason] });
        return 1;
      }
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
        for (const route of routes) {
          const check = checks.find((c) => c.path === route);
          const limits = limitsFor(budgets, condition, device, check);
          const way = journeyStart(rail.routes, route, condition === 'afterLive' ? live.filter((r) => starts.includes(r)) : starts, drawn, [...homes.keys()]);
          const start = way?.from;
          const menu = way?.via === 'menu' ? homes.get(route) : undefined;
          console.error(`… ${condition} ${device} ${route}`);
          const series: Record<Metric, number[]> = { shell: [], data: [], interactive: [] };
          const drawer: number[] = [];
          const problems: string[] = [];
          /** A p95 past its budget: reported with its numbers, never a failure (Tier 2). */
          const overBudget: string[] = [];
          let refused = 0;
          let taken = 0;
          if (start === undefined) problems.push(condition === 'afterLive' ? 'no other rail route registers live data to start from' : 'the rail has no other route to start from');
          for (let i = 0; i < samples && !problems.length; i++) {
            let page: Page | null = null;
            try {
              page = condition === 'cold' ? await openTab(route) : await tab(device);
              const sample = await journey(page, device, start!, route, check, { origin: base, condition, menu });
              taken++;
              refused += sample.refused ?? 0;
              if (sample.drawerMs !== undefined) drawer.push(sample.drawerMs);
              for (const name of METRICS) {
                const m = sample[name];
                if (m && 'fail' in m) problems.push(`sample ${i + 1} ${name} ${m.fail.kind}: ${m.fail.message}`);
                else if (m && 'ms' in m) series[name].push(m.ms);
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
              if (s && s.p95 > limits[name]) overBudget.push(`${name} p95 ${Math.round(s.p95)} ms over its ${limits[name]} ms budget`);
            }
          }
          for (const name of METRICS) {
            const s = stats(series[name]);
            if (s) perfValues.push({ check: `perf.${name}`, page: `${route} ${device} ${condition}`, unit: 'ms', value: Math.round(s.p95), samples: series[name] });
          }
          const result: Result = {
            route, device, condition, status: broken ? 'FAIL' : overBudget.length ? 'warn' : 'ok', samples: taken,
            shell: stats(series.shell), data: stats(series.data), interactive: stats(series.interactive),
            drawerMedianMs: drawer.length ? summary(drawer).median : undefined,
            refused: condition === 'cold' ? refused : undefined,
            problems: [...problems, ...overBudget],
          };
          results.push(result);
          console.log(text(result));
        }
      }
    }
  } finally {
    for (const page of Object.values(shared)) page?.close();
  }
  recordPart(ROOT, 'perf', perfValues);

  const failed = results.some((r) => r.status === 'FAIL');
  const took = (Date.now() - started) / 1000;
  const over = results.filter((r) => r.status === 'warn').length;
  const status = failed ? 'FAIL' : partial || over || unrun.length ? 'warn' : 'ok';
  if (partial) console.log(`warn    a narrowed run (${samples} samples, ${routes.length} of ${rail.routes.length} routes) is not the protocol`);
  console.log(`${failed ? 'FAIL   ' : over ? 'warn   ' : 'ok     '} perf ${results.length} combinations · ${results.filter((r) => r.status === 'FAIL').length} failed · ${over} over a p95 budget (reported) · ${took.toFixed(0)} s`);
  out({ status, samples, routes, live, took, partial, results, notRun: unrun });
  return failed ? 1 : unrun.length ? 2 : 0;
}

process.exit(await main());

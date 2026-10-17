/**
 * Navigation readiness against the built app: for each route, how long until the shell is there, until the data is, and
 * until a control works, on a desktop and through the real phone drawer.
 *
 *   node scripts/navigate.ts --base http://127.0.0.1:3000 [--routes /,/requests,/settings] [--mode default|full] [--samples 1]
 *
 * Each journey starts from the rail route before the destination (the one after it for the first) whose rail draws a link to
 * it, because a rail may show only the part of the navigation its page belongs to. A workspace's home that no other route's
 * rail links to (the only destination of its workspace) is reached as a person reaches it: from the nearest rail route
 * before it, through the workspace menu's item named for its workspace (`journeyStart`). Any other destination no rail links
 * to is a problem, never a pass. It waits for what a visitor would wait for (the destination's router prefetch and every chunk
 * it brought in, once its link is shown; the drawer on a phone), presses the destination in the rail and times three things from that press:
 * the shell (the path and the heading), the data (the mapping's `readySelector` and `readyText`, never a skeleton's rows) and the interaction (its
 * `probe` on `controlSelector`, observed on `resultSelector`). Times are the page's own clock, from the press event to the first
 * frame that shows the condition, never round trips over the debugging protocol. The phone is 390 wide, 4x CPU throttled, 150 ms and 1.6 Mbps,
 * and the drawer-open-to-navigation time is reported apart.
 *
 * A timing over its budget is retaken twice and gated on the median of three (scripts/lib/timing.ts). A wrong result, a
 * page that never gets ready and a control that does nothing are failures and are never retaken. A route with no mapping
 * is measured for its shell only; its data and interaction are `not-configured`, never passed. A mapping's selectors resolve inside
 * open shadow roots (scripts/lib/deep.ts); when the control's selector matches several elements the first visible one is pressed and
 * `note: <selector> matches <n> elements; the first visible one was used` is printed once, never a failure. Nothing here writes:
 * probes only open, sort, filter, toggle or follow.
 *
 * A menu item navigates without a link; the console's menu prefetches the pages it offers as it opens. A warm journey through
 * the menu waits for those prefetches, as one through a link waits for the link's, is timed from the item's press, and says
 * on its line how many prefetches of the destination the page made before the press (`not prefetched` when it made none).
 * A menu that offers no item for the workspace is `never-ready`, naming it.
 *
 * One line per route and device, one per device for the prefetch bytes, and a JSON summary on the last line, whose lines say
 * `via: 'rail'` or `via: 'menu'`:
 *
 *   ok|FAIL|warn|not run <route> <device> shell <ms> · data <ms|not-configured> · interactive <ms|not-configured>[ · noisy][ · through the workspace menu (<workspace>) · not prefetched|prefetched <n> time(s) before the press][ · <reasons>]
 *   navigate: {...}
 *
 * scripts/perf.ts drives the same journey 20 times per route, device and condition (warm, cold and after a live refresh).
 *
 * The exit code is non-zero on a FAIL and on a configuration error. Missing Chrome makes every line `not run`: exit 0 in
 * the default mode, non-zero in `full`. The mappings and budgets come from scripts/verify.config.ts, which `--config` can
 * replace and `--rail` can name the rail routes for (the readiness fixtures, which have no src/app.config.ts). Each
 * workspace's home and name come from `workspaces` in src/app.config.ts (its `homeHref` and `label`); beside `--rail`, a
 * fixture names them with `--homes <home>=<workspace>,...`, and with `--rail` and no `--homes` no route is a home.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { budgetsOf, type NavigationCheck } from './lib/budgets.ts';
import { launch, type Page } from './lib/chrome.ts';
import { resolveCoverage, selectSmokeRoutes } from './lib/coverage.ts';
import { railRoutes } from './lib/routes.ts';
import { BUDGET_KEY, DEVICES, Fail, METRICS, PREFETCH_WAIT, drawerRoutes, journey, journeyStart, openStart, prepare, sleep, type Device, type Measured, type Metric, type NavConfig } from './lib/journey.ts';
import { isPrefetch, prefetchProblems } from './lib/sizes.ts';
import { judge } from './lib/timing.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const mode = (opt('--mode') ?? 'default') as 'default' | 'full';
const KIB = 1024;


// ---- the retake rule, per route and device ----

type Verdict = 'pass' | 'fail' | 'not-configured' | 'not-run';
type Reported = { ms: number | null; limit?: number; verdict: Verdict; reason?: string };
type Line = {
  route: string;
  device: Device;
  status: 'ok' | 'warn' | 'FAIL' | 'not run';
  shell: Reported;
  data: Reported;
  interactive: Reported;
  drawerMs?: number;
  prefetchCapped: boolean;
  noisy: boolean;
  problems: string[];
  /** What the journey pressed to leave its start: the rail's link, or the workspace menu's item for `workspace`. */
  via: 'rail' | 'menu';
  workspace?: string;
  /** Through the menu: how many prefetches of the destination the starting page had made before the press. */
  prefetched?: number;
};

const value = (m: Measured | null): number | null => (m && 'ms' in m ? m.ms : null);

/** Where a measured journey starts, and the workspace whose menu item it presses when it goes through the menu. */
type From = { from: string; menu?: string };

async function measure(page: Page, device: Device, start: From, route: string, check: NavigationCheck | undefined, limits: Record<Metric, number>): Promise<Line> {
  const line: Line = { route, device, status: 'ok', shell: { ms: null, verdict: 'pass' }, data: { ms: null, verdict: 'not-configured' }, interactive: { ms: null, verdict: 'not-configured' }, noisy: false, prefetchCapped: false, problems: [], ...viaOf(start) };
  const fill = (name: Metric, m: Measured | null) => {
    if (m === null) return;
    if ('fail' in m) {
      line[name] = { ms: null, limit: limits[name], verdict: 'fail', reason: `${m.fail.kind}: ${m.fail.message}` };
      line.problems.push(`${name} ${m.fail.kind}: ${m.fail.message}`);
    } else line[name] = { ms: m.ms, limit: limits[name], verdict: 'pass' };
  };
  const run = { origin: base, condition: 'warm' as const, menu: start.menu };
  const first = await journey(page, device, start.from, route, check, run);
  line.drawerMs = first.drawerMs;
  line.prefetchCapped = first.prefetchCapped;
  line.prefetched = first.prefetched;
  for (const name of METRICS) fill(name, first[name]);
  // A wrong result, a never-ready page or a dead control is the answer: no retake can replace it.
  if (line.problems.length) return finish(line);
  const over = METRICS.filter((name) => { const v = value(first[name]); return v !== null && judge([v], limits[name]).verdict === 'retake'; });
  if (over.length) {
    const retakes = [await journey(page, device, start.from, route, check, run), await journey(page, device, start.from, route, check, run)];
    const all = [first, ...retakes];
    for (const retake of retakes) for (const name of METRICS) {
      const m = retake[name];
      if (m && 'fail' in m) line.problems.push(`${name} ${m.fail.kind} on a retake: ${m.fail.message}`);
    }
    if (line.problems.length) { for (const name of METRICS) fill(name, retakes.map((r) => r[name]).find((m) => m && 'fail' in m) ?? first[name]); return finish(line); }
    for (const name of METRICS) {
      const samples = all.map((s) => value(s[name])).filter((v): v is number => v !== null);
      if (samples.length !== 3) continue;
      const j = judge(samples, limits[name]);
      line[name] = { ms: j.median, limit: limits[name], verdict: j.verdict === 'pass' ? 'pass' : 'fail', reason: j.verdict === 'pass' ? undefined : `median of ${samples.join(', ')} ms over ${limits[name]} ms` };
      if (j.verdict !== 'pass') line.problems.push(`${name} ${j.median} ms over its ${limits[name]} ms budget (samples ${samples.join(', ')})`);
      line.noisy ||= j.noisy;
    }
  }
  return finish(line);
}

const viaOf = (start: From | undefined): Pick<Line, 'via' | 'workspace'> => (start?.menu === undefined ? { via: 'rail' } : { via: 'menu', workspace: start.menu });

function finish(line: Line): Line {
  line.status = line.problems.length ? 'FAIL' : line.noisy || line.data.verdict === 'not-configured' || line.interactive.verdict === 'not-configured' ? 'warn' : 'ok';
  return line;
}

const cell = (r: Reported): string => (r.verdict === 'not-configured' ? 'not-configured' : r.verdict === 'not-run' ? 'not run' : r.ms === null ? 'failed' : `${Math.round(r.ms)} ms`);
const text = (l: Line): string =>
  `${l.status.padEnd(7)} ${l.route} ${l.device} shell ${cell(l.shell)} · data ${cell(l.data)} · interactive ${cell(l.interactive)}`
  + (l.noisy ? ' · noisy' : '')
  + (l.prefetchCapped ? ` · prefetch not idle after ${PREFETCH_WAIT / 1000} s` : '')
  + (l.drawerMs !== undefined ? ` · drawer ${l.drawerMs} ms` : '')
  + (l.via === 'menu' ? ` · through the workspace menu (${l.workspace})` : '')
  + (l.prefetched === undefined ? '' : l.prefetched === 0 ? ' · not prefetched' : ` · prefetched ${l.prefetched} time(s) before the press`)
  + (l.problems.length ? ` · ${l.problems.join('; ')}` : '');

// ---- prefetch ----

/** The compressed bytes of every router prefetch the landing route makes by the time it is idle. */
async function prefetchKiB(page: Page, device: Device, landing: string): Promise<number> {
  await openStart(page, device, landing, base);
  // Idle: two looks, 700 ms apart, that find the same prefetches and all of them answered.
  for (let i = 0, last = -1; i < 10; i++) {
    const now = await page.eval<{ n: number; done: boolean }>(`({ n: window.__nav.prefetches.length, done: window.__nav.prefetches.every((p) => p.done) })`);
    if (now.n === last && now.done) break;
    last = now.n;
    await sleep(700);
  }
  const seen = await page.eval<{ headers: Record<string, string>; url: string }[]>(`window.__nav.prefetches`);
  const urls = JSON.stringify(seen.filter((p) => isPrefetch({ headers: p.headers })).map((p) => p.url));
  return page.eval<number>(`(() => { const urls = new Set(${urls}); return performance.getEntriesByType('resource').filter((e) => urls.has(e.name)).reduce((n, e) => n + e.transferSize, 0); })()`);
}

// ---- main ----

const summary = (o: Record<string, unknown>) => console.log(`navigate: ${JSON.stringify(o)}`);

/**
 * Each workspace's home, with the name of the workspace menu's item that opens it: `--homes <home>=<workspace>,...` beside
 * `--rail`; none for `--rail` alone; otherwise `homeHref` and `label` of each of `workspaces` in src/app.config.ts, of
 * which a project without workspaces has none. Throws on an entry of `--homes` that does not name both.
 */
export async function workspaceHomes(): Promise<Map<string, string>> {
  const listed = opt('--homes');
  if (listed !== undefined) {
    return new Map(listed.split(',').filter(Boolean).map((entry) => {
      const at = entry.indexOf('=');
      if (at <= 0 || at === entry.length - 1) throw new Error(`--homes: ${entry} is not <home>=<workspace>`);
      return [entry.slice(0, at), entry.slice(at + 1)];
    }));
  }
  if (opt('--rail') !== undefined) return new Map();
  type Workspaces = Record<string, { homeHref?: unknown; label?: unknown }>;
  const { workspaces } = (await import(pathToFileURL(path.join(ROOT, 'src/app.config.ts')).href)) as { workspaces?: Workspaces };
  return new Map(Object.values(workspaces ?? {}).flatMap((w) => (typeof w?.homeHref === 'string' && typeof w.label === 'string' ? [[w.homeHref, w.label] as const] : [])));
}

async function main(): Promise<number> {
  if (mode !== 'default' && mode !== 'full') { console.error(`--mode must be default or full, got ${mode}`); return 1; }
  if ((opt('--samples') ?? '1') !== '1') { console.error('--samples: one sample and two retakes is the only protocol here; scripts/perf.ts takes the 20-sample one'); return 1; }

  const config = ((await import(pathToFileURL(path.resolve(ROOT, opt('--config') ?? 'scripts/verify.config.ts')).href)) as { default?: NavConfig }).default ?? {};
  const budgets = budgetsOf(config);
  const checks = Array.isArray(config.navigationChecks) ? config.navigationChecks : [];

  let rail: { routes: string[]; landing: string };
  try {
    const named = opt('--rail')?.split(',').filter(Boolean);
    rail = named ? { routes: named, landing: named.includes('/') ? '/' : named[0] } : await railRoutes();
  } catch (e) {
    const reason = (e as Error).message;
    // The default smoke cannot choose its routes without a rail; the deeper modes treat that as an error.
    console.log(`${mode === 'full' ? 'FAIL   ' : 'not run'} navigate: ${reason}`);
    summary({ mode, status: mode === 'full' ? 'FAIL' : 'not-run', reason });
    return mode === 'full' ? 1 : 0;
  }

  let homes: Map<string, string>;
  try {
    homes = await workspaceHomes();
  } catch (e) {
    console.log(`FAIL    navigate: ${(e as Error).message}`);
    summary({ mode, status: 'FAIL', errors: [(e as Error).message] });
    return 1;
  }

  const requested = opt('--routes')?.split(',').filter(Boolean);
  let routes: string[];
  try {
    routes = requested ?? (mode === 'full' ? rail.routes : selectSmokeRoutes({ smokeRoutes: config.smokeRoutes, nav: rail.routes, landing: rail.landing }));
  } catch (e) {
    console.log(`FAIL    navigate: ${(e as Error).message}`);
    summary({ mode, status: 'FAIL', errors: [(e as Error).message] });
    return 1;
  }

  // Everything that can be wrong with the routes and mappings is wrong before Chrome starts.
  const outside = routes.filter((r) => !rail.routes.includes(r));
  if (outside.length) {
    const errors = outside.map((r) => `${r}: not one of the rail routes (${rail.routes.join(', ')})`);
    errors.forEach((e) => console.log(`FAIL    ${e}`));
    summary({ mode, status: 'FAIL', routes, errors });
    return 1;
  }
  const coverage = resolveCoverage(mode, routes, checks, rail.routes);
  for (const w of coverage.warnings) console.log(`warn    ${w}`);
  if (coverage.errors.length) {
    for (const e of coverage.errors) console.log(`FAIL    ${e}`);
    summary({ mode, status: 'FAIL', routes, errors: coverage.errors });
    return 1;
  }

  let page: Page;
  try {
    // A missing Chrome binary is an error event on the child process, which nothing here can listen to: take it as the answer.
    let missing: (e: Error) => void = () => {};
    const gone = new Promise<never>((_, reject) => { missing = reject; });
    const onError = (e: Error) => missing(e);
    process.once('uncaughtException', onError);
    try { page = await Promise.race([launch(), gone]); } finally { process.off('uncaughtException', onError); }
  } catch (e) {
    const reason = `Chrome could not start (${(e as Error).message.split('\n')[0]})`;
    const lines = routes.flatMap((route) => DEVICES.map((device) => `not run ${route} ${device} shell not run · data not run · interactive not run · ${reason}`));
    lines.forEach((l) => console.log(l));
    for (const device of DEVICES) console.log(`not run prefetch ${device} · ${reason}`);
    summary({ mode, status: 'not-run', routes, reason });
    return mode === 'full' ? 1 : 0;
  }

  const lines: Line[] = [];
  let prefetch: { desktopKiB: number; phoneClosedKiB: number } | undefined;
  let problems: string[] = [];
  try {
    await prepare(page);
    const { starts, drawn } = await drawerRoutes(page, base, rail.routes);
    for (const route of routes) {
      const check = checks.find((c) => c.path === route);
      // Each journey comes from the nearest rail route whose rail links to the destination, so it is a navigation and not the
      // page already shown; a workspace's only destination, from the nearest route of another workspace, through the menu.
      const way = journeyStart(rail.routes, route, starts, drawn, [...homes.keys()]);
      const start: From | undefined = way && { from: way.from, menu: way.via === 'menu' ? homes.get(route) : undefined };
      for (const device of DEVICES) {
        const limits = Object.fromEntries(METRICS.map((m) => {
          // A route's own figure, where the config gives one, stands in for the shared one on that metric and device.
          const shared = budgets.navigation.warm[BUDGET_KEY[m]][device];
          return [m, check?.budget?.[BUDGET_KEY[m]]?.[device] ?? shared];
        })) as Record<Metric, number>;
        let line: Line;
        try {
          // A route with no other route to start from has no navigation to time: it is a problem, never a 0 ms pass.
          if (start === undefined) throw new Fail('never-ready', 'the rail has no other route to start from');
          line = await measure(page, device, start, route, check, limits);
        } catch (e) {
          // The starting page never loading is a failure of this route and device, not of the run.
          const reason = e instanceof Fail ? `${e.kind}: ${e.message}` : (e as Error).message;
          line = finish({ route, device, status: 'FAIL', shell: { ms: null, verdict: 'fail', reason }, data: { ms: null, verdict: 'not-run' }, interactive: { ms: null, verdict: 'not-run' }, noisy: false, prefetchCapped: false, problems: [reason], ...viaOf(start) });
        }
        if (!check) {
          line.data = { ms: null, verdict: 'not-configured' };
          line.interactive = { ms: null, verdict: 'not-configured' };
          finish(line);
        }
        lines.push(line);
        console.log(text(line));
      }
    }
    const bytes = { desktop: await prefetchKiB(page, 'desktop', rail.landing), phoneClosed: await prefetchKiB(page, 'phone', rail.landing) };
    prefetch = { desktopKiB: bytes.desktop / KIB, phoneClosedKiB: bytes.phoneClosed / KIB };
    problems = prefetchProblems({ desktopBytes: bytes.desktop, phoneClosedBytes: bytes.phoneClosed }, budgets.prefetchKb);
    const lineFor = (device: string, kib: number, cap: number) => `${kib > cap ? 'FAIL   ' : 'ok     '} prefetch ${device} ${kib.toFixed(1)} KiB compressed · cap ${cap} KiB`;
    console.log(lineFor('desktop', prefetch.desktopKiB, budgets.prefetchKb.desktop));
    console.log(lineFor('phone-closed', prefetch.phoneClosedKiB, budgets.prefetchKb.phoneClosed));
    for (const p of problems) console.log(`FAIL    ${p}`);
  } finally {
    page.close();
  }

  const failed = lines.some((l) => l.status === 'FAIL') || problems.length > 0;
  const status = failed ? 'FAIL' : lines.some((l) => l.status === 'warn') ? 'warn' : 'ok';
  summary({
    mode,
    status,
    routes,
    warnings: coverage.warnings,
    lines: lines.map(({ route, device, status: s, shell, data, interactive, drawerMs, prefetchCapped, noisy, problems: p, via, workspace, prefetched }) => ({ route, device, status: s, via, workspace, prefetched, shell, data, interactive, drawerMs, prefetchCapped, noisy, problems: p })),
    prefetch: prefetch && { ...prefetch, problems },
  });
  return failed ? 1 : 0;
}

// perf.ts imports the journey and must not run this main.
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());

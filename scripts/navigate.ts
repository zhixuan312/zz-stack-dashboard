/**
 * Navigation readiness against the built app: for each route, how long until the shell is there, until the data is, and
 * until a control works, on a desktop and through the real phone drawer.
 *
 *   node scripts/navigate.ts --base http://127.0.0.1:3000 [--routes /,/requests,/settings] [--mode default|full] [--samples 1] [--timing on|off]
 *                            [--config scripts/verify.config.ts] [--rail /,/a,/b] [--homes /b=Name] [--rate <n>]
 *
 * Each journey starts from the rail route before the destination (the one after it for the first) whose rail draws a link to
 * it, because a rail may show only the part of the navigation its page belongs to. A workspace's home that no other route's
 * rail links to (the only destination of its workspace) is reached as a person reaches it: from the nearest rail route
 * before it, through the workspace menu's item named for its workspace (`journeyStart`). Any other destination no rail links
 * to is a problem, never a pass. It waits for what a visitor would wait for (the destination's router prefetch and every chunk
 * it brought in, once its link is shown; the drawer on a phone), presses the destination in the rail and times three things from that press:
 * the shell (the path and the heading), the data (the mapping's `readySelector` and `readyText`, never a skeleton's rows) and the interaction (its
 * `probe` on `controlSelector`, observed on `resultSelector`). Times are the page's own clock, from the press event to the first
 * frame that shows the condition, never round trips over the debugging protocol. The phone is 390 wide, CPU slowed to the device of benchmark index 800 (scripts/lib/phone.ts), 150 ms and 1.6 Mbps,
 * and the drawer-open-to-navigation time is reported apart.
 *
 * `--timing on` (the default) judges the clock as well: a timing over its budget is retaken twice and gated on the median
 * of three (scripts/lib/timing.ts). A wrong result, a page that never gets ready and a control that does nothing are
 * failures and are never retaken. `--timing off` judges only those, a journey with no start and the prefetch caps: every
 * time is still measured and printed, none is compared with its limit and none is retaken. Any other value is refused
 * before the config is read or Chrome starts. A route with no mapping is measured for its shell only; its data and interaction are `not-configured`, never passed. A mapping's selectors resolve inside
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
 *   ok|FAIL|warn|not run <route> <device> shell <ms> · data <ms|not-configured> · interactive <ms|not-configured>[ · noisy][ · through the workspace menu (<workspace>) · not prefetched|prefetched <n> time(s) before the press][ · <metric> <ms> leaves <n>% of its <limit> ms budget][ · <reasons>]
 *   headroom: the least was <n>%, <route> <device> <metric> <ms> of <limit> ms; under 20% warns
 *   navigate: {...}
 *
 * With `--timing on`, a time that passes leaving less than a fifth of its budget makes its line `warn` (scripts/lib/timing.ts
 * `HEADROOM`): a pass by a hair here is a red on a slower machine, and the weekly runner is one.
 *
 *
 * The exit code is non-zero on a FAIL and on a configuration error. Missing Chrome makes every line `not run`: exit 0 in
 * the default mode, non-zero in `full` mode. The mappings and budgets come from scripts/verify.config.ts, which `--config` can
 * replace and `--rail` can name the rail routes for (the readiness fixtures, which have no src/app.config.ts). Each
 * workspace's home and name come from `workspaces` in src/app.config.ts (its `homeHref` and `label`); beside `--rail`, a
 * fixture names them with `--homes <home>=<workspace>,...`, and with `--rail` and no `--homes` no route is a home.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { budgetsOf, limitsFor, type NavigationCheck } from './lib/budgets.ts';
import { launch, type Page } from './lib/chrome.ts';
import { prefetchJudged, resolveCoverage, selectSmokeRoutes } from './lib/coverage.ts';
import { railRoutes } from './lib/routes.ts';
import { DEVICES, Fail, METRICS, PREFETCH_WAIT, drawerRoutes, journey, journeyStart, loadShell, openStart, prepare, sleep, workspaceHomes, type Device, type Measured, type Metric, type NavConfig } from './lib/journey.ts';
import { isPrefetch, prefetchProblems } from './lib/sizes.ts';
import { headroom, judge, thin } from './lib/timing.ts';
import { holdArgs } from './lib/args.ts';
import { recordPart } from './lib/tier2.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const mode = (opt('--mode') ?? 'default') as 'default' | 'full';
const timing = opt('--timing') ?? 'on';
const KIB = 1024;


// ---- the retake rule, per route and device ----

type Verdict = 'pass' | 'fail' | 'not-configured' | 'not-run';
type Reported = { ms: number | null; limit?: number; verdict: Verdict; reason?: string; samples?: number[] };
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
  /** A time past its budget: reported, never a failure (Tier 2, docs/testing.md). */
  overBudget: string[];
  /** What the journey pressed to leave its start: the rail's link, or the workspace menu's item for `workspace`. */
  via: 'rail' | 'menu';
  workspace?: string;
  /** Through the menu: how many prefetches of the destination the starting page had made before the press. */
  prefetched?: number;
  /** Where the press arrived, when it was under the route rather than at it. */
  landed?: string;
  /** The data was the page's first-run state, not `readySelector`. */
  empty?: boolean;
  /** The judged times that passed leaving less than a fifth of their budget (scripts/lib/timing.ts `thin`). */
  thin?: string[];
};

const value = (m: Measured | null): number | null => (m && 'ms' in m ? m.ms : null);

/** Where a measured journey starts, and the workspace whose menu item it presses when it goes through the menu. */
type From = { from: string; menu?: string };

async function measure(page: Page, device: Device, start: From, route: string, check: NavigationCheck | undefined, limits: Record<Metric, number>): Promise<Line> {
  const line: Line = { route, device, status: 'ok', shell: { ms: null, verdict: 'pass' }, data: { ms: null, verdict: 'not-configured' }, interactive: { ms: null, verdict: 'not-configured' }, noisy: false, prefetchCapped: false, problems: [], overBudget: [], ...viaOf(start) };
  const fill = (name: Metric, m: Measured | null) => {
    if (m === null) return;
    if ('fail' in m) {
      line[name] = { ms: null, limit: limits[name], verdict: 'fail', reason: `${m.fail.kind}: ${m.fail.message}` };
      line.problems.push(`${name} ${m.fail.kind}: ${m.fail.message}`);
    } else if ('absent' in m) line[name] = { ms: null, verdict: 'not-configured', reason: m.absent };
    else line[name] = { ms: m.ms, limit: limits[name], verdict: 'pass' };
  };
  const run = { origin: base, condition: 'warm' as const, menu: start.menu };
  const first = await journey(page, device, start.from, route, check, run);
  line.drawerMs = first.drawerMs;
  line.prefetchCapped = first.prefetchCapped;
  line.prefetched = first.prefetched;
  line.landed = first.landed;
  line.empty = first.empty;
  for (const name of METRICS) fill(name, first[name]);
  // A wrong result, a never-ready page or a dead control is the answer: no retake can replace it.
  if (line.problems.length || timing === 'off') return finish(line);
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
      line[name] = { ms: j.median, limit: limits[name], verdict: 'pass', samples, reason: j.verdict === 'pass' ? undefined : `median of ${samples.join(', ')} ms over ${limits[name]} ms` };
      if (j.verdict !== 'pass') line.overBudget.push(`${name} ${j.median} ms over its ${limits[name]} ms budget (samples ${samples.join(', ')})`);
      line.noisy ||= j.noisy;
    }
  }
  return finish(line);
}

const viaOf = (start: From | undefined): Pick<Line, 'via' | 'workspace'> => (start?.menu === undefined ? { via: 'rail' } : { via: 'menu', workspace: start.menu });

/**
 * A route with no navigation check: there is no journey to time, and none is invented. Its shell is still judged, by
 * loading the route itself on each device; its data readiness and its interaction need a configured check, and are
 * reported not-configured with that reason — never as passes, and the run says so at its end.
 */
async function shellOnly(page: Page, device: Device, route: string): Promise<Line> {
  const reason = 'no navigation check is configured';
  const line: Line = { route, device, status: 'warn', shell: { ms: null, verdict: 'not-run' }, data: { ms: null, verdict: 'not-configured', reason }, interactive: { ms: null, verdict: 'not-configured', reason }, noisy: false, prefetchCapped: false, problems: [], overBudget: [], via: 'rail' };
  const loaded = await loadShell(page, device, route, base);
  if ('fail' in loaded) {
    const why = `${loaded.fail.kind}: ${loaded.fail.message}`;
    line.shell = { ms: null, verdict: 'fail', reason: why };
    line.problems.push(why);
  } else {
    // Judged as a shell that works — it loaded, drew no error state and raised no console error — with its time reported.
    // The navigation budgets time a warm press inside the app; a direct load is a document the browser fetches whole,
    // so no navigation budget applies to it and none is invented.
    line.shell = { ms: loaded.ms, verdict: 'pass' };
  }
  return finish(line);
}

/** A time judged against its budget and passed: what its headroom is read from. `--timing off` judges none. */
const judged = (r: Reported): r is Reported & { ms: number; limit: number } => timing === 'on' && r.verdict === 'pass' && r.ms !== null && r.limit !== undefined;
const percent = (r: { ms: number; limit: number }) => `${Math.floor(headroom(r.ms, r.limit) * 100)}%`;

function finish(line: Line): Line {
  line.thin = METRICS.flatMap((name) => { const r = line[name]; return judged(r) && thin(r.ms, r.limit) ? [`${name} ${Math.round(r.ms)} ms leaves ${percent(r)} of its ${r.limit} ms budget`] : []; });
  // A function problem — a link that does not work, a page that never becomes ready, a wrong result — is red. A time past
  // its budget is reported with its numbers and never fails the run.
  line.status = line.problems.length ? 'FAIL' : line.noisy || line.thin.length || line.overBudget.length || line.data.verdict === 'not-configured' || line.interactive.verdict === 'not-configured' ? 'warn' : 'ok';
  return line;
}

const cell = (r: Reported): string => (r.verdict === 'not-configured' ? 'not-configured' : r.verdict === 'not-run' ? 'not run' : r.ms === null ? 'failed' : `${Math.round(r.ms)} ms`);
const text = (l: Line): string =>
  `${l.status.padEnd(7)} ${l.route} ${l.device} shell ${cell(l.shell)} · data ${cell(l.data)} · interactive ${cell(l.interactive)}`
  + (l.noisy ? ' · noisy' : '')
  + (l.landed ? ` · landed on ${l.landed}` : '')
  + (l.empty ? ' · data is the first-run state' : '')
  + METRICS.flatMap((name) => (l[name].verdict === 'not-configured' && l[name].reason ? [` · ${name} ${l[name].reason}`] : [])).join('')
  + (l.prefetchCapped ? ` · prefetch not idle after ${PREFETCH_WAIT / 1000} s` : '')
  + (l.drawerMs !== undefined ? ` · drawer ${l.drawerMs} ms` : '')
  + (l.via === 'menu' ? ` · through the workspace menu (${l.workspace})` : '')
  + (l.prefetched === undefined ? '' : l.prefetched === 0 ? ' · not prefetched' : ` · prefetched ${l.prefetched} time(s) before the press`)
  + (l.thin?.length ? ` · ${l.thin.join('; ')}` : '')
  + (l.problems.length ? ` · ${l.problems.join('; ')}` : '')
  + (l.overBudget.length ? ` · ${l.overBudget.join('; ')}` : '');

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

const summary = (o: Record<string, unknown>) => console.log(`navigate: ${JSON.stringify({ ...o, timing })}`);

async function main(): Promise<number> {
  holdArgs('navigate', args, ['--base', '--config', '--homes', '--mode', '--rail', '--rate', '--routes', '--samples', '--timing']);
  if (timing !== 'on' && timing !== 'off') { console.error(`--timing must be on or off, got ${timing}`); return 1; }
  if (mode !== 'default' && mode !== 'full') { console.error(`--mode must be default or full, got ${mode}`); return 1; }
  if ((opt('--samples') ?? '1') !== '1') { console.error('--samples: one sample and two retakes is the only protocol here; a 20-sample protocol takes its own samples'); return 1; }

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
    homes = await workspaceHomes(args);
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
  /** The timed values this run measured, recorded for the run's Tier 2 table. */
  const values: { check: string; page: string; unit: 'ms'; value: number; samples?: number[] }[] = [];
  /** What this run reported as not configured: routes without a navigation check, and a prefetch budget that is not the project's promise. */
  const unrun: string[] = [];
  let prefetch: { desktopKiB?: number; phoneClosedKiB?: number } | undefined;
  let problems: string[] = [];
  try {
    await prepare(page);
    const { starts, drawn, redirected } = await drawerRoutes(page, base, rail.routes);
    // Every route answered by one page outside the console is a wall in front of the whole product, not a route that never
    // becomes ready: name the redirect before any route is judged, since no rail route can be the fault.
    if (redirected !== undefined) {
      const reason = `every rail route redirected to ${redirected}: is sign-in on for this build?`;
      console.log(`FAIL    navigate: ${reason}`);
      summary({ mode, status: 'FAIL', routes, errors: [reason] });
      return 1;
    }
    // A project that configures a check somewhere has said where its presses go: a route it leaves out is a gap in its
    // own coverage, and one with no other route to start a journey from is a red, as it always was.
    const configured = checks.length > 0;
    for (const route of routes) {
      const check = checks.find((c) => c.path === route);
      if (!check) unrun.push(`${route}: no navigation check is configured`);
      // Each journey comes from the nearest rail route whose rail links to the destination, so it is a navigation and not the
      // page already shown; a workspace's only destination, from the nearest route of another workspace, through the menu.
      const way = journeyStart(rail.routes, route, starts, drawn, [...homes.keys()]);
      const start: From | undefined = way && { from: way.from, menu: way.via === 'menu' ? homes.get(route) : undefined };
      for (const device of DEVICES) {
        // No check for this route and no journey to start it from: the project has not said where its presses go, so
        // there is no navigation to time. Its shell is judged by loading it directly; what needs a configured check is
        // reported not-configured, and the run exits 2 so it is never counted as passed.
        if (!check && start === undefined && !configured) {
          const line = await shellOnly(page, device, route);
          lines.push(line);
          console.log(text(line));
          continue;
        }
        const limits = limitsFor(budgets, 'warm', device, check);
        let line: Line;
        try {
          // A route with no other route to start from has no navigation to time: it is a problem, never a 0 ms pass.
          if (start === undefined) throw new Fail('never-ready', 'the rail has no other route to start from');
          line = await measure(page, device, start, route, check, limits);
        } catch (e) {
          // The starting page never loading is a failure of this route and device, not of the run.
          const reason = e instanceof Fail ? `${e.kind}: ${e.message}` : (e as Error).message;
          line = finish({ route, device, status: 'FAIL', shell: { ms: null, verdict: 'fail', reason }, data: { ms: null, verdict: 'not-run' }, interactive: { ms: null, verdict: 'not-run' }, noisy: false, prefetchCapped: false, problems: [reason], overBudget: [], ...viaOf(start) });
        }
        if (!check) {
          line.data = { ms: null, verdict: 'not-configured', reason: 'no navigation check is configured' };
          line.interactive = { ms: null, verdict: 'not-configured', reason: 'no navigation check is configured' };
          finish(line);
        }
        lines.push(line);
        console.log(text(line));
        for (const name of METRICS) {
          const r = line[name];
          if (r.ms !== null && r.limit !== undefined) values.push({ check: `nav.${name}`, page: `${route} ${device}`, unit: 'ms', value: r.ms, ...(r.samples ? { samples: r.samples } : {}) });
        }
      }
    }
    recordPart(ROOT, 'navigate', values);
    // The phone-closed cap is judged only where the rail is in a drawer on a phone — the project's own promise, as the
    // template's is. A rail in the page prefetches what its visible links point at; that budget is not its promise.
    const phoneJudged = prefetchJudged('phoneClosed', starts);
    const desktop = await prefetchKiB(page, 'desktop', rail.landing);
    const phoneClosed = phoneJudged.judged ? await prefetchKiB(page, 'phone', rail.landing) : 0;
    prefetch = phoneJudged.judged ? { desktopKiB: desktop / KIB, phoneClosedKiB: phoneClosed / KIB } : { desktopKiB: desktop / KIB };
    problems = prefetchProblems({ desktopBytes: desktop, phoneClosedBytes: phoneClosed }, budgets.prefetchKb, { phoneClosed: phoneJudged.judged });
    const lineFor = (device: string, kib: number, cap: number) => `${kib > cap ? 'FAIL   ' : 'ok     '} prefetch ${device} ${kib.toFixed(1)} KiB compressed · cap ${cap} KiB`;
    console.log(lineFor('desktop', prefetch.desktopKiB!, budgets.prefetchKb.desktop));
    if (phoneJudged.judged) console.log(lineFor('phone-closed', prefetch.phoneClosedKiB!, budgets.prefetchKb.phoneClosed));
    else {
      console.log(`not run prefetch phone-closed · ${phoneJudged.reason}`);
      unrun.push(`prefetch phone with the drawer closed: ${phoneJudged.reason}`);
    }
    for (const p of problems) console.log(`FAIL    ${p}`);
  } finally {
    page.close();
  }

  // The least headroom of the run, so a reader sees how near the budgets a green run was, not only that it was green.
  const least = lines.flatMap((l) => METRICS.flatMap((name) => { const r = l[name]; return judged(r) ? [{ l, name, r }] : []; })).sort((a, b) => headroom(a.r.ms, a.r.limit) - headroom(b.r.ms, b.r.limit))[0];
  if (least) console.log(`headroom: the least was ${percent(least.r)}, ${least.l.route} ${least.l.device} ${least.name} ${Math.round(least.r.ms)} of ${least.r.limit} ms; under 20% warns`);
  const failed = lines.some((l) => l.status === 'FAIL') || problems.length > 0;
  const status = failed ? 'FAIL' : lines.some((l) => l.status === 'warn') ? 'warn' : 'ok';
  summary({
    mode,
    status,
    routes,
    warnings: coverage.warnings,
    lines: lines.map(({ route, device, status: s, shell, data, interactive, drawerMs, prefetchCapped, noisy, thin: t, problems: p, via, workspace, prefetched, landed, empty }) => ({ route, device, status: s, via, workspace, prefetched, landed, empty, shell, data, interactive, drawerMs, prefetchCapped, noisy, thin: t, problems: p })),
    prefetch: prefetch && { ...prefetch, problems },
    notRun: unrun,
  });
  // Exit 2 is "left a case unrun": the suite's not-configured cases are never counted as a pass, and the last-green
  // marker is not advanced by a run that has them.
  return failed ? 1 : unrun.length ? 2 : 0;
}

// Run only as the command: a test or a script of the project's own that imports this file must not start a run.
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());

/**
 * The size checks of a production build: first-load JS of every non-API route, and the HTML of every page, each against
 * its own baseline.
 *
 *   node scripts/sizes.ts [--base http://127.0.0.1:3000] [--write-baseline]
 *
 * First-load comes from the build's own `diagnostics/route-bundle-stats.json`, read once, with each chunk's size from
 * disk: every chunk a route loads counted once, uncompressed. It is checked against `budgets.firstLoadKb` and, when
 * `scripts/verify.baseline.json` exists, against `budgets.firstLoadGrowthPct` over it; with `firstLoadKb: null` a route
 * the baseline holds is held to it alone, and the default cap binds only a route it does not. A page's HTML is what a person
 * downloads: the complete streamed response from the app running at `--base`, gzipped. Every page in the baseline's
 * `html` is held to `budgets.htmlGrowthPct` over its own figure, and a route in `budgets.htmlKb` also to that absolute
 * cap. Without a baseline a growth check is `not-configured`, a warning and never a pass; without `--base` the HTML is
 * `not run`. Gzip frames a page's inline flight stream differently on each Node major, so the baseline records the major
 * its HTML was built with (`html.node`) and the growth is judged only under that major: under another, or when the field
 * is absent, the line is a `warn` saying the growth was not judged — never an `ok`.
 *
 * `--write-baseline` records the build's sizes as the team's baseline, `scripts/verify.baseline.json`, and checks
 * nothing: first-load for every route and, with `--base`, the HTML of every page (no API, no dynamic segment, not the
 * not-found screen). Without `--base` the HTML baseline already there is kept. The file is the team's: commit it on its
 * own, from a build whose sizes were reviewed. It carries `recordedBy: "sizes.ts"`, the mark of a baseline the team
 * recorded: an update's finalize judges growth only against such a baseline that also differs from the release's, never
 * against the baseline a created project inherited from the release it was made with.
 *
 * One line per check, and a JSON summary on the last line:
 *
 *   ok|FAIL|warn|not run <what> ...
 *   sizes: {"status","firstLoad":{"status","routes","largest","growth","overCap","overAllowance","problems"},"html":{"status","sizes","growth","overCap","overAllowance","reason","problems"}}
 *
 * `overCap` and `overAllowance` are separate verdicts, one per kind of check: a route can be over its cap and inside its
 * growth allowance, or the other way round, and a summary that folded them said "within its allowance" of a page that
 * had grown past it (#132).
 *
 * The exit code is non-zero on a FAIL and on a build or baseline that cannot be read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { FIRST_LOAD_CAP_KB, budgetsOf, type BudgetsConfig } from './lib/budgets.ts';
import { distDirOf } from './lib/next-config.ts';
import { firstLoad, firstLoadProblems, htmlGrowthProblems, htmlNodeMismatch, htmlProblems, htmlRoutes, KIB, kib, sizeBaselineOwned } from './lib/sizes.ts';
import verifyConfig from './verify.config.ts';
import { holdArgs } from './lib/args.ts';
import { recordPart } from './lib/tier2.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'scripts/verify.baseline.json');
const METHOD = 'route-bundle-stats firstLoadChunkPaths, deduplicated, uncompressed bytes';
const HTML_METHOD = 'the complete streamed response, gzipped (zlib level 6), bytes';

const args = process.argv.slice(2);
holdArgs('sizes', args, ['--base', '--write-baseline']);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = opt('--base')?.replace(/\/$/, '');

type Status = 'ok' | 'warn' | 'FAIL' | 'not run';
const summary = (o: Record<string, unknown>) => console.log(`sizes: ${JSON.stringify(o)}`);
const fail = (message: string): never => { console.log(`FAIL    ${message}`); summary({ status: 'FAIL', error: message }); process.exit(1); };

/** Every non-API route's first-load bytes, from the build's route stats and the chunks on disk. */
function measured(dist: string): { route: string; bytes: number }[] {
  const file = path.join(dist, 'diagnostics/route-bundle-stats.json');
  if (!fs.existsSync(file)) return fail(`no ${path.relative(ROOT, file)}; run next build first`);
  let stats: { route: string; firstLoadChunkPaths: string[] }[];
  try { stats = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fail(`${path.relative(ROOT, file)} is not JSON: ${(e as Error).message}`); }
  try {
    return firstLoad(
      stats.filter((s) => !s.route.startsWith('/api/')),
      (chunk) => { try { return fs.statSync(path.join(ROOT, chunk)).size; } catch { return null; } },
    ).sort((a, b) => a.route.localeCompare(b.route));
  } catch (e) { return fail((e as Error).message); }
}

type Baseline = { firstLoad: Record<string, number>; html: Record<string, number> | null; htmlNode?: number; recordedBy?: string };
const SHAPE = '{ "method": string, "routes": { "<route>": <bytes> }, "html"?: { "method": string, "node"?: number, "routes": { "<route>": <bytes> } } }';
/** The Node major that built this run's pages: the HTML figures are comparable only within one, so the baseline records it. */
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const sized = (v: unknown): v is Record<string, number> => !!v && typeof v === 'object' && Object.values(v).every((n) => typeof n === 'number' && n > 0);

/** The team's baseline, or null when it has none. A file that is there and wrong is an error, never a missing baseline. */
function baselineOf(): Baseline | null {
  if (!fs.existsSync(BASELINE)) return null;
  const rel = path.relative(ROOT, BASELINE);
  let raw: { routes?: unknown; html?: { node?: unknown; routes?: unknown } };
  try { raw = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return fail(`${rel} is not JSON: ${(e as Error).message}`); }
  const node = raw?.html?.node;
  if (!sized(raw?.routes) || (raw.html !== undefined && (!sized(raw.html?.routes) || (node !== undefined && !(Number.isInteger(node) && (node as number) > 0))))) {
    return fail(`${rel} must be ${SHAPE}; write it with node scripts/sizes.ts --write-baseline --base <url>`);
  }
  return { firstLoad: raw.routes, html: raw.html ? (raw.html.routes as Record<string, number>) : null, htmlNode: node as number | undefined, recordedBy: typeof (raw as { recordedBy?: unknown }).recordedBy === 'string' ? (raw as { recordedBy: string }).recordedBy : undefined };
}

/** Each page's complete response, read through the end of the stream and gzipped: what a person downloads. */
async function htmlSizes(routes: string[], why: string): Promise<{ sizes: Record<string, number>; problems: string[] }> {
  const sizes: Record<string, number> = {};
  const problems: string[] = [];
  // Three at a time: a page's bytes are independent of every other page's, and awaiting each of twenty-one in turn made
  // this the slowest step of the size check. Three is enough to overlap the round trips without loading the app it is
  // measuring, which the time-based checks beside it would read as its own cost.
  const queue = [...routes];
  const worker = async () => {
    for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
      try {
        const res = await fetch(base + route, { headers: { 'accept-encoding': 'identity' }, redirect: 'manual' });
        const body = Buffer.from(await res.arrayBuffer());
        if (res.status !== 200) problems.push(`${route}: ${why}, but the route answered ${res.status}`);
        else sizes[route] = gzipSync(body).byteLength;
      } catch (e) { problems.push(`${route}: could not be fetched from ${base} (${(e as Error).message})`); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  // In the order asked for, so the report reads the same however the fetches interleaved.
  const ordered = Object.fromEntries(routes.filter((r) => r in sizes).map((r) => [r, sizes[r]]));
  return { sizes: ordered, problems };
}

async function main(): Promise<number> {
  const routes = measured(path.join(ROOT, await distDirOf(ROOT)));
  if (args.includes('--write-baseline')) {
    const before = fs.existsSync(BASELINE) ? baselineOf() : null;
    let html: Record<string, number> | null = before?.html ?? null;
    // A baseline kept as it was keeps the major it was recorded under, so its figures stay judgeable under that major.
    let node: number | undefined = before?.htmlNode;
    if (base) {
      const got = await htmlSizes(htmlRoutes(routes.map((r) => r.route)), 'a page');
      // A page that redirects or is refused here (a sign-in, a 404 by design) has no HTML of its own to hold.
      for (const p of got.problems) console.log(`warn    ${p}; left out of the HTML baseline`);
      html = got.sizes;
      node = NODE_MAJOR;
    }
    // `recordedBy` marks a baseline the team recorded: an update judges size growth only against one of these that
    // also differs from the release's, never against the baseline a created project inherited (update --finalize).
    const written = { method: METHOD, recordedBy: 'sizes.ts', routes: Object.fromEntries(routes.map((r) => [r.route, r.bytes])), ...(html ? { html: { method: HTML_METHOD, ...(node === undefined ? {} : { node }), routes: html } } : {}) };
    fs.writeFileSync(BASELINE, JSON.stringify(written, null, 2) + '\n');
    console.log(`ok      wrote ${path.relative(ROOT, BASELINE)}: first-load of ${routes.length} routes, ${base ? `the HTML of ${Object.keys(html ?? {}).length} pages` : html ? 'the HTML baseline kept as it was (no --base to measure)' : 'no HTML (pass --base <url> of the running build to record it)'}`);
    return 0;
  }

  const budgets = budgetsOf(verifyConfig as BudgetsConfig);
  const baseline = baselineOf();
  // A project Meridian manages inherits the release's baseline; only a baseline the team recorded is its own promise.
  // Both checks judge growth against it, so both are reported not run with the reason — declared configuration, never a
  // pass, and not left to a Node-major accident.
  const owned = sizeBaselineOwned({ baseline, managed: fs.existsSync(path.join(ROOT, '.meridian/manifest.json')) });
  if (!owned.owned) {
    console.log(`not run first-load ${owned.reason}`);
    console.log(`not run html ${owned.reason}`);
    summary({ status: 'not-run', reason: owned.reason });
    return 0;
  }
  const capKiB = budgets.firstLoadKb ?? FIRST_LOAD_CAP_KB;
  const size = firstLoadProblems(routes, { capKiB, growthPct: budgets.firstLoadGrowthPct, baseline: baseline?.firstLoad ?? null, capUnheldOnly: budgets.firstLoadKb === null });
  const largest = routes.reduce((a, b) => (b.bytes > a.bytes ? b : a), routes[0]);
  const lines: string[] = [];
  // Tier 2 is reported, never a gate: a route over its cap or a page grown past its allowance is a warn with its
  // numbers; only a build or a baseline this check cannot read fails the run (a measurement that did not happen).
  const firstStatus: Status = size.problems.length ? 'warn' : size.growth === 'not-configured' ? 'warn' : 'ok';
  lines.push(`${firstStatus === 'warn' ? 'warn   ' : 'ok     '} first-load ${routes.length} routes, largest ${largest.route} ${kib(largest.bytes)} KiB · cap ${capKiB} KiB${budgets.firstLoadKb === null ? ' for a route the baseline does not hold' : ''}`
    // Two verdicts, never one word for both: a route may be over its cap and inside its allowance, or the reverse.
    + ` · growth ${size.growth === 'checked' ? (size.overAllowance ? `over ${budgets.firstLoadGrowthPct}% of the baseline` : `within ${budgets.firstLoadGrowthPct}% of the baseline`) : 'not-configured (no scripts/verify.baseline.json)'}`
    + ` · cap ${size.overCap ? 'exceeded' : 'held'}`);
  for (const p of size.problems) lines.push(`warn    ${p}`);

  const capped = Object.keys(budgets.htmlKb);
  // A page the build no longer has (a created project leaves the Atlas out) is not measured: there is nothing to hold.
  const built = new Set(routes.map((r) => r.route));
  const held = Object.keys(baseline?.html ?? {}).filter((r) => built.has(r));
  const pages = [...new Set([...held, ...capped])].sort();
  let html: { status: Status; sizes: Record<string, number>; growth?: 'checked' | 'not-configured'; overCap?: boolean; overAllowance?: boolean; reason?: string; unjudged?: string; problems: string[]; measured?: string[] };
  if (!base) html = { status: 'not run', sizes: {}, reason: 'no app is running to measure', problems: [] };
  else {
    const got = await htmlSizes(pages, 'its HTML is held');
    // A baseline recorded under another Node major says nothing about this build's figures: growth is not judged, and a
    // cap alone can still fail the line. Never `ok`, because nothing was compared.
    const unjudged = baseline?.html ? htmlNodeMismatch(baseline.htmlNode, NODE_MAJOR) : null;
    const grown = unjudged ? { problems: [], growth: 'not-configured' as const, overAllowance: false } : htmlGrowthProblems(got.sizes, { growthPct: budgets.htmlGrowthPct, baseline: baseline?.html ?? null });
    const caps = htmlProblems(got.sizes, budgets.htmlKb);
    // A page that could not be measured (not 200, not fetched) is a failure of the check itself; growth and caps past
    // their line are Tier 2 values, reported and never a failure.
    const measured = got.problems;
    const problems = [...grown.problems, ...caps];
    html = { status: measured.length ? 'FAIL' : problems.length || unjudged || grown.growth === 'not-configured' ? 'warn' : 'ok', sizes: got.sizes, growth: grown.growth, overCap: caps.length > 0, overAllowance: grown.overAllowance, ...(unjudged ? { unjudged } : {}), problems, measured };
  }
  const largestPage = Object.entries(html.sizes).sort((a, b) => b[1] - a[1])[0];
  lines.push(html.status === 'not run'
    ? `not run html ${html.reason}`
    : `${html.status === 'warn' ? 'warn   ' : 'ok     '} html ${Object.keys(html.sizes).length} pages gzipped${largestPage ? `, largest ${largestPage[0]} ${(largestPage[1] / KIB).toFixed(1)} KiB` : ''}`
      + (html.unjudged ? ` · growth not judged (${html.unjudged})`
        : ` · growth ${html.growth === 'checked' ? (html.overAllowance ? `over ${budgets.htmlGrowthPct}% of the baseline` : `within ${budgets.htmlGrowthPct}% of the baseline`) : 'not-configured (no html in scripts/verify.baseline.json: node scripts/sizes.ts --write-baseline --base <url>)'}`)
      + ` · cap ${html.overCap ? 'exceeded' : 'held'}`
      + (capped.length ? ` · caps ${capped.map((r) => `${r} ${html.sizes[r] === undefined ? 'unmeasured' : `${(html.sizes[r] / KIB).toFixed(1)} KiB`} of ${budgets.htmlKb[r]}`).join(', ')}` : ''));
  for (const p of html.measured ?? []) lines.push(`FAIL    ${p}`);
  for (const p of html.problems) lines.push(`warn    ${p}`);
  lines.forEach((l) => console.log(l));

  const failed = html.status === 'FAIL';
  // Every figure is a Tier 2 value: recorded here, judged by the run's table against the release before.
  recordPart(ROOT, 'sizes', [
    ...routes.map((r) => ({ check: 'sizes.first-load', page: r.route, unit: 'KiB' as const, value: Math.round((r.bytes / KIB) * 100) / 100 })),
    ...(html.sizes ? Object.entries(html.sizes).map(([page, bytes]) => ({ check: 'sizes.html', page, unit: 'KiB' as const, value: Math.round((bytes / KIB) * 100) / 100 })) : []),
  ]);
  summary({
    status: failed ? 'FAIL' : firstStatus === 'warn' || html.status === 'warn' ? 'warn' : 'ok',
    firstLoad: { status: firstStatus, routes: routes.length, largest: { route: largest.route, kib: kib(largest.bytes) }, growth: size.growth, overCap: size.overCap, overAllowance: size.overAllowance, problems: size.problems },
    html,
  });
  return failed ? 1 : 0;
}

process.exit(await main());

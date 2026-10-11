/**
 * The size checks of a production build: first-load JS of every non-API route against its cap and its baseline, and the
 * complete HTML of every route that has an `htmlKb` cap.
 *
 *   node scripts/sizes.ts [--base http://127.0.0.1:3000] [--write-baseline]
 *
 * First-load comes from the build's own `diagnostics/route-bundle-stats.json`, read once, with each chunk's size from
 * disk: every chunk a route loads counted once, uncompressed. It is checked against `budgets.firstLoadKb` and, when
 * `scripts/verify.baseline.json` exists, against `budgets.firstLoadGrowthPct` over it. Without a baseline the growth
 * check is `not-configured`, a warning and never a pass. The HTML is measured through the end of the streamed response
 * from the app already running at `--base`; without `--base` it is `not run`.
 *
 * `--write-baseline` records the build's first-load sizes as the team's baseline, `scripts/verify.baseline.json`, and
 * checks nothing. The file is the team's: commit it on its own, from a build whose sizes were reviewed.
 *
 * One line per check, and a JSON summary on the last line:
 *
 *   ok|FAIL|warn|not run <what> ...
 *   sizes: {"status","firstLoad":{"status","routes","largest","growth","problems"},"html":{"status","sizes","reason","problems"}}
 *
 * The exit code is non-zero on a FAIL and on a build or baseline that cannot be read.
 */
import fs from 'node:fs';
import path from 'node:path';

import { budgetsOf, type BudgetsConfig } from './lib/budgets.ts';
import { distDirOf } from './lib/next-config.ts';
import { firstLoad, firstLoadProblems, htmlProblems } from './lib/sizes.ts';
import verifyConfig from './verify.config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'scripts/verify.baseline.json');
const METHOD = 'route-bundle-stats firstLoadChunkPaths, deduplicated, uncompressed bytes';
const KIB = 1024;
const kib = (bytes: number): number => Math.round(bytes / KIB);

const args = process.argv.slice(2);
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

/** The team's baseline, or null when it has none. A file that is there and wrong is an error, never a missing baseline. */
function baselineOf(): Record<string, number> | null {
  if (!fs.existsSync(BASELINE)) return null;
  const rel = path.relative(ROOT, BASELINE);
  let raw: { routes?: Record<string, unknown> };
  try { raw = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return fail(`${rel} is not JSON: ${(e as Error).message}`); }
  const routes = raw?.routes;
  if (!routes || typeof routes !== 'object' || Object.values(routes).some((v) => typeof v !== 'number' || !(v > 0))) {
    return fail(`${rel} must be { "method": string, "routes": { "<route>": <bytes> } }; write it with node scripts/sizes.ts --write-baseline`);
  }
  return routes as Record<string, number>;
}

/** The complete response of each route, in bytes, read through the end of the stream and left uncompressed. */
async function htmlSizes(routes: string[]): Promise<{ sizes: Record<string, number>; problems: string[] }> {
  const sizes: Record<string, number> = {};
  const problems: string[] = [];
  for (const route of routes) {
    try {
      const res = await fetch(base + route, { headers: { 'accept-encoding': 'identity' } });
      const body = await res.arrayBuffer();
      if (res.status !== 200) problems.push(`${route}: HTML cap set, but the route answered ${res.status}`);
      else sizes[route] = body.byteLength;
    } catch (e) { problems.push(`${route}: could not be fetched from ${base} (${(e as Error).message})`); }
  }
  return { sizes, problems };
}

async function main(): Promise<number> {
  const routes = measured(path.join(ROOT, await distDirOf(ROOT)));
  if (args.includes('--write-baseline')) {
    const written = { method: METHOD, routes: Object.fromEntries(routes.map((r) => [r.route, r.bytes])) };
    fs.writeFileSync(BASELINE, JSON.stringify(written, null, 2) + '\n');
    console.log(`ok      wrote ${path.relative(ROOT, BASELINE)}: ${routes.length} routes`);
    return 0;
  }

  const budgets = budgetsOf(verifyConfig as BudgetsConfig);
  const baseline = baselineOf();
  const size = firstLoadProblems(routes, { capKiB: budgets.firstLoadKb, growthPct: budgets.firstLoadGrowthPct, baseline });
  const largest = routes.reduce((a, b) => (b.bytes > a.bytes ? b : a), routes[0]);
  const lines: string[] = [];
  const firstStatus: Status = size.problems.length ? 'FAIL' : size.growth === 'not-configured' ? 'warn' : 'ok';
  lines.push(`${firstStatus === 'FAIL' ? 'FAIL   ' : firstStatus === 'warn' ? 'warn   ' : 'ok     '} first-load ${routes.length} routes, largest ${largest.route} ${kib(largest.bytes)} KiB · cap ${budgets.firstLoadKb} KiB`
    + ` · growth ${size.growth === 'checked' ? `within ${budgets.firstLoadGrowthPct}% of the baseline` : 'not-configured (no scripts/verify.baseline.json)'}`);
  for (const p of size.problems) lines.push(`FAIL    ${p}`);

  const capped = Object.keys(budgets.htmlKb);
  let html: { status: Status; sizes: Record<string, number>; reason?: string; problems: string[] };
  if (!capped.length) html = { status: 'not run', sizes: {}, reason: 'no htmlKb caps are configured', problems: [] };
  else if (!base) html = { status: 'not run', sizes: {}, reason: 'no app is running to measure', problems: [] };
  else {
    const got = await htmlSizes(capped);
    const problems = [...got.problems, ...htmlProblems(got.sizes, budgets.htmlKb)];
    html = { status: problems.length ? 'FAIL' : 'ok', sizes: got.sizes, problems };
  }
  lines.push(html.status === 'not run'
    ? `not run html ${html.reason}`
    : `${html.status === 'FAIL' ? 'FAIL   ' : 'ok     '} html ${capped.map((r) => `${r} ${html.sizes[r] === undefined ? 'unmeasured' : `${kib(html.sizes[r])} KiB`} of ${budgets.htmlKb[r]}`).join(' · ')}`);
  for (const p of html.problems) lines.push(`FAIL    ${p}`);
  lines.forEach((l) => console.log(l));

  const failed = firstStatus === 'FAIL' || html.status === 'FAIL';
  summary({
    status: failed ? 'FAIL' : firstStatus === 'warn' ? 'warn' : 'ok',
    firstLoad: { status: firstStatus, routes: routes.length, largest: { route: largest.route, kib: kib(largest.bytes) }, growth: size.growth, problems: size.problems },
    html,
  });
  return failed ? 1 : 0;
}

process.exit(await main());

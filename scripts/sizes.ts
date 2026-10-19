/**
 * The size checks of a production build: first-load JS of every non-API route, and the HTML of every page, each against
 * its own baseline.
 *
 *   node scripts/sizes.ts [--base http://127.0.0.1:3000] [--write-baseline]
 *
 * First-load comes from the build's own `diagnostics/route-bundle-stats.json`, read once, with each chunk's size from
 * disk: every chunk a route loads counted once, uncompressed. It is checked against `budgets.firstLoadKb` and, when
 * `scripts/verify.baseline.json` exists, against `budgets.firstLoadGrowthPct` over it. A page's HTML is what a person
 * downloads: the complete streamed response from the app running at `--base`, gzipped. Every page in the baseline's
 * `html` is held to `budgets.htmlGrowthPct` over its own figure, and a route in `budgets.htmlKb` also to that absolute
 * cap. Without a baseline a growth check is `not-configured`, a warning and never a pass; without `--base` the HTML is
 * `not run`.
 *
 * `--write-baseline` records the build's sizes as the team's baseline, `scripts/verify.baseline.json`, and checks
 * nothing: first-load for every route and, with `--base`, the HTML of every page (no API, no dynamic segment, not the
 * not-found screen). Without `--base` the HTML baseline already there is kept. The file is the team's: commit it on its
 * own, from a build whose sizes were reviewed.
 *
 * One line per check, and a JSON summary on the last line:
 *
 *   ok|FAIL|warn|not run <what> ...
 *   sizes: {"status","firstLoad":{"status","routes","largest","growth","problems"},"html":{"status","sizes","growth","reason","problems"}}
 *
 * The exit code is non-zero on a FAIL and on a build or baseline that cannot be read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { budgetsOf, type BudgetsConfig } from './lib/budgets.ts';
import { distDirOf } from './lib/next-config.ts';
import { firstLoad, firstLoadProblems, htmlGrowthProblems, htmlProblems, htmlRoutes } from './lib/sizes.ts';
import verifyConfig from './verify.config.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'scripts/verify.baseline.json');
const METHOD = 'route-bundle-stats firstLoadChunkPaths, deduplicated, uncompressed bytes';
const HTML_METHOD = 'the complete streamed response, gzipped (zlib level 6), bytes';
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

type Baseline = { firstLoad: Record<string, number>; html: Record<string, number> | null };
const SHAPE = '{ "method": string, "routes": { "<route>": <bytes> }, "html"?: { "method": string, "routes": { "<route>": <bytes> } } }';
const sized = (v: unknown): v is Record<string, number> => !!v && typeof v === 'object' && Object.values(v).every((n) => typeof n === 'number' && n > 0);

/** The team's baseline, or null when it has none. A file that is there and wrong is an error, never a missing baseline. */
function baselineOf(): Baseline | null {
  if (!fs.existsSync(BASELINE)) return null;
  const rel = path.relative(ROOT, BASELINE);
  let raw: { routes?: unknown; html?: { routes?: unknown } };
  try { raw = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return fail(`${rel} is not JSON: ${(e as Error).message}`); }
  if (!sized(raw?.routes) || (raw.html !== undefined && !sized(raw.html?.routes))) {
    return fail(`${rel} must be ${SHAPE}; write it with node scripts/sizes.ts --write-baseline --base <url>`);
  }
  return { firstLoad: raw.routes, html: raw.html ? (raw.html.routes as Record<string, number>) : null };
}

/** Each page's complete response, read through the end of the stream and gzipped: what a person downloads. */
async function htmlSizes(routes: string[], why: string): Promise<{ sizes: Record<string, number>; problems: string[] }> {
  const sizes: Record<string, number> = {};
  const problems: string[] = [];
  for (const route of routes) {
    try {
      const res = await fetch(base + route, { headers: { 'accept-encoding': 'identity' }, redirect: 'manual' });
      const body = Buffer.from(await res.arrayBuffer());
      if (res.status !== 200) problems.push(`${route}: ${why}, but the route answered ${res.status}`);
      else sizes[route] = gzipSync(body).byteLength;
    } catch (e) { problems.push(`${route}: could not be fetched from ${base} (${(e as Error).message})`); }
  }
  return { sizes, problems };
}

async function main(): Promise<number> {
  const routes = measured(path.join(ROOT, await distDirOf(ROOT)));
  if (args.includes('--write-baseline')) {
    const kept = fs.existsSync(BASELINE) ? baselineOf()?.html ?? null : null;
    let html: Record<string, number> | null = kept;
    if (base) {
      const got = await htmlSizes(htmlRoutes(routes.map((r) => r.route)), 'a page');
      // A page that redirects or is refused here (a sign-in, a 404 by design) has no HTML of its own to hold.
      for (const p of got.problems) console.log(`warn    ${p}; left out of the HTML baseline`);
      html = got.sizes;
    }
    const written = { method: METHOD, routes: Object.fromEntries(routes.map((r) => [r.route, r.bytes])), ...(html ? { html: { method: HTML_METHOD, routes: html } } : {}) };
    fs.writeFileSync(BASELINE, JSON.stringify(written, null, 2) + '\n');
    console.log(`ok      wrote ${path.relative(ROOT, BASELINE)}: first-load of ${routes.length} routes, ${base ? `the HTML of ${Object.keys(html ?? {}).length} pages` : html ? 'the HTML baseline kept as it was (no --base to measure)' : 'no HTML (pass --base <url> of the running build to record it)'}`);
    return 0;
  }

  const budgets = budgetsOf(verifyConfig as BudgetsConfig);
  const baseline = baselineOf();
  const size = firstLoadProblems(routes, { capKiB: budgets.firstLoadKb, growthPct: budgets.firstLoadGrowthPct, baseline: baseline?.firstLoad ?? null });
  const largest = routes.reduce((a, b) => (b.bytes > a.bytes ? b : a), routes[0]);
  const lines: string[] = [];
  const firstStatus: Status = size.problems.length ? 'FAIL' : size.growth === 'not-configured' ? 'warn' : 'ok';
  lines.push(`${firstStatus === 'FAIL' ? 'FAIL   ' : firstStatus === 'warn' ? 'warn   ' : 'ok     '} first-load ${routes.length} routes, largest ${largest.route} ${kib(largest.bytes)} KiB · cap ${budgets.firstLoadKb} KiB`
    + ` · growth ${size.growth === 'checked' ? `within ${budgets.firstLoadGrowthPct}% of the baseline` : 'not-configured (no scripts/verify.baseline.json)'}`);
  for (const p of size.problems) lines.push(`FAIL    ${p}`);

  const capped = Object.keys(budgets.htmlKb);
  // A page the build no longer has (a created project leaves the Atlas out) is not measured: there is nothing to hold.
  const built = new Set(routes.map((r) => r.route));
  const held = Object.keys(baseline?.html ?? {}).filter((r) => built.has(r));
  const pages = [...new Set([...held, ...capped])].sort();
  let html: { status: Status; sizes: Record<string, number>; growth?: 'checked' | 'not-configured'; reason?: string; problems: string[] };
  if (!base) html = { status: 'not run', sizes: {}, reason: 'no app is running to measure', problems: [] };
  else {
    const got = await htmlSizes(pages, 'its HTML is held');
    const grown = htmlGrowthProblems(got.sizes, { growthPct: budgets.htmlGrowthPct, baseline: baseline?.html ?? null });
    const problems = [...got.problems, ...grown.problems, ...htmlProblems(got.sizes, budgets.htmlKb)];
    html = { status: problems.length ? 'FAIL' : grown.growth === 'not-configured' ? 'warn' : 'ok', sizes: got.sizes, growth: grown.growth, problems };
  }
  const largestPage = Object.entries(html.sizes).sort((a, b) => b[1] - a[1])[0];
  lines.push(html.status === 'not run'
    ? `not run html ${html.reason}`
    : `${html.status === 'FAIL' ? 'FAIL   ' : html.status === 'warn' ? 'warn   ' : 'ok     '} html ${Object.keys(html.sizes).length} pages gzipped${largestPage ? `, largest ${largestPage[0]} ${(largestPage[1] / KIB).toFixed(1)} KiB` : ''}`
      + ` · growth ${html.growth === 'checked' ? `within ${budgets.htmlGrowthPct}% of the baseline` : 'not-configured (no html in scripts/verify.baseline.json: node scripts/sizes.ts --write-baseline --base <url>)'}`
      + (capped.length ? ` · caps ${capped.map((r) => `${r} ${html.sizes[r] === undefined ? 'unmeasured' : `${(html.sizes[r] / KIB).toFixed(1)} KiB`} of ${budgets.htmlKb[r]}`).join(', ')}` : ''));
  for (const p of html.problems) lines.push(`FAIL    ${p}`);
  lines.forEach((l) => console.log(l));

  const failed = firstStatus === 'FAIL' || html.status === 'FAIL';
  summary({
    status: failed ? 'FAIL' : firstStatus === 'warn' || html.status === 'warn' ? 'warn' : 'ok',
    firstLoad: { status: firstStatus, routes: routes.length, largest: { route: largest.route, kib: kib(largest.bytes) }, growth: size.growth, problems: size.problems },
    html,
  });
  return failed ? 1 : 0;
}

process.exit(await main());

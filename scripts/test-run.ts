/**
 * The three test commands, and the only test commands. Each takes no arguments from the person or the agent; it is the
 * tool that picks the tests.
 *
 *   pnpm test:t1        the Tier 1 tests affected by the changes since the last green run, with the type check
 *   pnpm test:t2        the same plus the Tier 2 checks those changes affect (the affected Tier 1 tests included)
 *   pnpm test:release   every Tier 1 and Tier 2 test, once, with lint and the type check
 *
 * `node scripts/test-run.ts stage <static|sweep <name>|deep --since <ref> [--part i/n]|tier2>` runs one part of test:release,
 * for a CI job; it shares test:release's step functions. It is not a fourth test command.
 *
 * "Since the last green run" is the marker in out/last-green, which a command writes after a passing run; out/ is
 * gitignored. A missing marker falls back to the diff against master, and a checkout with neither marker nor a diff
 * (master itself, a fresh CI clone) runs the whole tier, because no green run is evidence for it.
 *
 * Selection is the tool's, never a list kept by hand:
 *
 * - Tier 1 is every test under tests/ outside the Tier 2 convention. Vitest's `related` reads the import graph and runs
 *   the tests that reach a changed file; a changed test file is run itself. A document a test reads by name has no
 *   import edge, so the tests that name it are the group it selects (git grep); a change that reaches no test at all, and
 *   a deleted file whose importers can no longer be computed, run the whole tier.
 * - Tier 1's large browser-fixture tests (tests/deep-*) run on their own, never inside the main Vitest run: their size
 *   decides that, not their tier.
 * - The browser function sweeps (scripts/browser.ts --depth fn: every page, control and keyboard stop, the walk-throughs
 *   and the sizes) are Tier 1 and fail the run. They run where a build and Chrome exist: test:t2, test:release and the
 *   release sweep jobs. test:t1 does not run them. `--only <audit|interactions|keyboard|rest>` runs one sweep by hand.
 * - Tier 2 is the performance convention `*.perf.test.ts(x)` and the timed browser suites: on a quiet machine, the timed
 *   runs (--depth timed), and the 20-sample protocol (--depth perf) where CI is true: the release workflow's `tier2`
 *   job and the weekly `release` job. They report and never fail: a timed or perf suite that prints FAIL is counted in the closing line's
 *   "Tier 2 over budget (reported, not failed)".
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bin } from './lib/bin.ts';
import { FIRST_LOAD_CAP_KB, budgetsOf, type BudgetsConfig } from './lib/budgets.ts';
import { consumerSmokeKind } from './lib/consumer-smoke.ts';
import { deepFiles, deepPart, deepPlan, deepReach } from './lib/deep-inputs.ts';
import { clearLastRun, failedFilesOf, readLastRun, retryBaseline, retryNumber, writeLastRun } from './lib/last-run.ts';
import { lintTargets } from './lib/lint.ts';
import { deepBrowserNotRun } from './lib/report-lines.ts';
import { clearParts, reportOrWarn, type Seed, type Value } from './lib/tier2.ts';
import { summaryLine } from './lib/summary.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const MARKER = path.join(ROOT, 'out', 'last-green');
const REPORT = path.join(ROOT, 'out', 'test-run.json');

/** The Tier 2 file convention: performance tests, in any repository. */
const TIER2 = [/\.perf\.test\.tsx?$/];

/** Whether a project path is a Tier 2 test. */
export const isTier2 = (file: string): boolean => TIER2.some((rule) => rule.test(file));

/** The repository's large browser-fixture tests: Tier 1 by what they verify, run on their own by their size. */
const DEEP = /^tests\/deep-[^/]*\.test\.tsx?$/;
export const isDeep = (file: string): boolean => DEEP.test(file);

/** The paths whose change means any test may be affected: a docs-only change is not one of them. */
const CODE = /^(app|src|scripts|cli|tests|tokens|journeys|next\.config\.|package\.json$|pnpm-lock\.yaml$|tsconfig|vitest\.config|eslint\.config)/;

/** A path that changes what runs: a test is selected for it, or the whole tier falls back to running. */
export const isCode = (file: string): boolean => CODE.test(file);

/** The paths the browser suites walk: a change to what a page draws or a control does needs them. */
const BROWSER = /^(app|src|tokens|journeys|scripts|next\.config\.|package\.json$|pnpm-lock\.yaml$)/;
export const touchesBrowser = (file: string): boolean => BROWSER.test(file);

const isTestFile = (file: string): boolean => /\.test\.tsx?$/.test(file);

const git = (args: string[]): { ok: boolean; out: string } => {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
};

/** The empty tree: the base a repository without master and without a green run is compared against, so everything counts. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** Where the changes since the last green run begin: the marker's commit, else the merge base with master, else nothing. */
export function baseline(): { ref: string; from: 'the last green run' | 'master' } {
  try {
    const marked = fs.readFileSync(MARKER, 'utf8').trim();
    if (marked && git(['cat-file', '-e', `${marked}^{commit}`]).ok) return { ref: marked, from: 'the last green run' };
  } catch { /* no marker yet */ }
  const master = git(['rev-parse', '--verify', '--quiet', 'master^{commit}']);
  if (master.ok) {
    const base = git(['merge-base', master.out, 'HEAD']);
    if (base.ok) return { ref: base.out, from: 'master' };
  }
  return { ref: EMPTY_TREE, from: 'master' };
}

/** The files whose bytes differ from `base`, committed or not, with the untracked ones; a deleted path stays in the change. */
function changedSince(base: string): { all: string[]; present: string[]; deleted: string[] } {
  // A file the index does not hold is not tracked, whatever `git diff <tree>` says: against a tree it reads such a path
  // as deleted, and the red run's baseline is the working copy's own tree, so every file the run added would come back as
  // a change on the next run, and an unchanged retry could never see an unchanged tree.
  const untrackedNow = git(['ls-files', '--others', '--exclude-standard']).out.split('\n').filter(Boolean);
  const untracked = new Set(untrackedNow);
  const tracked = git(['diff', '--name-only', '--diff-filter=ACDMR', base, '--']).out.split('\n').filter(Boolean).filter((f) => !untracked.has(f));
  // A file `base` already holds is not this run's change, untracked or not.
  const held = new Set(git(['ls-tree', '-r', '--name-only', base]).out.split('\n').filter(Boolean));
  const all = [...new Set([...tracked, ...untrackedNow.filter((f) => !held.has(f))])];
  const present = all.filter((f) => fs.existsSync(path.join(ROOT, f)));
  const deleted = all.filter((f) => !present.includes(f));
  return { all, present, deleted };
}

/**
 * The tree the working copy would commit, computed in a throwaway index so the real one is never touched: the identity of
 * what a run proves, and — when the run is red — the base the next one diffs its fix against.
 */
function workingTree(): string | null {
  const index = git(['rev-parse', '--git-path', 'index']);
  if (!index.ok) return null;
  const copy = path.join(ROOT, 'out', 'index-last-run');
  try { fs.copyFileSync(path.resolve(ROOT, index.out), copy); } catch { return null; }
  const env = { ...process.env, GIT_INDEX_FILE: copy };
  const added = spawnSync('git', ['add', '-A'], { cwd: ROOT, encoding: 'utf8', env });
  const written = spawnSync('git', ['write-tree'], { cwd: ROOT, encoding: 'utf8', env });
  fs.rmSync(copy, { force: true });
  return added.status === 0 && written.status === 0 ? written.stdout.trim() : null;
}

/**
 * The tests that name a changed path, for the paths no import graph can reach (a document a guard reads with fs). The
 * group is read from the tests themselves: a name no test holds selects none, and the document changes nothing.
 */
export function testsNaming(file: string): string[] {
  const r = git(['grep', '-lF', '--', file, '--', 'tests']);
  return r.ok ? r.out.split('\n').filter((f) => isTestFile(f) && fs.existsSync(path.join(ROOT, f))) : [];
}

/** A passing run records the commit it proved, so the next run reads a smaller diff instead of the branch's whole history. */
function recordGreen(): void {
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, `${git(['rev-parse', 'HEAD']).out}\n`);
}

/** Vitest's arguments for a run: `related` limits it to the import graph of `filters`, `run` takes every collected file. */
function vitestArgs(mode: 'related' | 'run', filters: string[], withTier2: boolean): string[] {
  // `vitest related <files>` and `vitest run`: related is the only mode that takes filters.
  const args = mode === 'related' ? ['related', ...filters, '--run'] : ['run'];
  args.push('--passWithNoTests');
  args.push('--reporter=default');
  args.push('--reporter=json', '--outputFile', REPORT);
  // The main run never holds the large browser-fixture suites; they run on their own, one file at a time.
  args.push('--exclude', 'tests/deep-*');
  if (!withTier2) args.push('--exclude', '**/*.perf.test.*');
  args.push('--exclude', '**/node_modules/**');
  return args;
}

function run(label: string, cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): number {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'inherit', 'inherit'], env });
  const status = r.status ?? 1;
  console.log(`${status === 0 ? 'ok  ' : 'FAIL'} ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  return status;
}

/** What the last Vitest run proved, read from its JSON report; null when the report was not written. */
function report(): { files: number; tests: number; failed: string[] } | null {
  try {
    // `testResults` holds one entry per test file; the suite count includes every nested `describe`.
    const j = JSON.parse(fs.readFileSync(REPORT, 'utf8')) as { testResults?: unknown[]; numTotalTests?: number };
    return { files: j.testResults?.length ?? 0, tests: j.numTotalTests ?? 0, failed: failedFilesOf(ROOT, REPORT) };
  } catch { return null; }
}

function vitest(mode: 'related' | 'run', filters: string[], withTier2: boolean, label: string): { status: number; files: number; tests: number; failed: string[] } {
  try { fs.rmSync(REPORT, { force: true }); } catch { /* no stale report */ }
  const status = run(label, bin('vitest'), vitestArgs(mode, filters, withTier2));
  const r = report() ?? { files: 0, tests: 0, failed: [] };
  return { status, ...r };
}

/**
 * The static checks that read the whole tree: cheap enough to run on every tier, and the contract they hold (the tokens,
 * the registry, the card and page specifications, contrast) is affected by almost any change. They take no selection:
 * there is no import graph to narrow them with.
 */
function staticChecks(): number {
  const steps: [string, string[]][] = [
    ['tokens are fresh', ['scripts/tokens.ts', '--check']],
    ...(fs.existsSync(path.join(ROOT, 'src', 'system', 'registry.ts')) ? [['the registry is fresh', ['scripts/registry.ts', '--check']] as [string, string[]]] : []),
    ['specifications are consistent', ['scripts/check.ts']],
    ...(fs.existsSync(path.join(ROOT, 'scripts', 'check.local.ts')) ? [["the product's own rules hold", ['scripts/check.local.ts']] as [string, string[]]] : []),
    ['contrast holds in every theme and accent', ['scripts/contrast.ts']],
  ];
  // Every step runs: a red in the first must not hide the second (no fail-fast anywhere in these commands).
  let failed = 0;
  for (const [label, [script, ...args]] of steps) if (run(label, process.execPath, [script, ...args]) !== 0) failed++;
  return failed;
}

/** The type check every tier runs: the routes are generated, then TypeScript compiles the tree. */
function typecheck(): number {
  if (run('types: route types', bin('next'), ['typegen']) !== 0) return 1;
  return run('types: tsc --noEmit', bin('tsc'), ['--noEmit']);
}

/** This repository's budgets as the values a Tier 2 table uses until a release has recorded its own. */
async function seedValues(): Promise<Seed> {
  const config = ((await import(pathToFileURL(path.join(ROOT, 'scripts', 'verify.config.ts')).href)) as { default?: BudgetsConfig }).default;
  const budgets = budgetsOf(config as BudgetsConfig);
  const warm = budgets.navigation.warm;
  return {
    'vitals.lcp': 2.5,
    'vitals.inp': 200,
    'vitals.cls': 0.1,
    'vitals.frames': 50,
    'sizes.first-load': budgets.firstLoadKb ?? FIRST_LOAD_CAP_KB,
    'nav.shell': warm.shellMs.desktop,
    'nav.data': warm.dataMs.desktop,
    'nav.interactive': warm.interactiveMs.desktop,
    'perf.shell': warm.shellMs.desktop,
    'perf.data': warm.dataMs.desktop,
    'perf.interactive': warm.interactiveMs.desktop,
    // The live cases' arrival (`scripts/live.ts`): a change a hint carries, and one only the safety refresh repairs.
    'live.two-tabs': 2000,
    'live.burst': 2000,
    'live.burst-send': 2000,
    'live.restart-before': 2000,
    'live.visibility': 5000,
    'live.offline': 5000,
    'live.suppressed': 5000,
    'live.restart-gone': 5000,
    'live.restart-after': 5000,
  };
}

/**
 * The run's Tier 2 report: every value this run recorded against the previous release (and the spread of the last five,
 * once three exist), sorted by change, then the commits since the baseline that reached each page. It is a report — no
 * branch of it fails the run — and it writes `out/perf-record.json` for the next release's baseline.
 */
async function reportTier2(values: Value[]): Promise<string[]> {
  const seed = await seedValues();
  // Reporting is not a check: the values and the table are printed, and nothing it meets can fail the run (no project has
  // `cli/`, not every project is a git repository).
  const { lines, flagged } = await reportOrWarn({ root: ROOT, values, seed, previousTag: process.env.PREVIOUS_TAG });
  for (const line of lines) console.log(line);
  return flagged;
}

/** What a local Node major other than CI's leaves unjudged, said before any step runs. */
const ciGaps = (major: number): string[] => major === 22 ? [] : [
  `sizes: html growth is not judged under another major (the baseline records Node 22, this build used Node ${major})`,
  'everything else — the tests, the type check, lint, the build, the browser suites and the timed runs — is judged',
];



/** The Chrome every browser suite opens (scripts/lib/chrome.ts): `CHROME`, or the platform's usual install. */
const chromeAvailable = (): boolean => {
  const chrome = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
  if (!fs.existsSync(chrome)) return false;
  return spawnSync(chrome, ['--version'], { encoding: 'utf8' }).status === 0;
};

/** The large browser-fixture tests cannot run without Chrome; say so, never that they passed. */
function deepTests(label: string, files: string[] = ['tests/deep-']): { status: number; ran: boolean } {
  if (!chromeAvailable()) {
    console.log(`not run ${label}: no Chrome (CHROME is unset and no browser was found)`);
    return { status: 0, ran: false };
  }
  return { status: run(label, bin('vitest'), ['run', ...files, '--no-file-parallelism']), ran: true };
}

const hasDeep = (): boolean => fs.existsSync(path.join(ROOT, 'tests')) && fs.readdirSync(path.join(ROOT, 'tests')).some((f) => f.startsWith('deep-') && /\.test\.tsx?$/.test(f));

/** The Tier 1 files the main run leaves out: `tests/deep-*` runs whole when a script or a journey changed. */
const affectsDeep = (files: string[]): boolean => files.some((f) => /^(scripts|journeys)\//.test(f) || isDeep(f));

/**
 * The browser suites (scripts/browser.ts), at the depths asked for. Its own line per suite is passed through; the JSON
 * line says what ran and what did not, and its exit 2 is a run with something not run, not a failure.
 */
function browser(depth: string, built = false, only?: string): Promise<{ ok: boolean; notRun: string[]; declared: string[]; ran: string[]; reported: string[]; tier2: Value[] }> {
  // Streamed as it arrives, not collected and printed when the child exits: a suite that stops making progress must be
  // visible in the log while it is stuck, never only after it finally returns or times out.
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/browser.ts', '--depth', depth, ...(built ? ['--built'] : []), ...(only ? ['--only', only] : [])], { cwd: ROOT });
    let out = '';
    let rest = '';
    const drain = (text: string) => {
      out += text;
      rest += text;
      let i: number;
      while ((i = rest.indexOf('\n')) >= 0) { console.log(rest.slice(0, i)); rest = rest.slice(i + 1); }
    };
    child.stdout.on('data', (d) => drain(String(d)));
    child.stderr.on('data', (d) => drain(String(d)));
    child.on('close', (status) => {
      if (rest.trim()) console.log(rest);
      const json = /^browser: (.*)$/m.exec(out);
      let state: { ran?: string[]; failed?: boolean; notRun?: string[]; declared?: string[]; reported?: string[]; tier2?: Value[] } | null = null;
      try { state = json ? JSON.parse(json[1]) : null; } catch { state = null; }
      if (status === 1 || !state) {
        console.log(`test: browser suites FAIL (${out.split('\n').filter(Boolean).slice(-1)[0] ?? 'no output'})`);
        resolve({ ok: false, notRun: [], declared: [], ran: [], reported: [], tier2: [] });
        return;
      }
      resolve({ ok: true, notRun: state.notRun ?? [], declared: state.declared ?? [], ran: state.ran ?? [], reported: state.reported ?? [], tier2: state.tier2 ?? [] });
    });
  });
}

/** The steps `test:release` and the stages share, so a stage cannot drift from the release it is a part of. */
const typeSteps = (): [string, () => number][] => [
  ['types: route types', () => run('types: route types', bin('next'), ['typegen'])],
  ['types: tsc --noEmit', () => run('types: tsc --noEmit', bin('tsc'), ['--noEmit'])],
  ['lint: eslint .', () => run('lint: eslint .', bin('eslint'), ['.', '--ignore-pattern', '.meridian/'])],
];

/** A production build; the size checks need the built app served, so they run inside the browser suites. */
const productionBuild = (): number => run('build: next build', bin('next'), ['build'], { ...process.env, MERIDIAN_TYPES_CHECKED: '1' });

/**
 * The route policy after a build. A build without the two flags writes no renderingMode, and the policy presupposes them:
 * the project's configuration, reported as declared (exit 2) and never a failure; any other non-zero is a red.
 */
function routePolicy(declared: string[], failed: string[]): void {
  const policy = run('route policy', process.execPath, ['scripts/route-policy.ts']);
  if (policy === 2) declared.push("route policy (the build writes no renderingMode: the project's next.config sets no cacheComponents and partialPrefetching)");
  else if (policy !== 0) failed.push('the route policy');
}

/** Every test file but the browser fixtures, which run on their own. */
const everyTestFile = (): ReturnType<typeof vitest> => vitest('run', [], true, 'every test file (the browser fixtures run on their own)');

async function release(): Promise<number> {
  const notRun: string[] = [];
  /** What the project's own configuration left unrun: printed with its reason, and never holding the marker, because a rerun cannot change it. */
  const declared: string[] = [];
  /** Every Tier 1 failure this run met, printed together at the end: a red in one stage must not hide the next. */
  const failed: string[] = [];
  clearParts(ROOT);
  for (const gap of ciGaps(Number(process.versions.node.split('.')[0]))) console.log(`warn test:release: ${gap}`);
  if (staticChecks() !== 0) failed.push('static checks');
  for (const [label, step] of typeSteps()) if (step() !== 0) failed.push(label);

  // Every test file: Tier 1, the performance convention, and this repository's browser fixtures on their own below.
  const t1 = everyTestFile();
  if (t1.status !== 0) failed.push('the test suite');
  if (hasDeep()) {
    const deep = deepTests('Tier 1 browser-fixture tests (tests/deep-*)');
    if (deep.status !== 0) failed.push('the browser-fixture tests');
    if (!deep.ran) notRun.push('browser-fixture tests (tests/deep-*) (no Chrome)');
  }
  // A production build, its routes declared as the policy says. The size checks need the built app served, so they run
  // inside the browser suites below, once, against the app they start.
  if (productionBuild() !== 0) failed.push('the production build');
  routePolicy(declared, failed);
  // The browser suites against that build: the sweeps first, then the timed runs alone on the quiet machine. The parts
  // dir is cleared first, so values the browser-fixture tests recorded into the same out/ are not this run's.
  clearParts(ROOT);
  // The 20-sample protocol runs where `CI` is true, as it always has: the weekly run is the one with a quiet runner for
  // it, and the release workflow asks for it in its own `tier2` job. A local `test:release` judges times without it.
  const browserRun = await browser(process.env.CI === 'true' ? 'fn,timed,perf' : 'fn,timed', true);
  if (!browserRun.ok) failed.push('a browser suite');
  notRun.push(...browserRun.notRun.map((s) => `browser suites (${s})`));
  declared.push(...browserRun.declared.map((s) => `browser suites (${s})`));
  // The Postgres code the skill's references hand a team lives outside tests/ and needs services: run it only where the
  // owner supplied them, and say it did not run otherwise, never that it passed.
  const missing = ['MERIDIAN_POSTGRES_URL', 'MERIDIAN_POOLER_URL', 'MERIDIAN_PG'].filter((k) => !process.env[k]);
  const postgresConfig = path.join(ROOT, 'scripts', 'fixtures', 'postgres', 'vitest.config.ts');
  if (fs.existsSync(postgresConfig)) {
    if (missing.length) {
      console.log(`not run Postgres tests: ${missing.join(', ')} is not set`);
      notRun.push(`Postgres tests (${missing.join(', ')} not set)`);
    }
    else if (run('Postgres tests', bin('vitest'), ['run', '--config', postgresConfig]) !== 0) failed.push('the Postgres tests');
  }
  const overBudget = [...(await reportTier2(browserRun.tier2)), ...browserRun.reported.map((s) => `browser suites (${s})`)];
  for (const d of declared) console.log(`not run (declared by the project's configuration): ${d}`);
  if (!failed.length && !notRun.length) recordGreen();
  else if (notRun.length) console.log(`test:release: the marker is not advanced, because ${notRun.length} check${notRun.length === 1 ? '' : 's'} did not run`);
  const { line, exit } = summaryLine({ command: 'test:release', failed, notRun, declared, overBudget, files: t1.files, tests: t1.tests });
  console.log(line);
  return exit;
}

/** Packs this working tree and runs the consumer smoke a change owes, with CI's flags: the path an adopter walks. */
function consumerSmoke(kind: 'create' | 'update' | 'verify'): number {
  const flags = kind === 'create' ? ['--create', '--created-report'] : kind === 'update' ? ['--adopt', '--update', '--verify'] : ['--adopt', '--verify'];
  return run(`smoke: the consumer path (${kind})`, process.execPath, ['cli/scripts/consumer.ts', ...flags], { ...process.env, CI: 'true' });
}

async function affected(tier: 't1' | 't2'): Promise<number> {
  // A red run leaves the tree it proved and the test files it failed. The next run starts from that tree, so a fix runs
  // the failures it answers and the tests its own change reaches — not everything since the last green run.
  const last = readLastRun(ROOT);
  const retry = retryBaseline(last);
  const { ref, from } = retry ?? baseline();
  const { all: changed, present, deleted } = changedSince(ref);
  const withTier2 = tier === 't2';
  if (withTier2) clearParts(ROOT);
  const where = `${changed.length} changed file${changed.length === 1 ? '' : 's'} since ${from}`;

  // Nothing changed and a green run is recorded: there is nothing to prove again.
  const marker = fs.existsSync(MARKER);
  // A red run of this very tree is not "nothing changed": its failures run once more, and a pass then is reported as a
  // retry and never advances the marker, because a pass with no cause found is flaky (`docs/testing.md`, "Flaky is red").
  const sameTree = retry !== null && changed.length === 0;
  if (!changed.length && marker && !sameTree) {
    console.log(`test:${tier}: nothing changed since the last green run`);
    return 0;
  }
  if (sameTree && retryNumber(last) === null) {
    console.log(`test:${tier}: the tree has not changed since the run that failed, and it was retried once already: name the cause from the output, fix it, then run again`);
    return 1;
  }
  // The identity of what this run proves; a run that cannot name it records no baseline rather than a wrong one.
  const tree = workingTree();

  /** Every Tier 1 failure this run met, printed together at the end: a red in one stage must not hide the next. */
  const failed: string[] = [];
  /** The test files that failed, so a red run can hand the next one its smallest starting set. */
  const failedTests = new Set<string>();
  // A retry of unchanged bytes re-runs what could have been transient and nothing else. When the red run named no test
  // file — a browser fixture, a sweep, the consumer smoke — there is no suite to re-run, and the stages below decide for
  // themselves whether they run.
  const retryTests = sameTree ? (last?.failed ?? []) : null;
  const skipTests = retryTests !== null && retryTests.length === 0;
  // The checks that read the whole tree cannot say anything new about bytes they have already read: a retry of an
  // unchanged tree runs its failures, and nothing else (docs/testing.md, "Once per commit").
  if (!sameTree) {
    if (staticChecks() !== 0) failed.push('static checks');
    if (typecheck() !== 0) failed.push('the type check');
  }
  // The same lint test:release runs, over the files this change touches: a lint error must not reach master through a
  // run that checked types but never linted (one did: the drawer's `react-hooks/refs`, b54c5d7b).
  const lintFiles = lintTargets(present);
  if (lintFiles.length && run(`lint: eslint on ${lintFiles.length} changed file${lintFiles.length === 1 ? '' : 's'}`, bin('eslint'), [...lintFiles, '--ignore-pattern', '.meridian/']) !== 0) failed.push('the lint check');

  // The selection: every changed test and source file is a filter, and so is every test whose source names the path.
  // A document has no import edge; neither does a script a test execs or a config it reads — `vitest related`'s import
  // graph selected neither, so a change to `scripts/brand.ts` could leave `cli-brand-atlas-config` unrun.
  const filters = new Set<string>();
  for (const f of present) {
    if (isTestFile(f) || isCode(f)) filters.add(f);
    for (const t of testsNaming(f)) filters.add(t);
  }
  // Every file the run before this one failed, whether or not this change reaches it: the failures are the point, and a
  // test the fix does not touch must still be proven.
  for (const f of last?.failed ?? []) if (fs.existsSync(path.join(ROOT, f))) filters.add(f);
  // A deleted source file has no importers to compute: an import graph that cannot see a change is not evidence that
  // nothing needs checking, so the whole tier runs. A deleted test is gone, and has nothing to run.
  const deletedCode = deleted.some((f) => isCode(f) && !isTestFile(f));
  // The paths a Tier 1 test may reach. A Tier 2 performance file is left out: its change is what test:t2 adds, and a
  // change to it is not evidence that the Tier 1 suite should run whole.
  const liveCode = [...present, ...deleted.filter((f) => !isTestFile(f))].filter((f) => isCode(f) && !isTier2(f));

  // Only documents no test names changed: no test reads them, and that is a complete answer rather than a reason to run
  // everything. A Tier 2 change still leaves the marker alone, so test:t2 is not skipped by a Tier 1 run.
  if (changed.length && !liveCode.length && !filters.size) {
    const tier2Left = withTier2 ? false : pendingTier2(changed, present, deleted);
    if (!tier2Left) recordGreen();
    console.log(`test:${tier}: no test is affected (${where})`);
    return 0;
  }

  const runRelated = filters.size > 0;
  // The whole tier runs when a deleted source file's importers cannot be computed, or when no selected test reached a
  // changed code file at all. Both are decided below, after the related run reports what it selected.

  let first = skipTests
    ? { status: 0, files: 0, tests: 0, failed: [] as string[] }
    : runRelated
      ? vitest('related', [...filters], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests related to the change`)
      : vitest('run', [], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests (nothing identifies a smaller set)`);

  if (first.status !== 0) failed.push(`the tests affected by the change`);
  for (const f of first.failed) failedTests.add(f);

  // A deleted source file, or a code change no test reaches, runs the whole tier: the import graph is not evidence that
  // nothing needs checking. A related run that failed has already said what it could not prove; the whole tier still runs.
  const uncovered = deletedCode || (first.status === 0 && runRelated && first.files === 0 && liveCode.length > 0);
  if (uncovered && runRelated) {
    console.log(`test:${tier}: ${deletedCode ? 'a deleted source file' : 'no test reaches the changed code'}, so the whole tier runs`);
    first = vitest('run', [], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests (whole tier)`);
    if (first.status !== 0) failed.push('a test in the whole tier');
    for (const f of first.failed) failedTests.add(f);
  }

  // The browser fixtures are outside the main run; they run whole when a script, a journey or their own files changed,
  // and whenever the whole tier ran.
  const deepNeeded = hasDeep() && (!runRelated || uncovered || affectsDeep(changed));
  let deepRan = !deepNeeded;
  if (deepNeeded) {
    const deep = deepTests('Tier 1 browser-fixture tests (tests/deep-*)');
    deepRan = deep.ran;
    if (deep.status !== 0) failed.push(`a browser-fixture test affected by ${where}`);
  }

  // The whole tier ran when nothing identified a smaller set (a fresh clone) or no test reached the changed code.
  const ranWhole = !runRelated || uncovered;

  // The browser suites are Tier 2: test:t2 runs them when a change can alter what a page draws or a control does, and
  // the 20-sample protocol where CI is true. test:t1 never runs them, and says so by leaving the marker alone.
  const notRun: string[] = [];
  const declared: string[] = [];
  // A machine with no Chrome cannot run the browser fixtures: that is missing evidence, reported as not run, and a run
  // that leaves it out is never "every check passed".
  notRun.push(...deepBrowserNotRun(deepNeeded, deepRan));
  let browserTier2: Value[] = [];
  let browserReported: string[] = [];
  if (withTier2 && (ranWhole || touchesBrowserAll(changed))) {
    const perf = process.env.CI === 'true' && ranWhole;
    clearParts(ROOT);
    const r = await browser(perf ? 'fn,perf' : 'fn');
    browserTier2 = r.tier2;
    browserReported = r.reported.map((s) => `browser suites (${s})`);
    if (!r.ok) failed.push('a browser suite');
    notRun.push(...r.notRun.map((s) => `browser suites (${s})`));
    declared.push(...r.declared.map((s) => `browser suites (${s})`));
    for (const d of declared) console.log(`not run (declared by the project's configuration): ${d}`);
  }

  // The consumer path a change to cli/, the update flow or a check owes before it is pushed: the same smoke the scheduled
  // run and the release drive, with CI's flags. Its failure is Tier 1 — an adopter walks it.
  // Meridian's own repository only: a project made from it has no cli/, and its scripts/ changes are the release's
  // managed files, not a release being prepared.
  const smokeKind = withTier2 ? consumerSmokeKind({ root: ROOT, changed }) : null;
  if (smokeKind) {
    const t = Date.now();
    if (consumerSmoke(smokeKind) !== 0) failed.push(`the consumer smoke (${smokeKind})`);
    const minutes = (Date.now() - t) / 60000;
    if (minutes > 15) console.log(`warn test:${tier}: the consumer smoke took ${minutes.toFixed(1)} min, past the 15-minute line for a per-change run`);
  }
  const overBudget = withTier2 ? [...(await reportTier2(browserTier2)), ...browserReported] : [];

  // test:t2 never judges a time: the timed suites belong to test:release, which alone runs them on a quiet machine.
  if (withTier2) console.log('not run timed browser suites: test:release runs them on a quiet machine');
  // A Tier 1 run proves nothing about a Tier 2 change: the marker advances only when this run covered every change.
  const tier2Left = withTier2 ? false : ranWhole || pendingTier2(changed, present, deleted);
  const pending = tier2Left || !deepRan || notRun.length > 0;
  if (!failed.length && !pending && !sameTree) {
    recordGreen();
    // A green run leaves nothing for the next one to retry.
    clearLastRun(ROOT);
  }
  else if (notRun.length) console.log(`test:${tier}: the marker is not advanced, because ${notRun.length} check${notRun.length === 1 ? '' : 's'} did not run`);
  else if (!failed.length) console.log(`test:${tier}: the marker is not advanced, because a Tier 2 check did not run; pnpm test:t2 covers it`);
  // The retry of an unchanged tree is reported whatever it found: a pass here answers no cause, so it is flaky, not green.
  if (sameTree) console.log(`test:${tier}: this run is a retry of the tree that failed, not of a fix: ${failed.length ? 'it failed again, so the cause is in its output' : 'it passed, which reports a flaky check and does not advance the marker'}`);
  // A red run hands the next one its failures and the tree they were proven on, so a fix runs the smallest set that proves it.
  // A run that could not name its tree records nothing: a baseline that is not this run's would select the wrong set.
  if (failed.length) {
    if (tree) writeLastRun(ROOT, { tree, failed: [...failedTests].sort(), retries: sameTree ? retryNumber(last)! : 0 });
    else clearLastRun(ROOT);
  }
  if (!first.files) console.log(`test:${tier}: no test is affected (${where})`);
  const { line, exit } = summaryLine({ command: `test:${tier}`, failed, notRun, declared, overBudget, covers: tier === 't1' ? 'every Tier 1 check' : 'every Tier 1 check and the Tier 2 files this run covers', ...(first.files ? { files: first.files, tests: first.tests } : {}) });
  console.log(line);
  return exit;
}

/** Whether the change affects a Tier 2 check: the performance convention, or anything the browser suites walk. */
function pendingTier2(changed: string[], present: string[], deleted: string[]): boolean {
  return changed.some(isTier2) || [...present, ...deleted].some(touchesBrowser);
}

/** Whether any changed path the browser walks: the per-change test:t2 selection, without the file-convention check. */
function touchesBrowserAll(changed: string[]): boolean {
  return changed.some((f) => touchesBrowser(f) || isDeep(f));
}

/** The stages of `test:release`, one CI job each. */
const STAGES = ['static', 'sweep', 'deep', 'tier2'] as const;
const SWEEPS = ['audit', 'interactions', 'keyboard', 'rest'] as const;

/** A stage's last line and exit: 1 for a failed check, 2 for a check the environment could not run, else 0. */
function stageExit(name: string, failed: string[], notRun: string[], declared: string[], overBudget: string[], counts?: { files: number; tests: number }): number {
  for (const d of declared) console.log(`not run (declared by the project's configuration): ${d}`);
  const { line, exit } = summaryLine({ command: `test:${name}`, failed, notRun, declared, overBudget, covers: 'every check the stage runs', ...(counts ?? {}) });
  console.log(line);
  return exit === 0 && notRun.length ? 2 : exit;
}

/** The static checks, the type check, lint and every Vitest file but the deep tests. */
function stageStatic(): number {
  const failed: string[] = [];
  if (staticChecks() !== 0) failed.push('static checks');
  for (const [label, step] of typeSteps()) if (step() !== 0) failed.push(label);
  const t1 = everyTestFile();
  if (t1.status !== 0) failed.push('the test suite');
  return stageExit('stage static', failed, [], [], [], { files: t1.files, tests: t1.tests });
}

/** A production build, then one function sweep against it; `rest` also runs the route policy after the build. */
async function stageSweep(name: string): Promise<number> {
  const failed: string[] = [];
  const declared: string[] = [];
  const notRun: string[] = [];
  if (productionBuild() !== 0) failed.push('the production build');
  if (name === 'rest') routePolicy(declared, failed);
  clearParts(ROOT);
  const r = await browser('fn', true, name);
  if (!r.ok) failed.push('a browser suite');
  notRun.push(...r.notRun.map((s) => `browser suites (${s})`));
  declared.push(...r.declared.map((s) => `browser suites (${s})`));
  return stageExit(`stage sweep ${name}`, failed, notRun, declared, []);
}

/** The deep tests the changes since `since` reach, optionally one part of them; none reached is a decision, not a skip. */
function stageDeep(since: string, part: { i: number; n: number } | null): number {
  const list = git(['diff', '--name-only', `${since}..HEAD`]);
  if (!list.ok) { console.error(`test-run: --since ${since} does not resolve to a range ending at HEAD`); return 1; }
  const plan = deepPlan(list.out.split('\n').filter(Boolean), deepReach);
  let files = plan.all ? deepFiles() : plan.files;
  if (part) files = deepPart(files, part.i, part.n);
  if (!files.length) {
    console.log(`not run: tests/deep-* (no change since ${since} reaches them)`);
    return 0;
  }
  console.log(`deep tests${part ? ` (part ${part.i}/${part.n})` : ''}: ${files.join(', ')}`);
  const deep = deepTests('Tier 1 browser-fixture tests (tests/deep-*)', files);
  return stageExit('stage deep', deep.status !== 0 ? ['the browser-fixture tests'] : [], deep.ran ? [] : ['browser-fixture tests (tests/deep-*) (no Chrome)'], [], []);
}

/** A build, then the timed and perf suites against it and the size values, recorded. Reports; always exits 0. */
async function stageTier2(): Promise<number> {
  if (productionBuild() !== 0) console.log('warn test:stage tier2: the production build failed, so no value was measured');
  clearParts(ROOT);
  const r = await browser('timed,perf', true);
  const overBudget = [...(await reportTier2(r.tier2)), ...r.reported.map((s) => `browser suites (${s})`)];
  // A browser run that could not finish is a red of this stage and never "every check the stage runs passed": the run
  // measured nothing, and the release's whole Tier 2 table would go missing behind a green job.
  return stageExit('stage tier2', r.ok ? [] : ['the browser suites'], r.notRun.map((s) => `browser suites (${s})`), [], overBudget);
}

function stageMain(argv: string[]): Promise<number> | number {
  const [name, ...rest] = argv;
  if (!STAGES.includes(name as (typeof STAGES)[number])) {
    console.error(`test-run: unknown stage "${name ?? ''}"; the stages are ${STAGES.join(', ')}`);
    return 1;
  }
  if (name === 'static' || name === 'tier2') {
    if (rest.length) { console.error(`test-run: stage ${name} takes no arguments`); return 1; }
    return name === 'static' ? stageStatic() : stageTier2();
  }
  if (name === 'sweep') {
    if (rest.length !== 1 || !SWEEPS.includes(rest[0] as (typeof SWEEPS)[number])) {
      console.error(`test-run: stage sweep takes one of ${SWEEPS.join(', ')}`);
      return 1;
    }
    return stageSweep(rest[0]!);
  }
  const sinceAt = rest.indexOf('--since');
  const partAt = rest.indexOf('--part');
  const since = sinceAt >= 0 ? rest[sinceAt + 1] : undefined;
  const partText = partAt >= 0 ? rest[partAt + 1] : undefined;
  const part = partText === undefined ? null : /^(\d+)\/(\d+)$/.exec(partText);
  const known = rest.length === (sinceAt >= 0 ? 2 : 0) + (partAt >= 0 ? 2 : 0);
  if (!since || since.startsWith('--') || !known || (partText !== undefined && (!part || Number(part[1]) < 1 || Number(part[1]) > Number(part[2])))) {
    console.error('test-run: stage deep takes --since <ref> and optionally --part i/n (1 <= i <= n)');
    return 1;
  }
  if (!git(['rev-parse', '--verify', '--quiet', `${since}^{commit}`]).ok) {
    console.error(`test-run: --since ${since} does not name a commit`);
    return 1;
  }
  return stageDeep(since, part ? { i: Number(part[1]), n: Number(part[2]) } : null);
}

if (import.meta.main) {
  const tier = process.argv[2];
  const extra = process.argv.slice(3);
  if (tier === 'stage') process.exit(await stageMain(extra));
  if (extra.length || !['t1', 't2', 'release'].includes(tier ?? '')) {
    console.error('test-run: takes one of t1, t2 or release, and nothing else. Use pnpm test:t1, pnpm test:t2 or pnpm test:release.');
    process.exit(1);
  }
  process.exit(tier === 'release' ? await release() : await affected(tier as 't1' | 't2'));
}

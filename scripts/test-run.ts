/**
 * The three test commands, and the only test commands. Each takes no arguments from the person or the agent; it is the
 * tool that picks the tests.
 *
 *   pnpm test:t1        the Tier 1 tests affected by the changes since the last green run
 *   pnpm test:t2        the same plus the Tier 2 tests those changes affect (the affected Tier 1 tests included)
 *   pnpm test:release   every Tier 1 and Tier 2 test, once, with lint, the type check and the browser standard
 *
 * "Since the last green run" is the marker in out/last-green, which a command writes after a passing run; out/ is
 * gitignored. A missing marker falls back to the diff against master, and a checkout with neither marker nor a diff
 * (master itself, a fresh CI clone) runs the whole tier, because no green run is evidence for it.
 *
 * Selection is the tool's: Vitest's `related` reads the import graph and runs the tests that reach a changed file; a
 * changed test file is run itself. A tier is a convention over files, never a list someone keeps by hand:
 *
 *   Tier 1: every test under tests/ that the Vitest config collects.
 *   Tier 2: the repo's `tests/deep-*.test.ts(x)` (the large browser-fixture suites), any `*.perf.test.ts(x)`, and
 *           the timed browser suite (`scripts/verify.ts --timed`).
 *
 * A changed path that reaches no test at all runs the whole tier: an import graph that knows nothing about a file is
 * not evidence that nothing needs testing. A deleted file is a change too. A documents- or workflows-only change runs
 * the guideline test that reads them.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bin } from './lib/bin.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const MARKER = path.join(ROOT, 'out', 'last-green');
const REPORT = path.join(ROOT, 'out', 'test-run.json');

/** The Tier 2 convention: the repo's large browser-fixture suites, and the performance tests of any repo. */
const TIER2 = [/^tests\/deep-[^/]*\.test\.tsx?$/, /\.perf\.test\.tsx?$/];

/** Whether a project path is a Tier 2 test. */
export const isTier2 = (file: string): boolean => TIER2.some((rule) => rule.test(file));

/** The paths whose change means any test may be affected: a docs-only change is not one of them. */
const CODE = /^(app|src|scripts|cli|tests|tokens|journeys|next\.config\.|package\.json$|pnpm-lock\.yaml$|tsconfig|vitest\.config|eslint\.config)/;

/** A path that changes what runs: a test is selected for it, or the whole tier falls back to running. */
export const isCode = (file: string): boolean => CODE.test(file);

/**
 * The guideline test reads these documents and workflows, so a change to one of them affects it. A
 * documents-only change runs that test rather than reporting that no test is affected.
 */
const GUIDELINE = 'tests/testing-guideline.test.ts';
const GUIDELINE_PATH = /^(README\.md|CONTRIBUTING\.md|AGENTS\.md|docs\/brief\.md|\.github\/workflows\/)/;

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

/** The files whose bytes differ from `base`, committed or not, with the untracked ones. A deleted file is a change. */
function changedSince(base: string): string[] {
  const tracked = git(['diff', '--name-only', '--diff-filter=ACMRD', base, '--']).out.split('\n').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard']).out.split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
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
function report(): { files: number; tests: number } | null {
  try {
    // `numTotalTestSuites` counts every `describe` too (850 against 185 files on this repository); a file is an entry
    // in `testResults`, which is the count the line means.
    const j = JSON.parse(fs.readFileSync(REPORT, 'utf8')) as { numTotalTestSuites?: number; numTotalTests?: number; testResults?: unknown[] };
    return { files: j.testResults?.length ?? j.numTotalTestSuites ?? 0, tests: j.numTotalTests ?? 0 };
  } catch { return null; }
}

function vitest(mode: 'related' | 'run', filters: string[], withTier2: boolean, label: string): { status: number; files: number; tests: number } {
  try { fs.rmSync(REPORT, { force: true }); } catch { /* no stale report */ }
  const status = run(label, bin('vitest'), vitestArgs(mode, filters, withTier2));
  const r = report() ?? { files: 0, tests: 0 };
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
  for (const [label, [script, ...args]] of steps) if (run(label, process.execPath, [script, ...args]) !== 0) return 1;
  return 0;
}

/** The Chrome every browser suite opens (scripts/lib/chrome.ts): `CHROME`, or the platform's usual install. */
const chromeAvailable = (): boolean => {
  const chrome = process.env.CHROME ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
  if (!fs.existsSync(chrome)) return false;
  return spawnSync(chrome, ['--version'], { encoding: 'utf8' }).status === 0;
};

/** The large browser-fixture suites cannot run without Chrome; say so, never that they passed. */
function deepTests(label: string): number {
  if (!chromeAvailable()) {
    console.log(`not run ${label}: no Chrome (CHROME is unset and no browser was found)`);
    return 0;
  }
  return run(label, bin('vitest'), ['run', 'tests/deep-', '--no-file-parallelism']);
}

const hasDeep = (): boolean => fs.existsSync(path.join(ROOT, 'tests')) && fs.readdirSync(path.join(ROOT, 'tests')).some((f) => f.startsWith('deep-') && /\.test\.tsx?$/.test(f));

/** The Tier 2 files that no import graph selects: `tests/deep-*` runs whole when a script or a journey changed. */
const affectsDeep = (files: string[]): boolean => files.some((f) => /^(scripts|journeys)\//.test(f) || /^tests\/deep-/.test(f));

/** The change that reaches the browser suites: shared components, the shell, views, logic, the data layer, styles or tokens. */
const affectsBrowser = (files: string[]): boolean =>
  files.some((f) => /^(src\/components|src\/styles|src\/views|src\/logic|src\/lib|src\/data|app\/|tokens\/|journeys\/)/.test(f));

/**
 * The suites whose failure is a Tier 2 performance verdict: the navigation's budgets, a product's own checks that judge
 * a time, and Web Vitals. Since the standard of 2026-11-10 such a result is reported and compared against earlier
 * releases, and never fails a run. Every other suite `--timed` runs is functional — the live-data checks included — and
 * still fails.
 */
const TIER2_SUITES = new Set(['timing', 'timedChecks', 'vitals']);

/**
 * Whether a failed browser standard failed only on Tier 2 performance. `verify.ts` ends on a `coverage:` line naming the
 * suites that failed; a run that ends without that line did not complete — a crash, a Chrome that would not start, a
 * suite that wedged — and is a failure whatever it printed.
 */
const onlyTier2 = (failed: string[] | null): boolean => failed !== null && failed.length > 0 && failed.every((s) => TIER2_SUITES.has(s));

/**
 * The browser standard, from `scripts/verify.ts`: it builds and serves the app against the fake gateway, then runs the
 * audit, the presses, the keyboard walk, the assistant walk-through and the persona walks (`--full`) and the timed suites
 * (`--timed`). The three test commands are the only entry points; this is coverage they call, never a command a person
 * names. Without Chrome it is reported not run, never passed. Its output streams as it arrives while being kept, because
 * the coverage line it ends on is what says which suites failed.
 */
function browserStandard(flags: string[], label: string): Promise<{ status: number; failed: string[] | null }> {
  if (!chromeAvailable()) {
    console.log(`not run ${label}: no Chrome (CHROME is unset and no browser was found)`);
    return Promise.resolve({ status: 0, failed: null });
  }
  return new Promise((resolve) => {
    const t = Date.now();
    const child = spawn(process.execPath, ['scripts/verify.ts', ...flags], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d: Buffer) => { out += String(d); process.stdout.write(d); });
    child.on('close', (code) => {
      const status = code ?? 1;
      console.log(`${status === 0 ? 'ok  ' : 'FAIL'} ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
      const coverage = out.split('\n').filter((l) => l.startsWith('coverage: ')).at(-1);
      const listed = coverage ? /\bfailed: ([^;]+)/.exec(coverage) : null;
      resolve({ status, failed: coverage ? (listed ? listed[1].split(',').map((s) => s.trim()).filter(Boolean) : []) : null });
    });
  });
}

async function release(): Promise<number> {
  const notRun: string[] = [];
  if (staticChecks() !== 0) {
    console.log('test:release: FAIL: a static check failed');
    return 1;
  }
  const steps: [string, () => number][] = [
    ['types: route types', () => run('types: route types', bin('next'), ['typegen'])],
    ['types: tsc --noEmit', () => run('types: tsc --noEmit', bin('tsc'), ['--noEmit'])],
    ['lint: eslint .', () => run('lint: eslint .', bin('eslint'), ['.', '--ignore-pattern', '.meridian/'])],
  ];
  for (const [, step] of steps) if (step() !== 0) return 1;

  // Every Tier 1 and Tier 2 test, once: `withTier2` is what keeps `*.perf.test.*` out of `test:t1`, and a release is
  // the one run that must hold them.
  const tiers = vitest('run', [], true, 'tier 1 and tier 2 tests');
  if (tiers.status !== 0) {
    console.log('test:release: FAIL: a Tier 1 or Tier 2 test failed');
    return 1;
  }
  if (hasDeep()) {
    if (chromeAvailable()) {
      if (run('tier 2 tests (tests/deep-*)', bin('vitest'), ['run', 'tests/deep-', '--no-file-parallelism']) !== 0) {
        console.log('test:release: FAIL: a Tier 2 test failed');
        return 1;
      }
    } else {
      console.log('not run tier 2 tests (tests/deep-*): no Chrome (CHROME is unset and no browser was found)');
      notRun.push('tier 2 tests (tests/deep-*) (no Chrome)');
    }
  }
  // The browser standard is the coverage the old release gate had: the audit, the presses, the keyboard walk, the
  // assistant walk-through and the persona walks are Tier 1 functional and accessibility checks; the timed suites are
  // Tier 2. `verify.ts` builds and serves the app against the fake gateway itself, so its build, route policy and size
  // checks replace the separate steps below when Chrome runs. Without Chrome it is reported not run, never passed.
  if (chromeAvailable()) {
    // Two passes, because `--as` is refused beside `--timed`: the complete tier with each persona, then the timed tier.
    // Only the first blocks outright. Since the standard of 2026-11-10 a Tier 2 performance result (the timing budgets,
    // a product's own timed checks and Web Vitals) is reported and compared against earlier releases; it never fails a
    // run. The live-data checks `--timed` also runs are functional, and the coverage line is what tells them apart.
    const full = await browserStandard(['--full', '--as', 'superadmin,member'], 'browser standard (Tier 1, with the persona walk)');
    if (full.status !== 0) {
      console.log('test:release: FAIL: the browser standard failed');
      return 1;
    }
    const timed = await browserStandard(['--timed'], 'browser standard (Tier 2, timed)');
    if (timed.status !== 0) {
      if (!onlyTier2(timed.failed)) {
        console.log('test:release: FAIL: the browser standard failed');
        return 1;
      }
      console.log(`test:release: Tier 2 performance did not hold (${timed.failed!.join(', ')}); reported above and compared against earlier releases, not failing this run`);
    }
  } else {
    console.log('not run browser standard: no Chrome (CHROME is unset and no browser was found)');
    notRun.push('browser standard (no Chrome)');
    // The Tier 1 build checks still run: the routes are declared as their policy says, and each route's first load is
    // within its budget. The HTML sizes need a served build, so they are reported not run rather than passed.
    if (run('build: next build', bin('next'), ['build'], { ...process.env, MERIDIAN_TYPES_CHECKED: '1' }) !== 0
      || run('route policy', process.execPath, ['scripts/route-policy.ts']) !== 0
      || run('sizes: first-load', process.execPath, ['scripts/sizes.ts']) !== 0) {
      console.log('test:release: FAIL: a Tier 1 build check failed');
      return 1;
    }
    notRun.push('sizes: html (no served build)');
  }
  // The Postgres code the skill's references hand a team lives outside tests/ and needs services: run it only where the
  // owner supplied them, and say it did not run otherwise, never that it passed.
  const missing = ['MERIDIAN_POSTGRES_URL', 'MERIDIAN_POOLER_URL', 'MERIDIAN_PG'].filter((k) => !process.env[k]);
  const postgresConfig = path.join(ROOT, 'scripts', 'fixtures', 'postgres', 'vitest.config.ts');
  if (fs.existsSync(postgresConfig)) {
    if (missing.length) {
      console.log(`not run tier 2 tests (Postgres): ${missing.join(', ')} is not set`);
      notRun.push(`tier 2 tests (Postgres) (${missing.join(', ')} not set)`);
    }
    else if (run('tier 2 tests (Postgres)', bin('vitest'), ['run', '--config', postgresConfig]) !== 0) {
      console.log('test:release: FAIL: a Tier 2 Postgres test failed');
      return 1;
    }
  }
  recordGreen();
  console.log(notRun.length
    ? `test:release: every check that ran passed; not run: ${notRun.join(', ')} (${tiers.files} test files, ${tiers.tests} tests in Tier 1 and Tier 2)`
    : `test:release: every Tier 1 and Tier 2 test passed, lint passed, types check (${tiers.files} test files, ${tiers.tests} tests in Tier 1 and Tier 2)`);
  return 0;
}

async function affected(tier: 't1' | 't2'): Promise<number> {
  const { ref, from } = baseline();
  const changed = changedSince(ref);
  const withTier2 = tier === 't2';
  const where = `${changed.length} changed file${changed.length === 1 ? '' : 's'} since ${from}`;

  // Nothing changed and a green run is recorded: there is nothing to prove again.
  const marker = fs.existsSync(MARKER);
  if (!changed.length && marker) {
    console.log(`test:${tier}: nothing changed since the last green run`);
    return 0;
  }

  if (staticChecks() !== 0) {
    console.log(`test:${tier}: FAIL: a static check failed`);
    return 1;
  }

  const onDisk = changed.filter((f) => fs.existsSync(path.join(ROOT, f)));
  const deleted = changed.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  // A deleted file is a change, but no import graph can be asked about a path that no longer exists.
  const deletedCode = deleted.some(isCode);
  const guidelineNeeded = changed.some((f) => GUIDELINE_PATH.test(f));
  const filters = onDisk.filter((f) => !/\.md$/.test(f) && !GUIDELINE_PATH.test(f));

  // Only documents or workflows changed. No test reads them except the guideline test, which reads the named documents
  // and both workflows; running it is the complete answer, and its absence would otherwise be reported as a green run
  // that checked nothing.
  if (changed.length && !filters.length && !deletedCode) {
    if (guidelineNeeded && run('guideline tests', bin('vitest'), ['run', GUIDELINE]) !== 0) {
      console.log(`test:${tier}: FAIL: the guideline test failed`);
      return 1;
    }
    recordGreen();
    console.log(guidelineNeeded
      ? `test:${tier}: the guideline test (${where})`
      : `test:${tier}: no test is affected (${where})`);
    return 0;
  }

  const runRelated = filters.length > 0 && !deletedCode;
  const first = deletedCode
    ? vitest('run', [], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests (a deleted file reaches no import graph)`)
    : runRelated
      ? vitest('related', filters, withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests related to the change`)
      : vitest('run', [], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests (nothing identifies a smaller set)`);

  if (first.status !== 0) {
    console.log(`test:${tier}: FAIL: a test affected by ${where} failed`);
    return 1;
  }

  // A code change no test reaches runs the whole tier: the import graph is not evidence that nothing needs checking.
  const uncovered = runRelated && first.files === 0 && changed.some(isCode);
  // The large browser-fixture suites are outside the main run; they run whole when a script, a journey or their own files
  // changed, and whenever the whole tier ran.
  const deepNeeded = withTier2 && hasDeep() && (!runRelated || uncovered || affectsDeep(changed));
  const deepOk = (): boolean => {
    if (!deepNeeded) return true;
    if (deepTests('tier 2 tests (tests/deep-*)') === 0) return true;
    console.log(`test:${tier}: FAIL: a Tier 2 test affected by ${where} failed`);
    return false;
  };
  // Everything after the Vitest run: the large browser-fixture suites, the Tier 2 browser checks a shared change
  // reaches, and the guideline test when a document or workflow changed.
  const tail = async (): Promise<boolean> => {
    if (!deepOk()) return false;
    // A fresh CI checkout has no marker and no diff: `changed` is empty and there is no change to
    // be "affected by", but the scheduled Tier 2 run must still exercise the timed suite. The
    // early return above already handled a marker with nothing new, so an empty `changed` here is
    // the no-marker case.
    const wholeCheckout = changed.length === 0;
    // Tier 2 performance is reported, never failing (the standard of 2026-11-10); the live-data checks the timed pass also
    // runs are functional, and the coverage line is what tells them apart.
    if (withTier2 && (wholeCheckout || affectsBrowser(changed))) {
      const timed = await browserStandard(['--timed'], 'tier 2 browser checks (--timed)');
      if (timed.status !== 0) {
        if (!onlyTier2(timed.failed)) {
          console.log(`test:${tier}: FAIL: a browser check affected by ${where} failed`);
          return false;
        }
        console.log(`test:${tier}: Tier 2 performance did not hold (${timed.failed!.join(', ')}); reported above and compared against earlier releases, not failing this run`);
      }
    }
    if (guidelineNeeded && run('guideline tests', bin('vitest'), ['run', GUIDELINE]) !== 0) {
      console.log(`test:${tier}: FAIL: the guideline test failed`);
      return false;
    }
    return true;
  };
  if (uncovered) {
    console.log(`test:${tier}: no test reaches the changed code, so the whole tier runs`);
    const all = vitest('run', [], withTier2, `tier ${withTier2 ? '2 and 1' : '1'} tests (whole tier)`);
    if (all.status !== 0) {
      console.log(`test:${tier}: FAIL: a test in the whole tier failed`);
      return 1;
    }
    if (!(await tail())) return 1;
    recordGreen();
    console.log(`test:${tier}: ${all.files} test files, ${all.tests} tests (whole tier, ${where})`);
    return 0;
  }

  if (!(await tail())) return 1;
  recordGreen();
  console.log(first.files
    ? `test:${tier}: ${first.files} test file${first.files === 1 ? '' : 's'}, ${first.tests} test${first.tests === 1 ? '' : 's'} (${where})`
    : `test:${tier}: no test is affected (${where})`);
  return 0;
}

if (import.meta.main) {
  const tier = process.argv[2];
  const extra = process.argv.slice(3);
  if (extra.length || !['t1', 't2', 'release'].includes(tier ?? '')) {
    console.error('test-run: takes one of t1, t2 or release, and nothing else. Use pnpm test:t1, pnpm test:t2 or pnpm test:release.');
    process.exit(1);
  }
  process.exit(tier === 'release' ? await release() : await affected(tier as 't1' | 't2'));
}

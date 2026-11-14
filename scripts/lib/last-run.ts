/**
 * The run before this one, when it ended red: where the next `test:t1` or `test:t2` starts.
 *
 * A red run leaves `out/last-run.json` holding the tree it ran on, the test files it failed and how many times that same
 * tree has already been retried. The next run diffs the working tree against that tree, so a fix selects the failures it
 * answers and the tests its own change reaches, instead of everything since the last green run: the smallest set that
 * proves the fix and protects what it touches (`docs/testing.md`, "Once per commit").
 *
 * It also carries the rule a red run must not escape: a tree that has not changed may be retried once, and a run that
 * passes then is reported as a retry and never advances the green marker, because a pass with no cause found is flaky and
 * a flaky Tier 1 check is a red (`docs/testing.md`, "Fixed means", "Flaky is red").
 */
import fs from 'node:fs';
import path from 'node:path';

export const LAST_RUN = 'out/last-run.json';

/** A run that ended red: the tree it ran on, the test files it failed, and the unchanged-tree retries it has had. */
export type LastRun = { tree: string; failed: string[]; retries: number };

const isPath = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !path.isAbsolute(v) && !v.split(/[\\/]/).includes('..');

/**
 * The record of the last run when it was red, or null. A record that is missing, unreadable, or holds no usable tree or
 * path list is null: a malformed record must never widen a selection or crash the gate it is meant to shorten.
 */
export function readLastRun(root: string): LastRun | null {
  let text: string;
  try { text = fs.readFileSync(path.join(root, LAST_RUN), 'utf8'); } catch { return null; }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const { tree, failed, retries } = parsed as Partial<LastRun>;
  if (typeof tree !== 'string' || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(tree)) return null;
  if (!Array.isArray(failed) || !failed.every(isPath)) return null;
  return { tree, failed: [...new Set(failed)], retries: Number.isInteger(retries) && (retries as number) >= 0 ? (retries as number) : 0 };
}

/** Record a red run, so the next one starts from what it proved. */
export function writeLastRun(root: string, last: LastRun): void {
  const file = path.join(root, LAST_RUN);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(last, null, 2)}\n`);
}

/** Forgetting a red run: a run that ended green calls this first, and so does one that recorded no usable tree. */
export function clearLastRun(root: string): void {
  fs.rmSync(path.join(root, LAST_RUN), { force: true });
}

/** Where the next run begins: the tree the red run proved, so what differs from it is the fix. */
export function retryBaseline(last: LastRun | null): { ref: string; from: 'the run that failed' } | null {
  return last ? { ref: last.tree, from: 'the run that failed' } : null;
}

/**
 * The retry this run of an unchanged tree is, or null when that tree has already been retried. One retry is allowed,
 * because a timeout or a loaded machine is a plausible cause; a second run of the same bytes proves nothing new.
 */
export function retryNumber(last: LastRun | null): number | null {
  if (!last) return 1;
  return last.retries >= 1 ? null : last.retries + 1;
}

/** The test files a Vitest JSON report says failed, repository-relative; a report that cannot be read names none. */
export function failedFilesOf(root: string, report: string): string[] {
  try {
    const j = JSON.parse(fs.readFileSync(report, 'utf8')) as { testResults?: { name?: string; status?: string }[] };
    return (j.testResults ?? [])
      .filter((r) => r.status === 'failed' && typeof r.name === 'string')
      .map((r) => path.relative(root, r.name!).split(path.sep).join('/'))
      .filter(isPath);
  } catch { return []; }
}

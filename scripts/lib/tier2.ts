/**
 * Tier 2 is measured and reported, never a gate (`docs/testing.md`): a suite records what it measured here, and the run
 * ends with one table of each value against the previous release's, flagging what moved beyond the line. The record is
 * `out/perf-record.json`; the history, `scripts/perf-history.json`, holds the last five releases and is what a run compares
 * against. It is not committed or shipped: it travels as a release asset. The release workflow downloads the previous
 * release's `perf-history.json` and uploads the next one, built with `nextHistory`. Without it (a project, or this
 * repository before its first release) the seed is today's budgets.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { byChange, commitsTouching, pageGraph } from './attribution.ts';

/** What a value measures, which decides the line it is flagged against. */
export type Kind = 'timing' | 'second' | 'cls' | 'size';
export type Unit = 'ms' | 's' | 'score' | 'KiB';
export type Value = { check: string; page: string; unit: Unit; value: number; samples?: number[] };
export type ReleaseRecord = { version: string; commit: string; date: string; host: string; rate?: number; values: Value[]; /** The run's own table and by-change section, as printed. */ table?: string[]; byChange?: unknown };
export type History = { releases: ReleaseRecord[] };

export const HISTORY_FILE = 'scripts/perf-history.json';
export const RECORD_FILE = 'out/perf-record.json';
const PARTS_DIR = 'out/tier2';

/** The provisional line, used until three releases have been recorded: a real move, not run-to-run noise. */
export const PROVISIONAL = {
  timing: { pct: 0.25, min: 10 },
  second: { pct: 0.25, min: 0.1 },
  cls: { min: 0.05 },
  size: { pct: 0.05 },
} as const;

/** The measured line once three releases exist: outside mean ± 2 sd, with the spread floored so a steady value cannot flag. */
export const SPREAD = { sd: 2, floor: 0.05, minReleases: 3 } as const;

export const kindOf = (check: string): Kind =>
  check === 'vitals.lcp' ? 'second'
  : check === 'vitals.cls' ? 'cls'
  : check.startsWith('sizes.') ? 'size'
  : 'timing';

/** This repository's budgets as values: the baseline until a release has recorded its own. Never a fixed limit afterwards. */
export type Seed = Record<string, number>;

/** A part one suite recorded this run, before the run merges them into the record. */
export function recordPart(root: string, suite: string, values: Value[]): void {
  if (!values.length) return;
  const dir = path.join(root, PARTS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${suite}.json`), `${JSON.stringify({ suite, values }, null, 1)}\n`);
}

export function clearParts(root: string): void {
  fs.rmSync(path.join(root, PARTS_DIR), { recursive: true, force: true });
}

/** Every part this run recorded, in a stable order. */
export function readParts(root: string): { suite: string; values: Value[] }[] {
  const dir = path.join(root, PARTS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { suite: string; values: Value[] });
}

export function readHistory(root: string): History | null {
  const file = path.join(root, HISTORY_FILE);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as History;
}

/** The history after a release: this release's record first, then the earlier ones, at most five kept. */
export function nextHistory(previous: History | null, record: ReleaseRecord): History {
  return { releases: [record, ...(previous?.releases ?? [])].slice(0, 5) };
}

export function writeRecord(root: string, record: ReleaseRecord): void {
  fs.mkdirSync(path.dirname(path.join(root, RECORD_FILE)), { recursive: true });
  fs.writeFileSync(path.join(root, RECORD_FILE), `${JSON.stringify(record, null, 1)}\n`);
}

/** The seed's value for a check and page: the budget the check is held to today, as a value. */
export function seedFor(seed: Seed, check: string, page: string): number | null {
  const exact = seed[`${check} ${page}`];
  if (exact !== undefined) return exact;
  const byCheck = seed[check];
  return byCheck === undefined ? null : byCheck;
}

export type Row = {
  check: string; page: string; unit: Unit; kind: Kind;
  previous: number | null; now: number;
  mean?: number; spread?: number;
  changePct: number | null;
  flagged: boolean;
  improved: boolean;
  seeded: boolean;
  /** The line it was flagged against, in words. */
  line: string;
};

/** The minimum absolute move a flag needs, for a kind. */
const minMove = (kind: Kind): number => (kind === 'second' ? PROVISIONAL.second.min : kind === 'cls' ? PROVISIONAL.cls.min : PROVISIONAL.timing.min);

/** Every value judged against the previous release and against the spread of the last releases, or the seed. */
export function compare(history: History | null, now: Value[], seed: Seed): { rows: Row[]; baselineVersion: string | null; seeded: boolean } {
  const releases = history?.releases ?? [];
  const latest = releases[0] ?? null;
  const spreadN = Math.min(releases.length, 5);
  const rows: Row[] = now.map((v) => {
    const kind = kindOf(v.check);
    const previous = latest ? latest.values.find((b) => b.check === v.check && b.page === v.page)?.value ?? null : seedFor(seed, v.check, v.page);
    const historyValues = releases.slice(0, spreadN)
      .map((r) => r.values.find((b) => b.check === v.check && b.page === v.page)?.value)
      .filter((x): x is number => x !== undefined);
    const mean = historyValues.length ? historyValues.reduce((a, b) => a + b, 0) / historyValues.length : undefined;
    const sd = historyValues.length > 1 ? Math.sqrt(historyValues.reduce((a, b) => a + (b - mean!) ** 2, 0) / (historyValues.length - 1)) : undefined;
    const from = previous ?? mean ?? null;
    const changePct = from === null || from === 0 ? null : (v.value - from) / from * 100;
    const delta = from === null ? v.value : v.value - from;
    const judgedSpread = releases.length >= SPREAD.minReleases && mean !== undefined && sd !== undefined;
    const floor = judgedSpread ? Math.max(sd!, SPREAD.floor * mean!) : 0;
    const overSpread = judgedSpread && Math.abs(v.value - mean!) > SPREAD.sd * floor;
    const abs = kind === 'size' ? Math.abs(delta) / (from || 1) : Math.abs(delta);
    const flagged = judgedSpread
      ? overSpread && (kind === 'size' ? abs >= PROVISIONAL.size.pct : abs >= minMove(kind))
      : changePct !== null && changePct > 0 && (kind === 'cls' ? abs >= PROVISIONAL.cls.min : kind === 'size' ? changePct >= PROVISIONAL.size.pct * 100 : changePct >= PROVISIONAL.timing.pct * 100 && abs >= minMove(kind));
    const improved = !flagged && changePct !== null
      && (kind === 'cls' ? changePct < 0 && abs >= PROVISIONAL.cls.min
        : kind === 'size' ? changePct <= -PROVISIONAL.size.pct * 100
        : changePct <= -PROVISIONAL.timing.pct * 100 && abs >= minMove(kind));
    const line = judgedSpread
      ? `outside mean ± ${SPREAD.sd} sd of ${historyValues.length} (mean ${round(mean!)} ${v.unit}, spread ${round(floor)}${kind === 'size' ? '' : `; at least ${kind === 'second' ? PROVISIONAL.second.min : kind === 'cls' ? PROVISIONAL.cls.min : PROVISIONAL.timing.min} ${v.unit}`})`
      : `provisional: ${kind === 'size' ? `${PROVISIONAL.size.pct * 100}%` : kind === 'cls' ? `${PROVISIONAL.cls.min}` : `${PROVISIONAL[kind].pct * 100}% and at least ${kind === 'second' ? PROVISIONAL.second.min : PROVISIONAL.timing.min} ${v.unit}`}`;
    return { check: v.check, page: v.page, unit: v.unit, kind, previous, now: v.value, mean, spread: judgedSpread ? floor : undefined, changePct, flagged, improved, seeded: latest === null, line };
  });
  return { rows, baselineVersion: latest?.version ?? null, seeded: latest === null };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The change as a signed percentage, or `new` when there is nothing to compare with. */
export const changeText = (row: Row): string => (row.changePct === null ? 'new' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(1)}%`);

/** The table, sorted by change: what moved most, up or down, first. */
export function table(rows: Row[], baselineVersion: string | null, seeded: boolean): string[] {
  const sorted = [...rows].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const header = `tier 2 (reported, never a gate) — baseline: ${seeded ? "Meridian's seed values, not this project's measurement" : `release ${baselineVersion}`}`;
  return [header, ...sorted.map((r) => `${r.flagged ? 'FLAG' : r.improved ? 'better' : 'ok  '} ${r.check} ${r.page} ${round(r.previous ?? r.now)} → ${round(r.now)} ${r.unit} ${changeText(r)}${r.flagged ? ` — ${r.line}` : ''}`)];
}

/** A baseline older than the release before this one says so, and still reports. */
export function staleBaseline(history: History | null, previousTag: string | undefined): string | undefined {
  if (!history || !previousTag) return undefined;
  const latest = history.releases[0]?.version;
  if (!latest) return undefined;
  const tag = previousTag.replace(/^v/, '');
  return latest === tag ? undefined : `baseline is ${latest}, the previous release is ${previousTag}; the comparison is against an older release`;
}

/** The Meridian version a project runs: the manifest's, else the project's own package.json. Never `cli/`, which a project does not have. */
export function projectVersion(root: string): string {
  try {
    const manifest = path.join(root, '.meridian', 'manifest.json');
    if (fs.existsSync(manifest)) {
      const v = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { version?: string }).version;
      if (v) return v;
    }
    return (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string }).version ?? 'unknown';
  } catch { return 'unknown'; }
}

/**
 * Writes the run's record (out/perf-record.json) and returns the table and by-change lines. It is reporting, not a check:
 * the caller wraps it so nothing it meets — a project that is not a git repository, a missing app folder, an unreadable
 * history — can fail the run.
 */
export async function reportRun({ root, values, seed, previousTag }: { root: string; values: Value[]; seed: Seed; previousTag?: string }): Promise<{ lines: string[]; flagged: string[] }> {
  if (!values.length) return { lines: [], flagged: [] };
  const history = readHistory(root);
  const { rows, baselineVersion, seeded } = compare(history, values, seed);
  const lines = table(rows, baselineVersion, seeded);
  const stale = staleBaseline(history, previousTag);
  if (stale) lines.push(`warn tier2: ${stale}`);
  let section: unknown[] = [];
  try {
    const graph = pageGraph(root);
    const since = history?.releases[0]?.commit;
    const deltas = rows.filter((r) => r.changePct !== null).map((r) => ({ page: r.page.split(' ')[0]!, check: r.check, unit: r.unit, delta: Math.round((r.now - (r.previous ?? r.now)) * 100) / 100 }));
    const commits = since ? commitsTouching(root, since, [...new Set(graph.pages.flatMap((p) => graph.modules.get(p) ?? []))]) : [];
    section = byChange(graph, commits, deltas);
    if (section.length) {
      lines.push("tier 2 by change — each row is the page's delta, not this commit's share:");
      for (const c of section as { sha: string; subject: string; pages: { page: string; shared: boolean }[] }[]) lines.push(`  ${c.sha} ${c.subject}: ${c.pages.map((p) => `${p.page}${p.shared ? ' (shared attribution)' : ''}`).join(', ')}`);
    }
  } catch { /* a project that is not a git repository has no commits to attribute; the table still stands */ }
  writeRecord(root, { version: projectVersion(root), commit: commitOf(root), date: new Date().toISOString(), host: host(), values, table: table(rows, baselineVersion, seeded), byChange: section });
  return { lines, flagged: rows.filter((r) => r.flagged).map((r) => `${r.check} ${r.page}`) };
}

/** The run's report, and never a failure: an error becomes a warn line and the Tier 1 verdict stands. */
export async function reportOrWarn(opts: Parameters<typeof reportRun>[0]): Promise<{ lines: string[]; flagged: string[] }> {
  try { return await reportRun(opts); }
  catch (e) { return { lines: [`warn tier2: could not report: ${(e as Error).message}`], flagged: [] }; }
}

/** The commit the run measured, when the checkout is a repository. */
function commitOf(root: string): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return ''; }
}
const host = (): string => os.hostname();

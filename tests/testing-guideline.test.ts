// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shardOf } from '../scripts/lib/shard.ts';
import config from '../scripts/verify.config.ts';

/**
 * The console's testing guideline and its CI are ZZ Meridian 0.18.0's tiers (Task I-144, AC-8.2 and AC-8.7), as the
 * release's `docs/testing.md` defines them: `--full` is the complete tier and judges no time, `--timed` is the timed
 * tier, and `pnpm verify --full --timed` is the whole standard, run before a release on a quiet machine. `--as` is a run
 * of its own, refused beside `--timed`, and the 20-sample `--perf` protocol runs only in CI, split with `--shard <i>/<n>`.
 *
 * The documents are the README, CONTRIBUTING and the brief; the workflows are `gate.yml`, on every push, and
 * `weekly.yml`, on a schedule. The check lists are read from `scripts/verify.config.ts`, so a check moved from one list
 * to the other fails here until the README names it in its new tier.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
/** A file's text; a workflow that does not exist yet reads as empty. */
const read = (file: string) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');
const DOCUMENTS = ['README.md', 'CONTRIBUTING.md', 'docs/brief.md'];
const GATE = '.github/workflows/gate.yml';
const WEEKLY = '.github/workflows/weekly.yml';

/** verify's two product lists. */
// An entry is a script, or a script with the browsers it holds at once (ZZ Meridian 0.26.0): the script is what a document names.
const BROWSER = (config.browserChecks ?? []).map((c) => (typeof c === 'string' ? c : c.script));
const TIMED = config.timedChecks ?? [];
const RAIL = (config.navigationChecks ?? []).map((c) => c.path);

/**
 * A document's paragraphs, each flattened to one line: a blank line or a list item starts one, and a fenced code
 * block is one, whole.
 */
function paragraphs(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let fenced = false;
  const flush = () => {
    if (current.length) out.push(fenced ? current.join('\n') : current.join(' ').replace(/\s+/g, ' ').trim());
    current = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (fenced) { current.push(line); flush(); fenced = false; } else { flush(); fenced = true; current.push(line); }
      continue;
    }
    if (fenced) { current.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*(?:[-*]|\d+\.) /.test(line)) flush();
    current.push(line);
  }
  flush();
  return out;
}

/**
 * The units a reader takes one claim from: each sentence of prose, each line of a code block, each line of a workflow
 * and each sentence of its comments, consecutive comment lines read as one paragraph.
 */
function claims(file: string, text: string): string[] {
  const sentences = (p: string) => p.split(/(?<=\.)\s+(?=[A-Z`*(])/);
  if (file.endsWith('.yml')) {
    const out: string[] = [];
    let comment: string[] = [];
    const flush = () => { if (comment.length) out.push(...sentences(comment.join(' ').replace(/\s+/g, ' '))); comment = []; };
    for (const line of text.split('\n')) {
      const m = /^\s*#\s?(.*)$/.exec(line);
      if (m) { comment.push(m[1]); continue; }
      flush();
      if (line.trim()) out.push(line);
    }
    flush();
    return out;
  }
  return paragraphs(text).flatMap((p) => (p.startsWith('```') ? p.split('\n') : sentences(p)));
}

/** A workflow's jobs, by name, each the text of its block. */
function jobsOf(yml: string): Record<string, string> {
  const body = yml.slice(yml.search(/^jobs:\s*$/m));
  const parts = body.split(/^ {2}([a-z][\w-]*):\s*$/m);
  const jobs: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) jobs[parts[i]] = parts[i + 1];
  return jobs;
}

/** The script of a job's step named `name`: the `run: |` block beneath it, dedented. */
function stepScript(job: string, name: string): string {
  const from = job.indexOf(`- name: ${name}`);
  if (from < 0) return '';
  const lines = job.slice(from).split('\n');
  const start = lines.findIndex((l) => /^\s*run: \|\s*$/.test(l));
  if (start < 0) return '';
  const indent = /^(\s*)/.exec(lines[start + 1] ?? '')![1].length;
  const script: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && /^(\s*)/.exec(line)![1].length < indent) break;
    script.push(line.slice(indent));
  }
  return script.join('\n');
}

describe('the testing guideline', () => {
  it('never calls --full alone the whole standard, in a document or a workflow', () => {
    for (const file of [...DOCUMENTS, GATE, WEEKLY]) {
      const wrong = claims(file, read(file)).filter((c) => /whole standard/i.test(c) && !/--full --timed/.test(c));
      expect(wrong, file).toEqual([]);
    }
  });

  it('names pnpm verify --full --timed the whole standard and the run before a release, on a quiet machine', () => {
    for (const file of DOCUMENTS) {
      const said = paragraphs(read(file)).filter((p) => p.includes('pnpm verify --full --timed') && /whole standard/i.test(p) && /before (?:a|the|every) release/.test(p) && /quiet machine/.test(p));
      expect(said.length, file).toBeGreaterThan(0);
    }
  });

  it('names --as a run of its own, refused beside --timed', () => {
    for (const file of DOCUMENTS) {
      const said = paragraphs(read(file)).filter((p) => /--as\b/.test(p) && /run of its own/.test(p) && /refused beside `--timed`/.test(p));
      expect(said.length, file).toBeGreaterThan(0);
    }
  });

  it('names --perf a protocol that runs only in CI, split with --shard <i>/<n>', () => {
    for (const file of DOCUMENTS) {
      const said = paragraphs(read(file)).filter((p) => /--perf\b/.test(p) && /only in CI/.test(p) && p.includes('--shard <i>/<n>'));
      expect(said.length, file).toBeGreaterThan(0);
    }
  });

  it("names the README's tiers, each with its command", () => {
    const readme = paragraphs(read('README.md'));
    const tiers: [string, string][] = [['quick', 'pnpm gate'], ['change', 'pnpm verify'], ['complete', 'pnpm verify --full'], ['timed', 'pnpm verify --timed']];
    for (const [tier, command] of tiers) {
      expect(readme.filter((p) => p.startsWith(`- **${tier}**`) && p.includes(`\`${command}\``)), tier).toHaveLength(1);
    }
    // The persona walk and the timed tier's phone.
    expect(readme.some((p) => p.includes('pnpm verify --full --as superadmin,member'))).toBe(true);
    expect(readme.some((p) => p.startsWith('- **timed**') && /benchmark index 800/.test(p))).toBe(true);
  });

  it('names every check the console registers in the tier verify.config.ts registers it in', () => {
    expect(BROWSER.length).toBeGreaterThan(0);
    expect(TIMED.length).toBeGreaterThan(0);
    const readme = paragraphs(read('README.md'));
    const named = (p: string) => [...BROWSER, ...TIMED].filter((c) => p.includes(c));
    const complete = readme.filter((p) => p.startsWith('- **complete**') && p.includes('`browserChecks`') && named(p).length);
    const timed = readme.filter((p) => p.startsWith('- **timed**') && p.includes('`timedChecks`') && named(p).length);
    expect(complete).toHaveLength(1);
    expect(timed).toHaveLength(1);
    expect(BROWSER.filter((c) => !complete[0].includes(c)), 'browserChecks the complete tier does not name').toEqual([]);
    expect(TIMED.filter((c) => !timed[0].includes(c)), 'timedChecks the timed tier does not name').toEqual([]);
    expect(TIMED.filter((c) => complete[0].includes(c)), 'timedChecks the complete tier names').toEqual([]);
    expect(BROWSER.filter((c) => timed[0].includes(c)), 'browserChecks the timed tier names').toEqual([]);
    // Wherever else a document names a registered check, it names the list the check is in.
    for (const file of DOCUMENTS) {
      for (const p of paragraphs(read(file))) {
        for (const c of named(p)) expect(p, `${file}: ${c}`).toContain(TIMED.includes(c) ? '`timedChecks`' : '`browserChecks`');
      }
    }
  });

  it("lists CONTRIBUTING's two runs in its commands block, each with when it runs", () => {
    const block = paragraphs(read('CONTRIBUTING.md')).find((p) => p.startsWith('```') && p.includes('pnpm verify --full --timed')) ?? '';
    for (const command of ['pnpm verify --full --as superadmin,member', 'pnpm verify --full --timed']) {
      const line = block.split('\n').find((l) => l.startsWith(`${command} `)) ?? '';
      expect(line, command).toMatch(/\s#\s\S/);
    }
  });
});

describe('the CI', () => {
  it('runs on push lint, then the jobs full and timed, each on its own runner and keeping out/verify.txt', () => {
    const yml = read(GATE);
    expect(yml).toMatch(/^on:\n {2}push:\n {4}branches: \[master\]$/m);
    const jobs = jobsOf(yml);
    expect(Object.keys(jobs).sort()).toEqual(['full', 'lint', 'timed']);
    expect(jobs.lint).toMatch(/^\s*- run: pnpm run lint$/m);
    const commands = { full: 'pnpm verify --full --as superadmin,member', timed: 'pnpm verify --timed' };
    const artifacts: string[] = [];
    for (const [name, command] of Object.entries(commands)) {
      const job = jobs[name];
      expect(job, name).toMatch(/^ {4}needs: lint$/m);
      expect(job, name).toMatch(/^ {4}runs-on: \S+$/m);
      expect(job, name).toMatch(/^ {6}CHROME: \/usr\/bin\/google-chrome$/m);
      // The command alone on its line: nothing pipes its exit status away.
      expect(job, name).toMatch(new RegExp(`^\\s*- run: ${command}$`, 'm'));
      expect(job, name).not.toMatch(/continue-on-error/);
      expect(job, name).toMatch(/uses: actions\/upload-artifact@/);
      expect(job, name).toMatch(/^\s*if: always\(\)$/m);
      expect(job, name).toMatch(/^\s*path: out\/verify\.txt$/m);
      artifacts.push(/^\s*name: (\S+)$/m.exec(job.slice(job.indexOf('upload-artifact')))?.[1] ?? '');
    }
    // One run cannot upload two artifacts of one name.
    expect(new Set(artifacts).size).toBe(2);
  });

  it('runs the perf protocol on a schedule and on dispatch, as shards that cover every rail route once', () => {
    const yml = read(WEEKLY);
    expect(yml).toMatch(/^on:\n {2}schedule:\n {4}- cron: '[^']+'/m);
    expect(yml).toMatch(/^ {2}workflow_dispatch:\n {4}inputs:\n {6}jobs:$/m);
    const jobs = jobsOf(yml);
    expect(Object.keys(jobs).sort()).toEqual(['named', 'perf']);
    const perf = jobs.perf;
    expect(perf).toMatch(/^ {4}needs: named$/m);
    expect(perf).toMatch(/^ {6}fail-fast: false$/m);
    expect(perf).not.toMatch(/continue-on-error/);
    const matrix = /^ {8}shard: \[([\d, ]+)\]$/m.exec(perf)?.[1].split(',').map((s) => Number(s.trim())) ?? [];
    const count = Number(/pnpm verify --perf --shard \$\{\{ matrix\.shard \}\}\/(\d+)$/m.exec(perf)?.[1] ?? 0);
    expect(count).toBeGreaterThan(0);
    expect(matrix).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    const covered = matrix.flatMap((index) => shardOf(RAIL, { index, count }));
    expect(covered.slice().sort()).toEqual(RAIL.slice().sort());
    expect(new Set(covered).size).toBe(RAIL.length);
    for (const index of matrix) expect(shardOf(RAIL, { index, count }).length, `shard ${index}`).toBeGreaterThan(0);
    // The shard count's arithmetic is stated from the rail it divides.
    expect(yml).toMatch(new RegExp(`\\b${RAIL.length} rail routes\\b`));
    expect(yml).toMatch(new RegExp(`\\b${count} shards\\b`));
    expect(perf).toMatch(/^\s*path: out\/verify\.txt$/m);
    expect(perf).toMatch(/^\s*name: \S*\$\{\{ matrix\.shard \}\}\S*$/m);
  });

  it('refuses a dispatch that names a job the workflow does not have, before any job starts', () => {
    const yml = read(WEEKLY);
    const jobs = jobsOf(yml);
    const input = /^ {8}default: (\S+)$/m.exec(yml)?.[1] ?? '';
    expect(input).toBe('perf');
    expect(jobs.named ?? '').toContain(`JOBS: \${{ inputs.jobs || '${input}' }}`);
    expect(jobs.perf ?? '').toContain(`if: contains(format(',{0},', inputs.jobs || '${input}'), ',perf,')`);
    const script = stepScript(jobs.named ?? '', 'Every name is a job');
    expect(script).not.toBe('');
    const status = (value: string) => spawnSync('bash', ['-c', script], { env: { ...process.env, JOBS: value }, encoding: 'utf8' }).status;
    expect(status('perf')).toBe(0);
    expect(status('timed')).toBe(1);
    expect(status('perf,bogus')).toBe(1);
    expect(status('perf, perf')).toBe(1);
    expect(status('')).toBe(1);
  });

  it('holds no credential and reaches no deployment', () => {
    for (const file of [GATE, WEEKLY]) {
      const yml = read(file);
      expect(yml, file).toMatch(/^permissions:\n {2}contents: read$/m);
      expect(yml, file).not.toMatch(/secrets\.|ZZ_GATEWAY|ZZ_DEV_PAT|ASSISTANT_|https?:\/\//);
      const checkouts = yml.split(/uses: actions\/checkout@/).length - 1;
      expect(checkouts, file).toBeGreaterThan(0);
      expect(yml.split(/persist-credentials: false/).length - 1, file).toBe(checkouts);
    }
  });
});

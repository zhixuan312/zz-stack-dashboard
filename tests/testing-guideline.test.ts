// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The console's testing guideline and its CI. The standard is three commands, no arguments:
 * `pnpm test:t1` for the Tier 1 tests a change affected, `pnpm test:t2` for the affected Tier 2
 * tests plus the affected Tier 1 tests, and `pnpm test:release` for every Tier 1 and Tier 2 test
 * with lint and the type check, once before a release. The runner picks the tests; this console's
 * CI calls only those three.
 *
 * ZZ Meridian owns the runner (`scripts/test-run.ts`) and the package scripts that expose it
 * (`.meridian/manifest.json` and the update payload); this file holds the dashboard-owned side
 * that must agree with them: the README and CONTRIBUTING describe the commands, and the two
 * workflows call them. Tier 1 is every test under `tests/` except `*.perf.test.*`; Tier 2 is that
 * convention. The browser audits and walks are diagnostics, not tiers.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
/** A file's text. Every file named here exists, so a missing one fails the case that reads it rather than reading as empty. */
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const DOCUMENTS = ['README.md', 'CONTRIBUTING.md', 'docs/brief.md'];
const GATE = '.github/workflows/gate.yml';
const WEEKLY = '.github/workflows/weekly.yml';
const COMMANDS = ['pnpm test:t1', 'pnpm test:t2', 'pnpm test:release'];

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
  it('names the three commands, no arguments, in every document', () => {
    for (const file of DOCUMENTS) {
      const text = read(file);
      for (const command of COMMANDS) expect(text, `${file}: ${command}`).toContain(command);
    }
  });

  it("names the README's three commands, each with what it runs and none taking an argument", () => {
    const readme = paragraphs(read('README.md'));
    for (const command of COMMANDS) {
      const row = readme.filter((p) => new RegExp(`\\| \`${command}\` \\|`).test(p));
      expect(row, command).toHaveLength(1);
      expect(row[0]).toMatch(new RegExp(`\\| \`${command}\` \\| [^|]+ \\|`));
    }
    expect(readme.some((p) => /no arguments/i.test(p) && /runner picks/i.test(p))).toBe(true);
  });

  it('names no old test entry point or depth flag', () => {
    for (const file of [...DOCUMENTS, GATE, WEEKLY]) {
      const wrong = claims(file, read(file)).filter((c) =>
        /\bpnpm (?:verify|gate)\b/.test(c) || /(?:^|\s)--(?:full|timed|perf)\b/.test(c) || /\btest:all\b/.test(c));
      expect(wrong, file).toEqual([]);
    }
  });

  it('names the Tier 2 file convention and the last-green marker', () => {
    const readme = paragraphs(read('README.md'));
    expect(readme.some((p) => p.includes('*.perf.test.*'))).toBe(true);
    expect(readme.some((p) => p.includes('out/last-green'))).toBe(true);
  });

  it("lists CONTRIBUTING's three commands in its block, each with when it runs", () => {
    const block = paragraphs(read('CONTRIBUTING.md')).find((p) => p.startsWith('```') && p.includes('pnpm test:release')) ?? '';
    for (const command of COMMANDS) {
      const line = block.split('\n').find((l) => l.startsWith(`${command} `)) ?? '';
      expect(line, command).toMatch(/\s#\s\S/);
    }
  });

  it('says which act is a release in this repository', () => {
    const said = paragraphs(read('AGENTS.md')).filter((p) => /release in this repository/i.test(p) && /image tag/i.test(p));
    expect(said.length).toBeGreaterThan(0);
    expect(read('AGENTS.md')).toMatch(/Tier 1 phases use `test:t1`/);
    expect(read('AGENTS.md')).toMatch(/Tier 2 and Tier 3\s+phases use `test:t2`/);
  });
});

describe('the CI', () => {
  it('runs only the release command on push, on its own runner', () => {
    const yml = read(GATE);
    expect(yml).toMatch(/^on:\n {2}push:\n {4}branches: \[master\]$/m);
    const jobs = jobsOf(yml);
    expect(Object.keys(jobs)).toEqual(['release']);
    const job = jobs.release;
    expect(job).toMatch(/^ {4}runs-on: \S+$/m);
    // The command alone on its line: nothing pipes its exit status away.
    expect(job).toMatch(/^\s*- run: pnpm test:release$/m);
    expect(job).not.toMatch(/continue-on-error/);
    expect(job).not.toMatch(/pnpm (?:verify|gate|run (?:lint|test|typecheck))/);
  });

  it('runs the Tier 2 job on a schedule and on dispatch, through test:t2', () => {
    const yml = read(WEEKLY);
    expect(yml).toMatch(/^on:\n {2}schedule:\n {4}- cron: '[^']+'/m);
    expect(yml).toMatch(/^ {2}workflow_dispatch:\n {4}inputs:\n {6}jobs:$/m);
    const jobs = jobsOf(yml);
    expect(Object.keys(jobs).sort()).toEqual(['named', 't2']);
    const perf = jobs.t2;
    expect(perf).toMatch(/^ {4}needs: named$/m);
    expect(perf).not.toMatch(/continue-on-error/);
    // The scheduled Tier 2 job calls the command and nothing else.
    expect(perf).toMatch(/^\s*run: pnpm test:t2$/m);
    expect(perf).not.toMatch(/pnpm (?:verify|gate)/);
  });

  it('refuses a dispatch that names a job the workflow does not have, before any job starts', () => {
    const yml = read(WEEKLY);
    const jobs = jobsOf(yml);
    const input = /^ {8}default: (\S+)$/m.exec(yml)?.[1] ?? '';
    expect(input).toBe('t2');
    expect(jobs.named ?? '').toContain(`JOBS: \${{ inputs.jobs || '${input}' }}`);
    expect(jobs.t2 ?? '').toContain(`if: contains(format(',{0},', inputs.jobs || '${input}'), ',t2,')`);
    const script = stepScript(jobs.named ?? '', 'Every name is a job');
    expect(script).not.toBe('');
    const status = (value: string) => spawnSync('bash', ['-c', script], { env: { ...process.env, JOBS: value }, encoding: 'utf8' }).status;
    expect(status('t2')).toBe(0);
    expect(status('perf')).toBe(1);
    expect(status('t2,bogus')).toBe(1);
    expect(status('t2, t2')).toBe(1);
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

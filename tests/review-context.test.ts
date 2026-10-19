// @vitest-environment node
import { execFile, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contextFile, NO_VIEW, NOT_OPEN } from '../scripts/review-context.ts';
import { startFakeGateway } from './fake-gateway-start.ts';

/**
 * The review's contexts (Task I-163, AC-8.4): beside every screenshot of a review, the shared context the assistant is
 * given on that page and as that person, so a reader can judge Agents from what an agent there is told.
 *
 * `scripts/review-context.ts` is run as a script against the fake gateway, as a review runs it, into a folder of its
 * own: it writes one file per address under the shot's own name, each the view's context with its address and what it
 * says it does not show, and one sentence for an address where the assistant is given none. Then the review's own
 * folder, `out/review/<person>/`, when a review has been taken here: every screenshot has its context beside it.
 */
const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const REVIEW = path.join(ROOT, 'out', 'review');
const NODE = '/knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md';

/** The script's exit code and everything it printed. */
async function review(...args: string[]): Promise<{ code: number; out: string }> {
  return run('node', ['scripts/review-context.ts', ...args], { cwd: ROOT }).then(
    ({ stdout, stderr }) => ({ code: 0, out: stdout + stderr }),
    (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, out: e.stdout + e.stderr }),
  );
}

describe('the file a route and a person get', () => {
  it('is the shot\'s own name without its width and theme', () => {
    expect(contextFile('/', 'member')).toBe('home-member.context.txt');
    expect(contextFile('/platform/releases/0.97.0', 'superadmin')).toBe('platform-releases-0.97.0-superadmin.context.txt');
    expect(contextFile('/initiatives/atlas/2026-09-28-search-relevance/spec.md', 'member')).toBe('initiatives-atlas-2026-09-28-search-relevance-spec.md-member.context.txt');
  });
});

describe('the script, against the fake gateway', () => {
  let fixture: { base: string; proc: ChildProcess };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'review-context-'));
  beforeAll(async () => { fixture = await startFakeGateway(); });
  afterAll(() => { fixture?.proc.kill(); fs.rmSync(out, { recursive: true, force: true }); });

  it('writes each page\'s context as the person is given it, with its address and what it does not show', async () => {
    const { code, out: said } = await review('/', '/platform/audit', NODE, '--as', 'superadmin', '--gateway', fixture.base, '--out', path.join(out, 'superadmin'));
    expect(code, said).toBe(0);
    const home = fs.readFileSync(path.join(out, 'superadmin', 'home-superadmin.context.txt'), 'utf8');
    expect(home.split('\n')[0]).toMatch(/· address \/$/);
    expect(home).toMatch(/\nFacts:\n- /);
    expect(home).toMatch(/\nUnknown:\n- /);
    const audit = fs.readFileSync(path.join(out, 'superadmin', 'platform-audit-superadmin.context.txt'), 'utf8');
    expect(audit.split('\n')[0]).toMatch(/^Audit · .* · address \/platform\/audit$/);
    expect(fs.readFileSync(path.join(out, 'superadmin', contextFile(NODE, 'superadmin')), 'utf8').split('\n')[0]).toMatch(new RegExp(` · address ${NODE.replace(/[.]/g, '\\.')}$`));
    expect(said).toMatch(/review-context: 3 contexts, .* written for superadmin .*: ok/);
  });

  it('says in one sentence where the assistant is given no view context: a view the person may not open, an old address', async () => {
    const { code, out: said } = await review('/platform/audit', '/teams', '--as', 'member', '--gateway', fixture.base, '--out', path.join(out, 'member'));
    expect(code, said).toBe(0);
    expect(fs.readFileSync(path.join(out, 'member', 'platform-audit-member.context.txt'), 'utf8')).toBe(`${NOT_OPEN('/platform/audit', 'Audit')}\n`);
    expect(fs.readFileSync(path.join(out, 'member', 'teams-member.context.txt'), 'utf8')).toBe(`${NO_VIEW('/teams')}\n`);
    expect(said).toContain('Audit is not open to member');
  });

  it('names a page whose context could not be read, and exits 1', async () => {
    const missing = '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d99';
    const { code, out: said } = await review('/', missing, '--as', 'superadmin', '--gateway', fixture.base, '--out', path.join(out, 'failed'));
    expect(code).toBe(1);
    expect(said).toContain(`FAILED: 1 of 2 contexts could not be read as superadmin:\n    ${missing} (view_bug): `);
    expect(fs.existsSync(path.join(out, 'failed', 'home-superadmin.context.txt'))).toBe(true);
  });

  it('reads nothing without a gateway that answers, and exits 2', async () => {
    expect((await review('/', '--as', 'member', '--gateway', 'http://127.0.0.1:9', '--out', path.join(out, 'none'))).code).toBe(2);
    expect((await review('/', '--as', 'nobody', '--gateway', fixture.base)).code).toBe(2);
    expect(fs.existsSync(path.join(out, 'none'))).toBe(false);
  });
});

/**
 * Each person's screenshots in a review folder whose contexts were written, by the route-and-person part of their
 * names. A folder with shots and no context yet is a review still being taken (the shots come first), not one that
 * owes its contexts, so it is judged once scripts/review-context.ts has written into it.
 */
const shots = fs.existsSync(REVIEW)
  ? fs.readdirSync(REVIEW).flatMap((person) => {
    const dir = path.join(REVIEW, person);
    if (!fs.statSync(dir).isDirectory()) return [];
    const files = fs.readdirSync(dir);
    if (!files.some((f) => f.endsWith('.context.txt'))) return [];
    return files.filter((f) => f.endsWith('.png')).map((f) => ({ person, shot: f, stem: f.slice(0, f.indexOf(`-${person}-`) + person.length + 1) }));
  })
  : [];

// `out/` is not committed: a clean checkout and CI have no review folder, so there is nothing beside which a context is owed.
describe.skipIf(shots.length === 0)(shots.length
  ? 'the review folder, out/review/<person>/'
  : 'the review folder: skipped, no review in out/review/<person>/ with its contexts written (a review takes its shots with scripts/shot.ts and writes their contexts with scripts/review-context.ts)', () => {
  const stems = [...new Map(shots.map((s) => [`${s.person}/${s.stem}`, s])).values()];
  // With no shot, no case is made; this one stands in the run's count as the skipped review, with its reason as its name.
  if (!stems.length) it('has no shot to judge here', () => {});

  it.each(stems)('$person/$stem has the context its assistant is given beside its shots', ({ person, stem }) => {
    const file = path.join(REVIEW, person, `${stem}.context.txt`);
    expect(fs.existsSync(file), `${file} is missing: run scripts/review-context.ts with the shots' routes as ${person}`).toBe(true);
    const text = fs.readFileSync(file, 'utf8');
    const address = /· address (\S+)$/.exec(text.split('\n')[0])?.[1] ?? /^(\/\S*) · /.exec(text)?.[1];
    // The address the context names is the one the shot was taken at.
    expect(address && contextFile(address, person), text.split('\n')[0]).toBe(`${stem}.context.txt`);
    if (text === `${NO_VIEW(address!)}\n` || (text.startsWith(`${address} · `) && text.includes(' is not a view this person may open'))) return;
    expect(text, `${stem} does not say what it does not show`).toMatch(/\nUnknown:\n- /);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs from the repository's root, which is where `app/` is.
const DASH = path.join(process.cwd(), 'app', '(dash)');

/** Every page under the console's shell, as a path relative to it. */
function pages(dir = DASH, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) pages(abs, out);
    else if (name === 'page.tsx') out.push(path.relative(DASH, abs));
  }
  return out.sort();
}

/**
 * The feature each address asks for, from the spec's destinations table and its line on nested pages, for every phase:
 * the longest prefix wins, and the address `/` alone is `home`.
 * Written out here and not read from the code under test.
 */
const FEATURE_OF: [prefix: string, feature: string][] = [
  ['platform/releases', 'releases'], ['platform/bugs/[id]', 'bug'], ['platform/bugs', 'bugs'],
  ['platform/evaluation', 'evaluation'], ['platform/teams', 'teams'], ['platform/people', 'people'],
  ['platform/usage', 'usage'], ['platform/audit', 'audit'], ['platform/knowledge', 'knowledge-health'],
  ['platform', 'platform-status'],
  ['record', 'record'], ['initiatives', 'initiatives'], ['approvals', 'approvals'], ['knowledge', 'knowledge'],
  ['activity', 'activity'], ['runs', 'runs'], ['plugins', 'plugins'], ['access', 'access'],
  ['people', 'people'], ['settings', 'settings'], ['teams', 'teams'],
];
const LONGEST_FIRST = [...FEATURE_OF].sort((a, b) => b[0].length - a[0].length);
const expected = (page: string): string => {
  const dir = path.dirname(page) === '.' ? '' : path.dirname(page).split(path.sep).join('/');
  const hit = LONGEST_FIRST.find(([prefix]) => dir === prefix || dir.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'home';
};

/** Comments out, so a page cannot pass by describing the gate. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('every page under the console shell', () => {
  const all = pages();

  it('is found', () => {
    expect(all.length).toBeGreaterThanOrEqual(16);
  });

  it('answers every destination of both rails, and the old addresses Phase 7 removes (AC-1.12)', () => {
    // The eighteen destinations' addresses, and `/teams`, `/teams/<slug>`, `/people`, `/settings` and `/knowledge/log`,
    // which stay reachable, each gated as its feature, until they are removed. Written out here.
    const addresses = [
      '(home)', 'record', 'initiatives', 'approvals', 'knowledge', 'activity', 'runs', 'plugins', 'access',
      'platform', 'platform/releases', 'platform/bugs', 'platform/evaluation', 'platform/teams', 'platform/people',
      'platform/usage', 'platform/audit', 'platform/knowledge',
      'teams', 'teams/[slug]', 'people', 'settings', 'knowledge/log',
    ];
    for (const dir of addresses) expect(all, dir).toContain(path.join(dir, 'page.tsx'));
  });

  it.each(all)('%s is a server page', (page) => {
    const src = code(fs.readFileSync(path.join(DASH, page), 'utf8'));
    expect(src).not.toMatch(/['"]use client['"]/);
  });

  it.each(all)('%s asks its own feature before anything else', (page) => {
    const src = code(fs.readFileSync(path.join(DASH, page), 'utf8'));
    const at = src.search(/export\s+default\s+async\s+function\b/);
    expect(at, 'an async default export').toBeGreaterThanOrEqual(0);
    const rest = src.slice(at);
    // The brace that opens the body is the one a closing parenthesis, or a return type after it, leads to.
    const gate = /\)\s*(?::[^{;]*)?\{\s*const\s+denied\s*=\s*await\s+gate\(\s*'([a-z-]+)'\s*\)\s*;\s*if\s*\(\s*denied\s*\)\s*return\s+denied\s*;/.exec(rest);
    expect(gate, 'the gate opens the page').not.toBeNull();
    const before = rest.slice(0, gate!.index + gate![0].length);
    expect(before.match(/\bawait\b/g)?.length, 'nothing is awaited before the gate').toBe(1);
    expect(gate![1]).toBe(expected(page));
  });
});

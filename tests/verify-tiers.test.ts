// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * The console's verify configuration in ZZ Meridian 0.18.0's tiers (Task I-142; AC-8.7, AC-2.9, AC-8.3).
 *
 * `pnpm verify --full` runs `browserChecks` beside the audit, the presses and the keyboard walk, and judges no time;
 * `pnpm verify --timed` runs `timedChecks` alone and one at a time. So a check that judges a time is in `timedChecks`
 * and nowhere else, and the half of one that judges no time stays in `browserChecks`. The fake model's one step asks
 * the assistant the Work guide's task 4 phrase through the search the Knowledge page hands it, and Access's toggle
 * probe reads the row its Revoke changes, which 0.18.0 reads whole.
 */
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

import { viewAt } from '@/lib/shared-context';
import { viewTools } from '@/views/tools';
import { fakeModelProblems } from '../scripts/lib/config-hooks.ts';
import config from '../scripts/verify.config.ts';
import guide from './fixtures/guide-tasks.json';

const SOURCE = fs.readFileSync(path.join(import.meta.dirname, '..', 'scripts', 'verify.config.ts'), 'utf8');
const PHRASE = guide.tasks.find((t) => t.id === 'work-4')!.phrase!;

/** The tools the assistant's route hands on `page`: every view's `view_<name>`, and the page's own prepared query. */
const handedOn = (page: string) => [...viewTools.map((v) => `view_${v.name}`), `explore_${viewAt(viewTools, page)!.name}`];

/** Each browser check's script: an entry is a script, or a script with the browsers it holds at once (ZZ Meridian 0.26.0). */
const BROWSER = (config.browserChecks ?? []).map((c) => (typeof c === 'string' ? c : c.script));

describe("the console's verify tiers", () => {
  it('runs the checks that judge a time in timedChecks alone, and nowhere else', () => {
    expect(config.timedChecks).toEqual(['scripts/primary-data.ts', 'scripts/states-timed.ts']);
    for (const script of config.timedChecks!) expect(BROWSER, script).not.toContain(script);
  });

  it('keeps the halves that judge no time in browserChecks, which --full runs', () => {
    // The states check pools its browsers, so its entry says how many verify holds for it, and the check is told the same.
    expect(config.browserChecks).toContainEqual({ script: 'scripts/states-check.ts', browsers: 4 });
    expect(BROWSER).toContain('scripts/journeys.ts');
    for (const script of [...BROWSER, ...config.timedChecks!]) expect(fs.existsSync(path.join(import.meta.dirname, '..', script)), script).toBe(true);
  });

  it('declares, in its type, the three fields 0.18.0 reads that it did not', () => {
    const type = /export type VerifyConfig = \{([\s\S]*?)\n\};/.exec(SOURCE)?.[1] ?? '';
    expect(type).toMatch(/^\s+timedChecks\?: string\[\];$/m);
    expect(type).toMatch(/^\s+fakeModel\?: \{ when: string; tool: string; input: Record<string, unknown> \}\[\];$/m);
    expect(type).toMatch(/^\s+prefetchKb\?: \{ desktop: number; phoneClosed: number \};$/m);
  });

  it("has one fake-model step: Work task 4's phrase, asked of the search Knowledge hands the assistant", () => {
    expect(config.fakeModel).toHaveLength(1);
    expect(fakeModelProblems(config.fakeModel!)).toEqual([]);
    const [step] = config.fakeModel!;
    expect(new RegExp(step.when, 'i').test(PHRASE)).toBe(true);
    // Anchored, so it answers the phrase alone and none of the assistant walk-through's own questions.
    expect(new RegExp(step.when, 'i').test(`What is this page? ${PHRASE}`)).toBe(false);
    expect(step.input).toEqual({ q: PHRASE });
    expect(handedOn('/knowledge')).toContain(step.tool);
    const view = viewTools.find((v) => `view_${v.name}` === step.tool)!;
    expect(view.page).toBe('/knowledge');
    expect(view.input.safeParse(step.input).success).toBe(true);
  });

  it("reads Access's toggle on the token row its Revoke changes", () => {
    const access = config.navigationChecks!.find((c) => c.path === '/access')!;
    expect(access.controlSelector).toBe('main [data-protagonist="Tokens"] tbody tr button');
    expect(access.resultSelector).toBe('main [data-protagonist="Tokens"] tbody tr');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { JOURNEYS, readTasks } from '../scripts/journeys.ts';
import config from '../scripts/verify.config.ts';
import guide from './fixtures/guide-tasks.json';

/**
 * The guides' tasks to try as scripts/journeys.ts walks them (Task I-128, AC-8.3): the Work guide's eight and the
 * Platform guide's ten, kept in tests/fixtures/guide-tasks.json as each guide words them with the source it is kept in,
 * and the spec's definition beside a task whose guide example the spec supersedes. Each is carried out by exactly one
 * journey, and the check is one `pnpm verify` runs.
 */
const WORK = 'sources/2026-10-14-the-work-guide-version-7-as-text-every-word-of-the-page-and.md';
const PLATFORM = 'sources/2026-10-14-the-platform-guide-version-7-as-text-every-word-of-the-page.md';

describe("the guides' tasks to try", () => {
  it('keeps the eighteen tasks, eight of Work and ten of Platform, each with its source', () => {
    const tasks = readTasks();
    expect(tasks).toEqual(guide.tasks);
    expect(tasks.filter((t) => t.guide === 'work')).toHaveLength(8);
    expect(tasks.filter((t) => t.guide === 'platform')).toHaveLength(10);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(18);
    for (const t of tasks) {
      expect(t.source, t.id).toBe(t.guide === 'work' ? WORK : PLATFORM);
      expect(t.task, t.id).toMatch(/^[A-Z][^.]+\.$/);
      expect(t.words.length, t.id).toBeGreaterThan(20);
    }
  });

  it("gives the spec's definition where the guide's example is superseded", () => {
    const defined = (id: string) => readTasks().find((t) => t.id === id)?.definition ?? '';
    // Runs' by skill is observed output per run (FR-20), Teams ranks no team (FR-9), and Approve's count is the bell's.
    expect(defined('work-6')).toMatch(/observed output per run/);
    expect(defined('platform-7')).toMatch(/latest real-work call first/);
    expect(defined('work-2')).toMatch(/bell/);
  });

  it('names each task by exactly one journey, and no journey a task the guides do not have', () => {
    const ids = readTasks().map((t) => t.id);
    for (const id of ids) expect(JOURNEYS.filter((j) => j.task === id).map((j) => j.task), id).toEqual([id]);
    expect(JOURNEYS.map((j) => j.task).filter((id) => !ids.includes(id))).toEqual([]);
    expect(JOURNEYS).toHaveLength(18);
  });

  it('walks each as the person the task names, and the member through Platform as the member', () => {
    const who = Object.fromEntries(JOURNEYS.map((j) => [j.task, j.who]));
    for (const id of ['work-1', 'work-2', 'work-3', 'work-4', 'work-5', 'work-6', 'work-7', 'work-8', 'platform-4', 'platform-10']) expect(who[id], id).toBe('member');
    for (const id of ['platform-1', 'platform-2', 'platform-3', 'platform-5', 'platform-6', 'platform-7', 'platform-8']) expect(who[id], id).toBe('superadmin');
    expect(who['platform-9']).toBe('superadmin and member');
  });

  it('is one of the browser checks pnpm verify runs', () => {
    expect(config.browserChecks).toContain('scripts/journeys.ts');
  });
});

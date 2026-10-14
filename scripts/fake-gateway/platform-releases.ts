/**
 * The fake gateway's releases: what `GET /api/console/platform/releases` and `/platform/releases/:version` answer,
 * alike to everyone signed in, since nothing in a release belongs to a team.
 *
 * One release per state the page draws: two shipped inside 72 hours of each other, so each names the other and the
 * newer one's after-window is still running; a release with full windows and upgrade notes; one whose after-window
 * saw no calls, so it has no rate; and an old tag with no changelog section, released before the record began, so its
 * before-window was never observed. Each window is 72 hours either side of the tag, observed no earlier than the
 * record's coverage start and no later than the read's cutoff.
 *
 * The record begins where the status fixture's does, and the weekly malformed-call rate is that fixture's own weeks,
 * so Releases and Status read the same figures.
 *
 * COUPLED: zz-stack's `checks/console-platform-releases.ts` imports this file with plain `node` and compares its key
 * sets with the real route's answer. So nothing here is imported through the console's path alias, and every part is
 * answered `ok`: an unavailable part has no key set to compare.
 */
import type { Figure, ReleaseDetail, ReleaseRow, Releases } from '../../src/lib/platform-shapes.ts';
import { ago, now } from './clock.ts';
import { PLATFORM_STATUS } from './platform-status.ts';

const HOUR = 3_600_000;
const WINDOW = 72 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const COVERAGE = Date.parse(PLATFORM_STATUS.meta.coverageFrom!);

/** What one side of a release recorded: real-work calls, those refused as malformed, tool failures and the p95. */
type Counts = { calls: number; malformed: number; toolFailures: number; p95Ms: number | null };

type Seed = { version: string; hoursAgo: number; console: string | null; summary: string; clientAction: string | null;
  changelog: string; upgradeNotes: string | null; before: Counts; after: Counts };

const NO_CHANGELOG = 'No changelog entry';

/** Newest first. Every time is an offset from the fixture's start, so the newest after-window is always running. */
const SEEDS: Seed[] = [
  { version: '0.97.1', hoursAgo: 20, console: null, summary: 'Search no longer drops a result whose title has a colon.', clientAction: null,
    changelog: '### Fixed\n\n- Search no longer drops a result whose title has a colon.\n', upgradeNotes: null,
    before: { calls: 2_140, malformed: 9, toolFailures: 3, p95Ms: 1_840 }, after: { calls: 610, malformed: 2, toolFailures: 0, p95Ms: 1_620 } },
  { version: '0.97.0', hoursAgo: 50, console: '0.28.0', summary: 'A release records itself, with the windows around it.', clientAction: 'Re-pull the plugins.',
    changelog: 'A release records itself, with the windows around it.\n\n### zz-stack 0.97.0\n\n- **Releases are recorded.** Each tag writes its own row.\n\n### Upgrade notes\n\n- **Re-pull the plugins.** Every client takes the new skill text on its next pull.\n',
    upgradeNotes: '- **Re-pull the plugins.** Every client takes the new skill text on its next pull.\n',
    before: { calls: 2_310, malformed: 12, toolFailures: 4, p95Ms: 1_910 }, after: { calls: 1_480, malformed: 5, toolFailures: 1, p95Ms: 1_700 } },
  { version: '0.96.0', hoursAgo: 216, console: '0.27.0', summary: 'This release mounts the assistant.', clientAction: 'Re-pull the plugins.',
    changelog: 'This release mounts the assistant. It answers from the page you are on.\n\n### Upgrade notes\n\n- **Re-pull the plugins.** Every client takes the new skill text on its next pull.\n',
    upgradeNotes: '- **Re-pull the plugins.** Every client takes the new skill text on its next pull.\n',
    before: { calls: 3_020, malformed: 21, toolFailures: 6, p95Ms: 2_240 }, after: { calls: 2_870, malformed: 8, toolFailures: 2, p95Ms: 2_010 } },
  { version: '0.95.2', hoursAgo: 400, console: null, summary: 'The nightly reindex skips a node it has already read.', clientAction: null,
    changelog: '### Fixed\n\n- The nightly reindex skips a node it has already read.\n', upgradeNotes: null,
    before: { calls: 44, malformed: 1, toolFailures: 0, p95Ms: 1_390 }, after: { calls: 0, malformed: 0, toolFailures: 0, p95Ms: null } },
  { version: '0.31.1', hoursAgo: (now() - COVERAGE) / HOUR + 24, console: null, summary: NO_CHANGELOG, clientAction: 'Unknown — no recorded upgrade notes',
    changelog: NO_CHANGELOG, upgradeNotes: null,
    before: { calls: 0, malformed: 0, toolFailures: 0, p95Ms: null }, after: { calls: 380, malformed: 6, toolFailures: 1, p95Ms: 2_480 } },
];

const at = (s: Seed) => now() - s.hoursAgo * HOUR;
const stands = (value: number): Figure => ({ value, why: null });
const UNAVAILABLE: Figure = { value: null, why: 'unavailable' };

/** One side of a release, `[from, to)`, with the bounds the record actually observed and the releases inside it. */
function side(self: Seed, from: number, to: number, counts: Counts): ReleaseRow['before'] {
  const observedFrom = Math.max(from, COVERAGE);
  const observedThrough = Math.min(to, now());
  const overlappingVersions = SEEDS.filter((s) => s !== self && at(s) >= from && at(s) < to).map((s) => s.version);
  // A window that ends before the record began was never observed: every figure is unavailable, never zero.
  if (observedFrom >= observedThrough) {
    return { window: { from: iso(from), to: iso(to), observedFrom: null, observedThrough: null, complete: false },
      calls: UNAVAILABLE, malformed: UNAVAILABLE, malformedPer1000: UNAVAILABLE, toolFailures: UNAVAILABLE, p95Ms: UNAVAILABLE, overlappingVersions };
  }
  const none: Figure = { value: null, why: 'no_data' };
  return {
    window: { from: iso(from), to: iso(to), observedFrom: iso(observedFrom), observedThrough: iso(observedThrough),
      complete: observedFrom === from && observedThrough === to },
    calls: stands(counts.calls), malformed: stands(counts.malformed), toolFailures: stands(counts.toolFailures),
    // No calls is no rate and no latency, never a zero.
    malformedPer1000: counts.calls === 0 ? none : { value: (1000 * counts.malformed) / counts.calls, why: counts.calls < 30 ? 'insufficient' : null },
    p95Ms: counts.calls === 0 || counts.p95Ms === null ? none : stands(counts.p95Ms),
    overlappingVersions,
  };
}

/** Every release as its own page reads it: the row, its changelog section and its upgrade notes. */
export const RELEASES: ReleaseDetail[] = SEEDS.map((s) => ({
  version: s.version, consoleVersion: s.console, releasedAt: iso(at(s)), summary: s.summary, clientAction: s.clientAction,
  before: side(s, at(s) - WINDOW, at(s), s.before), after: side(s, at(s), at(s) + WINDOW, s.after),
  changelog: s.changelog, upgradeNotes: s.upgradeNotes,
}));

/** `GET /platform/releases/:version`, or null for a version the record does not hold. */
export const releaseDetail = (version: string): ReleaseDetail | null => RELEASES.find((r) => r.version === version) ?? null;

/** `GET /platform/releases`: the tiles, the weeks and one page of rows, newest first. */
export function releases(limit: number, offset: number): Releases {
  const asOf = iso(now());
  const rows = RELEASES.map(({ changelog: _c, upgradeNotes: _u, ...row }): ReleaseRow => row);
  const malformed = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!;
  return {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: iso(COVERAGE), to: asOf } },
    tiles: {
      releases: rows.length,
      lastWeek: rows.filter((r) => now() - Date.parse(r.releasedAt) < 7 * 24 * HOUR).length,
      latest: { version: rows[0].version, releasedAt: rows[0].releasedAt },
      migrations: { applied: 102, lastAt: ago(30) },
    },
    weeks: malformed.weeks.map((w) => ({
      window: w.window,
      releases: rows.filter((r) => r.releasedAt >= w.window.from && r.releasedAt < w.window.to).length,
      malformedPer1000: w,
    })),
    rows: { state: 'ok', data: { rows: rows.slice(offset, offset + limit), total: rows.length } },
  };
}

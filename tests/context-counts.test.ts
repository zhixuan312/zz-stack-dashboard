import { describe, expect, it } from 'vitest';
import type { ActivitySummary } from '@/lib/destination-shapes';
import type { PlatformStatus } from '@/lib/platform-shapes';
import { activityContext } from '@/logic/activity-context';
import { initiativeContext } from '@/logic/initiative-context';
import { releaseContext } from '@/logic/platform-releases-context';
import { platformStatusContext, statusRead } from '@/logic/platform-status-context';
import { ME } from '../scripts/fake-gateway/people.ts';
import { releaseDetail } from '../scripts/fake-gateway/platform-releases.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { answered } from '../scripts/fake-gateway/envelope.ts';
import { initiativeDetail } from '../scripts/fake-gateway/work-initiatives.ts';
import { activitySummary } from '../scripts/fake-gateway/work-activity.ts';

// What the assistant is told counts with `plural`, and says a count it has not got in words, never "1 calls" or
// "Unavailable migrations".
const arrival = { updatedAt: '2026-10-12T09:00:00Z', now: '2026-10-12T09:01:00Z' };
const clone = <T,>(v: T): T => structuredClone(v);

describe('a count the assistant is told', () => {
  it('on Activity, a week with one call', () => {
    const summary = clone(activitySummary(ME)[1] as ActivitySummary);
    if (summary.weeks.state !== 'ok') throw new Error('fixture weeks unavailable');
    summary.weeks.data[0].calls = 1;
    expect(activityContext({ summary, index: 0, ...arrival }).focus).toMatch(/: 1 call, /);
  });

  it('on a release, a window with one call and one tool failure, and one nobody observed', () => {
    const r = clone(releaseDetail('0.97.0')!);
    r.before.calls = { value: 1, why: null };
    r.before.toolFailures = { value: 1, why: null };
    r.after.window.observedFrom = null;
    const c = releaseContext(r, { asOf: arrival.now, ...arrival });
    const change = (label: string) => c.facts.find((f) => f.label === label)?.change ?? '';
    expect(change('Before')).toMatch(/^1 call, .*, 1 tool failure, /);
    expect(change('After')).toMatch(/^Not observed: /);
    expect(change('After')).not.toContain('Not observed calls');
  });

  it('on Status, one migration, and migrations it could not count', () => {
    const running = (migrations: number | null) => {
      const s = clone(answered(PLATFORM_STATUS)) as PlatformStatus;
      if (s.running.state === 'ok') s.running.data.migrations = migrations;
      return platformStatusContext(statusRead(s)).facts.find((f) => f.label === 'Running')?.change ?? '';
    };
    expect(running(1)).toContain('; 1 migration');
    expect(running(null)).toContain('; migrations unavailable');
  });

  it('on an initiative, a correction\'s link encodes its path', () => {
    const d = clone(initiativeDetail('atlas', '2026-09-12-onboarding-revamp')!);
    d.correction = { ...d.correction!, path: 'notes #2.md' };
    const evidence = initiativeContext(d, arrival).insights.find((i) => i.text.includes('changed after the close'))?.evidence;
    expect(evidence).toMatch(/notes%20%232\.md$/);
  });
});

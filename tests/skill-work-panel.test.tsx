import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SkillWorkPanel } from '@/components/SkillWorkPanel';
import type { Skill } from '@/lib/api-shapes';

/**
 * What the duration columns are allowed to claim.
 *
 * A run's span is the gap between its first and last tool call, so a single-call run has none
 * — `ended_at = started_at` by construction — and the gateway takes every duration over
 * `ended_at > started_at` only. These fixtures are the shapes that produces.
 */
const skill = (over: Partial<Skill>): Skill => ({
  name: 'x', version: '1.0', kind: 'flow', flow: null, retired: false,
  runs: 1, calls: 1, callsAvg: 1, callsMax: 1, refusals: 0, timedRuns: 1,
  durationAvg: null, durationMedian: null, durationMax: null, durationTotal: null,
  kbPerRun: null, mbTotal: null, logged: null,
  ...over,
});

const SKILLS: Skill[] = [
  // Thin evidence: a real median resting on 3 of 34 runs.
  skill({ name: 'sdlc-plan', runs: 34, timedRuns: 3, calls: 69, refusals: 4,
    durationMedian: 1526.7, durationTotal: 8029.6 }),
  // Genuinely sub-second, and measured 37 times — not the same fact as "unmeasured".
  skill({ name: 'sdlc-explore', runs: 60, timedRuns: 37, calls: 97, refusals: 68,
    durationMedian: 0.1, durationTotal: 28.1 }),
  // Every run timed, so there is nothing to caveat and the row stays quiet.
  skill({ name: 'zz-platform', runs: 23, timedRuns: 23, calls: 50,
    durationMedian: 1.0, durationTotal: 307.7 }),
  // Nothing timed at all, and no team.
  skill({ name: 'sdlc-deck', runs: 1, timedRuns: 0, calls: 1 }),
];

/* By the first cell, not by text anywhere in the row: a team and a skill can share a name,
 * so matching on text alone finds the chip too and throws "found multiple elements". */
const row = (name: string) => screen.getAllByRole('row')
  .find((r) => r.querySelector('td')?.textContent?.trim().startsWith(name)) as HTMLElement;

describe('SkillWorkPanel', () => {
  it('says what a median is a median of when that is not the run count', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // 25 min beside "34 runs" is the number that misleads without this.
    expect(within(row('sdlc-plan')).getByText('3 of 34 timed')).toBeInTheDocument();
    // Timed and run counts agreeing means there is nothing to caveat, and no caption.
    expect(within(row('zz-platform')).queryByText(/timed/)).not.toBeInTheDocument();
    // …but a row that is short of its run count says so, wherever it sits.
    expect(within(row('sdlc-explore')).getByText('37 of 60 timed')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getByText('none timed')).toBeInTheDocument();
  });

  it('separates a measured sub-second run from an unmeasured one', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // A row short of its run count and a row with no median print differently; `if (!s) return '—'`
    // would print a dash for both.
    expect(within(row('sdlc-explore')).getByText('< 1 s')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('states the single-call runs it left out of the times', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // 31 + 23 + 1 — the caveat is a measurement, not a fixed sentence.
    expect(screen.getByText(/55 single-call runs/)).toBeInTheDocument();
  });

  it('re-ranks when the axis changes, because the axes disagree', async () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    const order = () => screen.getAllByRole('row').slice(1)
      .map((r) => r.querySelector('td')!.textContent!.trim().split(' ')[0]);
    // By calls: explore (97) leads plan (69).
    expect(order()[0]).toBe('sdlc-explore');
    await userEvent.click(screen.getByRole('radio', { name: 'total time' }));
    // By total time the answer inverts — explore spent 28s, plan spent two hours.
    expect(order()[0]).toBe('sdlc-plan');
  });
});

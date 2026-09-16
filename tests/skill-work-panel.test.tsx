import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SkillWorkPanel } from '@/components/SkillWorkPanel';
import type { Skill } from '@/lib/api';

/**
 * WHAT THE DURATION COLUMNS ARE ALLOWED TO CLAIM.
 *
 * A run's span is the gap between its first and last tool call, so a single-call run has no
 * span — `ended_at = started_at` by construction, on 148 of this deployment's 336 runs. The
 * gateway therefore takes every duration over `ended_at > started_at` only. These fixtures
 * are the three shapes that produces, with the real numbers that motivated the change:
 * sdlc-plan's median moved from 0s to 25 minutes once the structural zeroes stopped voting.
 */
const skill = (over: Partial<Skill>): Skill => ({
  name: 'x', version: '1.0', kind: 'flow', flow: null, retired: false, teams: ['xuan'],
  runs: 1, calls: 1, callsAvg: 1, callsMax: 1, refusals: 0, timedRuns: 1, turns: null,
  durationAvg: null, durationMedian: null, durationMax: null, durationTotal: null,
  kbPerRun: null, mbTotal: null, logged: null,
  // ALWAYS null, and not because this is a fixture: /skills stopped emitting `evaluated`
  // when an evaluation's subject became a plugin, and nothing can write a per-skill score
  // again. The field is still on the type and read in four places. Follow-up, not this
  // change — see the gateway's "NO EVALUATION HERE ANY MORE".
  evaluated: null, ...over,
});

const SKILLS: Skill[] = [
  // Thin evidence: a real median resting on 3 of 34 runs.
  skill({ name: 'sdlc-plan', runs: 34, timedRuns: 3, calls: 69, refusals: 4,
    durationMedian: 1526.7, durationTotal: 8029.6, teams: ['quan', 'xuan'] }),
  // Genuinely sub-second, and measured 37 times — not the same fact as "unmeasured".
  skill({ name: 'sdlc-explore', runs: 60, timedRuns: 37, calls: 97, refusals: 68,
    durationMedian: 0.1, durationTotal: 28.1 }),
  // Every run timed, so there is nothing to caveat and the row stays quiet.
  skill({ name: 'zz-platform', runs: 23, timedRuns: 23, calls: 50,
    durationMedian: 1.0, durationTotal: 307.7, teams: ['zz-platform'] }),
  // Nothing timed at all, and no team.
  skill({ name: 'sdlc-deck', runs: 1, timedRuns: 0, calls: 1, teams: [] }),
];

/* BY THE FIRST CELL, not by text anywhere in the row. A team is named `zz-platform` and so
 * is a skill — true of the real data, not just this fixture — so matching on text alone
 * finds the chip as readily as the name and throws "found multiple elements". */
const row = (name: string) => screen.getAllByRole('row')
  .find((r) => r.querySelector('td')?.textContent?.trim().startsWith(name)) as HTMLElement;

describe('SkillWorkPanel', () => {
  it('says what a median is a median of when that is not the run count', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // 25 min beside "34 runs" is the number that misleads without this.
    expect(within(row('sdlc-plan')).getByText('3 of 34 timed')).toBeInTheDocument();
    // Timed and run counts agreeing means there is nothing to caveat, and no caption.
    expect(within(row('zz-platform')).queryByText(/timed/)).not.toBeInTheDocument();
    // …but a row that IS short of its run count says so, wherever it sits.
    expect(within(row('sdlc-explore')).getByText('37 of 60 timed')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getByText('none timed')).toBeInTheDocument();
  });

  it('separates a measured sub-second run from an unmeasured one', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // THE DISTINCTION THE OLD `if (!s) return '—'` DESTROYED: both printed a dash.
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

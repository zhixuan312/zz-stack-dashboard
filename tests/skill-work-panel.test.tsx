import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SkillWorkPanel } from '@/console/skill-work';
import type { SkillRunRow } from '@/lib/destination-shapes';

/**
 * What the by-skill columns are allowed to claim.
 *
 * A run's length is the gap between its first and last tool call, so a single-call run has none, and the gateway takes
 * a skill's typical length over its runs longer than one call only, `timed` of them. A run's output is the response bytes
 * of its own calls, null when nothing measured it. These fixtures are the shapes that produces.
 */
const skill = (over: Partial<SkillRunRow>): SkillRunRow => ({
  skill: 'x', runs: 1, callsPerRun: 1, shareRefused: null, outputPerRun: null, typicalMs: null, timed: 1,
  ...over,
});

const SKILLS: SkillRunRow[] = [
  // Thin evidence: a real typical length resting on 3 of 34 runs, and the heaviest output.
  skill({ skill: 'sdlc-plan', runs: 34, timed: 3, callsPerRun: 2, shareRefused: 0.058, outputPerRun: 3_145_728, typicalMs: 1_526_700 }),
  // Genuinely sub-second, and measured 37 times — not the same fact as "unmeasured".
  skill({ skill: 'sdlc-explore', runs: 60, timed: 37, callsPerRun: 1.6, shareRefused: 0.701, outputPerRun: 4_096, typicalMs: 100 }),
  // Every run timed, so there is nothing to caveat and the row stays quiet.
  skill({ skill: 'zz-platform', runs: 23, timed: 23, callsPerRun: 2.2, shareRefused: 0, outputPerRun: 20_480, typicalMs: 1_000 }),
  // Nothing timed at all, and nothing measured.
  skill({ skill: 'sdlc-deck', runs: 1, timed: 0, callsPerRun: 1 }),
];

/* By the first cell, not by text anywhere in the row. */
const row = (name: string) => screen.getAllByRole('row')
  .find((r) => r.querySelector('td')?.textContent?.trim().startsWith(name)) as HTMLElement;

describe('SkillWorkPanel', () => {
  it('says what a typical length is taken over when that is not the run count', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // 25 min beside "34 runs" is the number that misleads without this.
    expect(within(row('sdlc-plan')).getByText('3 of 34 timed')).toBeInTheDocument();
    // Timed and run counts agreeing means there is nothing to caveat, and no caption.
    expect(within(row('zz-platform')).queryByText(/timed/)).not.toBeInTheDocument();
    expect(within(row('sdlc-explore')).getByText('37 of 60 timed')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getByText('none timed')).toBeInTheDocument();
  });

  it('separates a measured sub-second run from an unmeasured one, and unmeasured output from none', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    expect(within(row('sdlc-explore')).getByText('< 1 s')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(row('sdlc-deck')).getByText('Not measured')).toBeInTheDocument();
    expect(within(row('sdlc-plan')).getByText('3.0 MB')).toBeInTheDocument();
  });

  it('states the single-call runs it left out of the lengths', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // 31 + 23 + 1 — the caveat is a measurement, not a fixed sentence.
    expect(screen.getByText(/55 single-call runs/)).toBeInTheDocument();
  });

  it('re-ranks when the axis changes, because the axes disagree', async () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    const order = () => screen.getAllByRole('row').slice(1)
      .map((r) => r.querySelector('td')!.textContent!.trim().split(' ')[0]);
    // By observed output per run: plan's runs answer the most.
    expect(order()[0]).toBe('sdlc-plan');
    await userEvent.click(screen.getByRole('radio', { name: 'Runs' }));
    // By runs the answer inverts — explore ran 60 times.
    expect(order()[0]).toBe('sdlc-explore');
  });

  it('calls output observed output, and never a payload, a context or a cost', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    expect(document.body.textContent).toContain('observed output per run');
    expect(document.body.textContent).not.toMatch(/payload|context|cost/i);
  });
});

describe('SkillWorkPanel refusals', () => {
  it('prints the share refused as a number, not a red pill on every row', () => {
    render(<SkillWorkPanel skills={SKILLS} />);
    // Nearly every skill refuses something; a status hue on each row means nothing.
    const cell = within(row('sdlc-explore')).getByText('70.1%');
    expect(cell.closest('[class*="rose"]')).toBeNull();
    expect(within(row('zz-platform')).getAllByText('—').length).toBeGreaterThan(0);
  });
});

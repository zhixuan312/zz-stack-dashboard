import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillWorkPanel } from '@/console/skill-work';
import type { SkillRunRow } from '@/lib/destination-shapes';

/**
 * What the by-skill columns are allowed to claim.
 *
 * A run's length is the gap between its first and last tool call, so a single-call run has none, and the gateway takes
 * a skill's typical length over its runs longer than one call only, `timed` of them. A run's output is the response bytes
 * of its own calls, null when nothing measured it. The gateway sorts the skills and counts the single-call runs; the
 * card draws its order and its count. These fixtures are the shapes that produces.
 */
const skill = (over: Partial<SkillRunRow>): SkillRunRow => ({
  skill: 'x', runs: 1, callsPerRun: 1, shareRefused: null, outputPerRun: null, typicalMs: null, timed: 1,
  ...over,
});

/* In the gateway's order: the most observed output per run first, a skill nothing measured last. */
const SKILLS: SkillRunRow[] = [
  // Thin evidence: a real typical length resting on 3 of 34 runs, and the heaviest output.
  skill({ skill: 'sdlc-plan', runs: 34, timed: 3, callsPerRun: 2, shareRefused: 0.058, outputPerRun: 3_145_728, typicalMs: 1_526_700 }),
  // Every run timed, so there is nothing to caveat and the row stays quiet; and it refused nothing, which is a figure.
  skill({ skill: 'zz-platform', runs: 23, timed: 23, callsPerRun: 2.2, shareRefused: 0, outputPerRun: 20_480, typicalMs: 1_000 }),
  // Genuinely sub-second, and measured 37 times — not the same fact as "unmeasured".
  skill({ skill: 'sdlc-explore', runs: 60, timed: 37, callsPerRun: 1.6, shareRefused: 0.701, outputPerRun: 4_096, typicalMs: 100 }),
  // Nothing timed at all, nothing measured, and no call to share a refusal out of.
  skill({ skill: 'sdlc-deck', runs: 1, timed: 0, callsPerRun: 1 }),
];

/* By the first cell, not by text anywhere in the row. */
const row = (name: string) => screen.getAllByRole('row')
  .find((r) => r.querySelector('td')?.textContent?.trim().startsWith(name)) as HTMLElement;
const order = () => screen.getAllByRole('row').slice(1).map((r) => r.querySelector('td')!.textContent!.trim());

describe('SkillWorkPanel', () => {
  it('draws the skills in the gateway\'s order, by observed output per run, and re-ranks nothing', () => {
    render(<SkillWorkPanel skills={SKILLS} oneCall={0} />);
    expect(order()).toEqual(['sdlc-plan', 'zz-platform', 'sdlc-explore', 'sdlc-deck']);
    expect(screen.queryAllByRole('radio')).toEqual([]);
    expect(screen.getByText('Most observed output per run first · 4 skills')).toBeInTheDocument();
  });

  it('says what a typical length is taken over when that is not the run count', () => {
    render(<SkillWorkPanel skills={SKILLS} oneCall={0} />);
    // 25 min beside "34 runs" is the number that misleads without this.
    expect(within(row('sdlc-plan')).getByText('3 of 34 timed')).toBeInTheDocument();
    // Timed and run counts agreeing means there is nothing to caveat, and no caption.
    expect(within(row('zz-platform')).queryByText(/timed/)).not.toBeInTheDocument();
    expect(within(row('sdlc-explore')).getByText('37 of 60 timed')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getByText('none timed')).toBeInTheDocument();
  });

  it('separates a measured sub-second run from an unmeasured one, and unmeasured output from none', () => {
    render(<SkillWorkPanel skills={SKILLS} oneCall={0} />);
    expect(within(row('sdlc-explore')).getByText('< 1 s')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(row('sdlc-deck')).getByText('Not measured')).toBeInTheDocument();
    expect(within(row('sdlc-plan')).getByText('3.0 MB')).toBeInTheDocument();
  });

  it('states the gateway\'s count of the single-call runs it left out of the lengths, and nothing when there are none', () => {
    const { unmount } = render(<SkillWorkPanel skills={SKILLS} oneCall={55} />);
    expect(screen.getByText(/the 55 single-call runs have no span/)).toBeInTheDocument();
    unmount();
    render(<SkillWorkPanel skills={SKILLS} oneCall={0} />);
    expect(screen.queryByText(/single-call/)).toBeNull();
  });

  it('draws its error in place of the table when the gateway could not read the skills', () => {
    render(<SkillWorkPanel skills={[]} oneCall={55} error="The runs by skill could not be read." />);
    expect(screen.getByText('The skills did not load')).toBeInTheDocument();
    expect(screen.queryByText(/single-call/)).toBeNull();
  });

  it('calls output observed output, and never a payload, a context, tokens or a cost', () => {
    render(<SkillWorkPanel skills={SKILLS} oneCall={55} />);
    expect(document.body.textContent).toContain('observed output per run');
    expect(document.body.textContent).not.toMatch(/payload|context|token|cost/i);
  });
});

describe('SkillWorkPanel refusals', () => {
  it('prints the share refused as a number, not a red pill on every row', () => {
    render(<SkillWorkPanel skills={SKILLS} oneCall={0} />);
    // Nearly every skill refuses something; a status hue on each row means nothing.
    const cell = within(row('sdlc-explore')).getByText('70.1%');
    expect(cell.closest('[class*="rose"], [class*="critical"]')).toBeNull();
    // None refused is a figure; no call to refuse is not.
    expect(within(row('zz-platform')).getByText('0.0%')).toBeInTheDocument();
    expect(within(row('sdlc-deck')).getAllByText('—').length).toBeGreaterThan(0);
  });
});

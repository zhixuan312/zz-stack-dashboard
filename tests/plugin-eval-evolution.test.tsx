import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalAutomationTrust, EvalEvolution } from '@/console/plugin-eval-evolution';
import type { PluginEvalFound } from '@/lib/api-shapes';

type Candidate = PluginEvalFound['candidates'][number];
const candidate = (over: Partial<Candidate>): Candidate => ({
  id: 'c1', hypothesis: 'tighten the refusal message', status: 'valid',
  complexityDelta: 12, touchedComponents: [], touchedOwners: ['zz'], createdAt: '2026-09-03T00:00:00Z',
  build: { ok: true, stage: null }, release: null, ...over,
});
function pluginEval(over: Partial<PluginEvalFound> = {}): PluginEvalFound {
  return {
    plugin: 'zz-core', found: true, origin: 'platform', ownerTeam: 'zz',
    releaseOwners: ['zz'], ownershipMode: 'owned', subjectVersion: null, run: null,
    evaluatorTrust: [], findings: { strengths: [], defects: [], unknowns: [] }, candidates: [],
    ...over,
  };
}

describe('EvalEvolution', () => {
  it('shows each candidate\'s status by its own word', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [
      candidate({ id: 'c1', status: 'recorded', build: null }),
      candidate({ id: 'c2', status: 'awaiting_build', build: null }),
      candidate({ id: 'c3', status: 'invalid', build: { ok: false, stage: 'gate' } }),
    ] })} />);
    expect(screen.getByText('Recorded')).toBeInTheDocument();
    expect(screen.getByText('Awaiting build')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('shows the build result: passed, failed at its stage, or not built', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [
      candidate({ id: 'c1', build: { ok: true, stage: null } }),
      candidate({ id: 'c2', status: 'invalid', build: { ok: false, stage: 'install' } }),
      candidate({ id: 'c3', status: 'recorded', build: null }),
    ] })} />);
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('at install')).toBeInTheDocument();
    expect(screen.getByText('Not built')).toBeInTheDocument();
  });

  it('reads "Evaluation only" on a third-party plugin\'s Evolution', () => {
    render(<EvalEvolution pluginEval={pluginEval({ ownershipMode: 'evaluation_only', candidates: [] })} />);
    expect(screen.getByText('Evaluation only')).toBeInTheDocument();
  });

  it('still lists a proposal for a third-party plugin — evaluation-only is not release-only', () => {
    render(<EvalEvolution pluginEval={pluginEval({
      ownershipMode: 'evaluation_only',
      candidates: [candidate({ release: null })],
    })} />);
    expect(screen.getByText('tighten the refusal message')).toBeInTheDocument();
    expect(screen.getByText('Not released')).toBeInTheDocument();
  });

  it('names a rollback, not the plain release status, once one has happened', () => {
    render(<EvalEvolution pluginEval={pluginEval({ candidates: [candidate({
      status: 'valid',
      release: { status: 'released', reason: null, releasedDeclaredVersion: '1.1.0',
        releaseRef: 'rel-1', verdict: 'rolled_back', verificationReason: 'regression on capability suite', rolledBack: true },
    })] })} />);
    expect(screen.getAllByText('Rolled back')).toHaveLength(1);
    expect(screen.queryByText('Released')).not.toBeInTheDocument();
  });
});

describe('EvalAutomationTrust', () => {
  it('shows ownership: origin, owner team and release owners', () => {
    render(<EvalAutomationTrust pluginEval={pluginEval({
      origin: 'third_party', ownerTeam: null, releaseOwners: [],
    })} />);
    expect(screen.getByText('Third party')).toBeInTheDocument();
    expect(screen.getByText('none recorded')).toBeInTheDocument();
    expect(screen.queryByText('Evolvable')).not.toBeInTheDocument();
    expect(screen.getByText('none — cannot be released')).toBeInTheDocument();
  });

  it('names every evaluator by its qualification state', () => {
    render(<EvalAutomationTrust pluginEval={pluginEval({
      evaluatorTrust: [
        { stableKey: 'refusal-quality', state: 'operationally_qualified', qualifiedAt: '2026-09-01T00:00:00Z' },
        { stableKey: 'tone-check', state: null, qualifiedAt: null },
      ],
    })} />);
    // In words, the stable key kept whole on hover.
    expect(screen.getByText('Refusal quality')).toHaveAttribute('title', 'refusal-quality');
    expect(screen.getByText('Qualified for use')).toBeInTheDocument();
    expect(screen.getByText('Tone check')).toHaveAttribute('title', 'tone-check');
    expect(screen.getByText('Never qualified')).toBeInTheDocument();
  });
});

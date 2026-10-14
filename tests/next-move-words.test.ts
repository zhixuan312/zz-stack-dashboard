import { describe, expect, it } from 'vitest';
import type { InitiativeRow } from '@/lib/work-shapes';
import { nextOf } from '@/views/initiatives-context';

/** A row whose only field read here is its next move. */
const row = (nextMove: InitiativeRow['nextMove']) => ({ nextMove }) as InitiativeRow;
const move = (action: string, document: string | null, waitingOn: string | null) =>
  row({ action, stage: null, document, waitingOn, why: 'because' } as NonNullable<InitiativeRow['nextMove']>);

describe('a row\'s next move reads in words, never zz-core\'s tokens', () => {
  it('says what comes next and who it waits on', () => {
    expect(nextOf(move('await_approval', 'spec.md', 'stakeholder'))).toBe('Approve spec.md, waiting on a person');
    expect(nextOf(move('write_document', 'plan.md', 'agent'))).toBe('Write plan.md, waiting on the agent');
    expect(nextOf(move('run_stage', null, 'agent'))).toBe('Run the next stage, waiting on the agent');
    expect(nextOf(move('decide', 'review.md', 'stakeholder'))).toBe('Decide on review.md, waiting on a person');
    expect(nextOf(move('closed', null, 'nobody'))).toBe('Closed');
    expect(nextOf(move('none', null, null))).toBe('No next move');
  });

  it('never prints a token with an underscore, and says when zz-core did not answer', () => {
    for (const a of ['write_document', 'await_approval', 'add_source', 'decide', 'fix', 'run_experiment', 'run_stage', 'resolve_branch', 'close', 'closed', 'none']) {
      expect(nextOf(move(a, 'x.md', 'stakeholder'))).not.toMatch(/_/);
    }
    expect(nextOf(row(null))).toBe('Next move unavailable');
  });
});

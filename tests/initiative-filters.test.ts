import { describe, expect, it } from 'vitest';
import { INITIATIVE_STATES, initiativeState, type StateOf } from '@/components/StateBadge';
import { periodCutoff } from '@/lib/period';

/**
 * The state vocabulary the badge renders and the facet filters by — ONE definition, tested
 * once. It was a chain of returns inside the badge's JSX, so a filter wanting the same
 * answer would have had to write the rule a second time and be free to disagree with it the
 * day a fourth outcome is added.
 */
const of = (outcome: string | null, gates: boolean[]): StateOf => ({
  outcome,
  gates: gates.map((passed, n) => ({ name: `g${n}`, passed })),
});

describe('what an initiative is doing', () => {
  it('reports the platform\'s three closed outcomes verbatim', () => {
    // close() records exactly one of these (OUTCOMES in @zz/contracts) and all three mean
    // closed — the difference between them is who signed, not whether it finished.
    expect(initiativeState(of('accepted', [true]))).toBe('Accepted');
    expect(initiativeState(of('delivered', [true]))).toBe('Delivered');
    expect(initiativeState(of('abandoned', [false]))).toBe('Abandoned');
  });

  it('lets a recorded outcome win over an open gate', () => {
    // Abandoned work stopped with its gates open, by definition. Reading the gate first
    // would file every abandoned initiative under "Waiting on you" — a queue of things
    // nobody is ever going to sign.
    expect(initiativeState(of('abandoned', [false, false]))).toBe('Abandoned');
  });

  it('separates work that needs a signature from work that is merely open', () => {
    expect(initiativeState(of(null, [true, false]))).toBe('Waiting on you');
    // Every gate passed, nothing recorded: done, and nobody closed it. Actionable, and a
    // different action from the one above.
    expect(initiativeState(of(null, [true, true]))).toBe('Ready to close');
    // No gates at all is not "ready" — there was never anything to pass.
    expect(initiativeState(of(null, []))).toBe('In progress');
  });

  it('can only ever answer with one of the six the facet offers', () => {
    // The facet is built from these strings. A seventh answer would be an option the
    // control never lists and a row no filter can reach.
    const answers = [
      of('accepted', []), of('delivered', []), of('abandoned', []),
      of(null, [false]), of(null, [true]), of(null, []),
    ].map(initiativeState);
    for (const a of answers) expect(INITIATIVE_STATES).toContain(a);
  });
});

describe('the date window over an initiative list', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const updated = (iso: string) => new Date(iso);

  it('keeps what moved inside the window and drops what did not', () => {
    const since = periodCutoff('7d', now)!;
    expect(updated('2026-09-09T23:41:00Z') >= since).toBe(true);
    expect(updated('2026-08-24T10:00:00Z') >= since).toBe(false);
  });

  it('filters nothing at all time, which is the default', () => {
    // `null` is an absent bound, not an old one — the page skips the filter entirely
    // rather than comparing against a date, so a backdated row cannot be excluded.
    expect(periodCutoff('all', now)).toBeNull();
  });
});

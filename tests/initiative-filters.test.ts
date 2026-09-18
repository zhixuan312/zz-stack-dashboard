import { describe, expect, it } from 'vitest';
import { INITIATIVE_STATES, initiativeState, type StateOf } from '@/components/StateBadge';
import { periodCutoff } from '@/lib/period';

/**
 * The state vocabulary the badge renders and the facet filters by — ONE definition, tested
 * once. It was a chain of returns inside the badge's JSX, so a filter wanting the same
 * answer would have had to write the rule a second time and be free to disagree with it the
 * day a fourth outcome is added.
 */
/** `gates` is one entry per gate: `true` passed, `false` written and unsigned, `null`
 *  NOT WRITTEN YET. The third is the one this fixture could not express — it modelled every
 *  unpassed gate as a signature owed, which is the mistake the code made too. */
const of = (outcome: string | null, gates: (boolean | null)[],
            handover?: boolean | null): StateOf => ({
  outcome,
  gates: [
    ...gates.map((g, n) => ({ name: `g${n}`, passed: g === true, written: g !== null })),
    // THE DERIVED HANDOVER, when the case wants one. The platform appends a gated
    // handover.md to every gating flow and it is signed AFTER the close, so on an open
    // initiative it is always unwritten — which made `Ready to close` unreachable the moment
    // the console started receiving it. Absent from a fixture, that regression is invisible.
    ...(handover === undefined ? [] : [{
      name: 'approve handover', role: 'handover',
      passed: handover === true, written: handover !== null,
    }]),
  ],
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
    // A GATE NOBODY HAS DRAFTED IS NOT A SIGNATURE OWED. There is nothing for a person to
    // read, so the work is waiting on the agent — which is what the Overview tile has always
    // said and what this column said the opposite of, one page apart.
    expect(initiativeState(of(null, [true, null]))).toBe('In progress');
    expect(initiativeState(of(null, [null, null]))).toBe('In progress');
    // Every gate passed, nothing recorded: done, and nobody closed it. Actionable, and a
    // different action from the one above.
    expect(initiativeState(of(null, [true, true]))).toBe('Ready to close');
    // …and it stays reachable with the platform's own handover gate hanging off the end,
    // unwritten as it must be until somebody closes the initiative.
    expect(initiativeState(of(null, [true, true], null))).toBe('Ready to close');
    // The handover never makes an open initiative read as waiting on a person either.
    expect(initiativeState(of(null, [true, false], null))).toBe('Waiting on you');
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

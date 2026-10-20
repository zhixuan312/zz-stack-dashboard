import { describe, expect, it } from 'vitest';
import { initiativeState, type StateOf } from '@/console/initiative-state';
import { filtersOf, listPath, narrowed, pageAt } from '@/views/initiatives-filter';

/**
 * What an initiative's page and its context say it is doing (`initiativeState`), and the address the Initiatives list
 * is read at, whose state filter sends the gateway's own states.
 */
/** `gates` is one entry per gate: `true` passed, `false` written and unsigned, `null` not
 *  written yet. The third is the distinction that matters — an unpassed gate is not
 *  automatically a signature owed. */
const of = (outcome: string | null, gates: (boolean | null)[],
            handover?: boolean | null): StateOf => ({
  outcome,
  gates: [
    ...gates.map((g, n) => ({ name: `g${n}`, passed: g === true, written: g !== null })),
    // The derived handover, when the case wants one. The platform appends a gated handover.md
    // to every gating flow and it is signed after the close, so on an open initiative it is
    // always unwritten — which is what makes `Ready to close` reachable or not.
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
    // A gate nobody has drafted is not a signature owed: there is nothing for a person to
    // read, so the work is waiting on the agent.
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
});

describe('the address an initiative list is read at', () => {
  const NONE = { q: '', state: 'all', flow: 'all', page: '1' };
  const params = (path: string) => Object.fromEntries(new URL(path, 'http://gateway.test').searchParams);

  it('asks for the first page of ten with no filter, and names only the filters in force', () => {
    expect(listPath(NONE)).toBe('/initiatives?limit=10&offset=0');
    expect(params(listPath({ q: '  search ', state: 'quiet', flow: 'sdlc-flow', page: '1' }))).toEqual({ q: 'search', state: 'quiet', flow: 'sdlc-flow', limit: '10', offset: '0' });
    expect(narrowed(NONE)).toBe(false);
    expect(narrowed({ ...NONE, q: ' ' })).toBe(false);
    expect(narrowed({ ...NONE, flow: 'sdlc-flow' })).toBe(true);
  });

  it('pages on the server: page n starts ten rows after page n - 1', () => {
    expect(params(listPath({ ...NONE, page: '3' }))).toEqual({ limit: '10', offset: '20' });
    // A page before the first, or none a number, is the first, never a negative offset the route refuses.
    expect(params(listPath({ ...NONE, page: '0' }))).toEqual({ limit: '10', offset: '0' });
    expect(params(listPath({ ...NONE, page: 'x' }))).toEqual({ limit: '10', offset: '0' });
    expect(params(listPath(NONE, { limit: 50, offset: 100 }))).toEqual({ limit: '50', offset: '100' });
    expect(pageAt(0)).toBe('1');
    expect(pageAt(25)).toBe('3');
  });

  it('reads the address a server page is handed, one value each', () => {
    expect(filtersOf({})).toEqual(NONE);
    expect(filtersOf({ state: ['quiet', 'open'], q: 'search', page: '2' })).toEqual({ q: 'search', state: 'quiet', flow: 'all', page: '2' });
  });
});

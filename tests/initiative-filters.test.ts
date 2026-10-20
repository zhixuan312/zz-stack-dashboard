import { describe, expect, it } from 'vitest';
import { ownGates, waitingGates, type StateOf } from '@/console/initiative-state';
import { filtersOf, listPath, narrowed, pageAt } from '@/views/initiatives-filter';

/**
 * The documents an initiative's page says it waits on, and the address the Initiatives list is read at, whose state
 * filter sends the gateway's own states.
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
    // always unwritten.
    ...(handover === undefined ? [] : [{
      name: 'approve handover', role: 'handover',
      passed: handover === true, written: handover !== null,
    }]),
  ],
});

describe('the documents an initiative waits on', () => {
  it('names a gate written and unsigned, never one nobody has drafted, and never the handover', () => {
    // A gate nobody has drafted is not a signature owed: there is nothing for a person to read.
    expect(waitingGates(of(null, [true, false, null]))).toEqual(['g1']);
    // The platform's handover is written after the close, so it is never one of an open initiative's gates.
    expect(waitingGates(of(null, [true, true], false))).toEqual([]);
    expect(ownGates(of(null, [true, true], null)).map((g) => g.name)).toEqual(['g0', 'g1']);
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

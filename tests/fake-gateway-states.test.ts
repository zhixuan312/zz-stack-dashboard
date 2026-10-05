import { describe, expect, it } from 'vitest';
import { extreme } from '../scripts/fake-gateway/states.ts';

/**
 * The fixture's own modes, which are what every state the console draws is checked against.
 *
 * `pnpm verify` runs `normal` only, so a mode that throws is a mode nothing notices — and this one
 * threw out of the request handler and killed the gateway process: every page after it reported
 * "cannot reach the platform", and the shape that caused it was the only thing the report did not
 * show. A transform reads an answer by its own idea of that route's shape, so a route that grows a
 * second answer — `/initiatives?waiting=1` returns `{ waiting }`, the list returns `{ initiatives }`
 * — is where it will break next.
 */
describe('the fixture can shape every answer its routes produce', () => {
  it('leaves an empty projection empty rather than inventing rows', () => {
    // Nothing waiting is a state the console draws ("Nothing needs a signature"); forty fabricated
    // gates would be a state it could never reach.
    expect(extreme(['initiatives'], { waiting: [] })).toEqual({ waiting: [] });
  });

  it('shapes a projection that has rows', () => {
    const one = { id: 'a/b/approve spec', gate: 'spec', team: 'a', slug: 'b', updated: '2026-10-05', stage: 'spec', at: 2, of: 7 };
    const got = extreme(['initiatives'], { waiting: [one] }) as { waiting: unknown[] };
    expect(got.waiting.length).toBeGreaterThan(1);
    expect(got.waiting[0]).toEqual(one);
  });

  it('shapes the list it has always shaped', () => {
    const one = { team: 'a', slug: 'b', flow: null, documents: 1, approvals: 0, updated: '2026-10-05',
                  stakeholder: null, at: 1, of: 7, stage: 'open', steps: [], gates: [], accepted: false,
                  complete: false, closed: false, outcome: null };
    const got = extreme(['initiatives'], { initiatives: [one] }) as { initiatives: unknown[] };
    expect(got.initiatives.length).toBeGreaterThan(1);
  });

  it('shapes every answer the routes actually produce, empty lists included', () => {
    // Each route paired with the answers `read()` gives it — the property that matters: a shape a
    // route really produces must not be a shape this mode does not know. The server catches what is
    // left out, so an unrecognised answer is served as it is rather than taking the gateway down;
    // that is a backstop, not the contract.
    const answers: [string[], unknown][] = [
      [['initiatives'], { waiting: [{ id: 'x', gate: 'g', team: 'a', slug: 'b', updated: 'u', stage: 's', at: 1, of: 2 }] }],
      [['initiatives'], { waiting: [] }],
      [['initiatives'], { initiatives: [] }],
      [['knowledge'], { nodes: [] }],
      [['knowledge', 'log'], { entries: [] }],
      [['teams'], { teams: [] }],
      [['people'], { people: [] }],
      [['runs'], { totals: { runs: 1, calls: 1, refusals: 0, mb: null } }],
      [['unknown-head'], { anything: true }],
      [[], {}],
    ];
    for (const [seg, body] of answers) {
      expect(() => extreme(seg, body), `extreme(${JSON.stringify(seg)}) threw`).not.toThrow();
    }
  });
});

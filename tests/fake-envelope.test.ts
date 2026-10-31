// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { envelopeFor, withEnvelope } from '../scripts/fake-gateway/envelope.ts';

// The wire stamps what is true of the request, and keeps what a route said of its own figures, as the gateway's mount does.
describe("the fake's read envelope", () => {
  const envelope = envelopeFor(true, ['initiatives', 'r42'])!;
  const meta = (body: unknown) => (body as { meta: Record<string, unknown> }).meta;

  it("keeps a route's own cacheHit, builtAt and sourceRevision", () => {
    const served = meta(withEnvelope([200, { meta: { asOf: 'x', cacheHit: true, builtAt: '2026-10-01T00:00:00Z', sourceRevision: 's1', observedAt: 'old', revision: 'old' } }], envelope));
    expect(served).toMatchObject({ asOf: 'x', cacheHit: true, builtAt: '2026-10-01T00:00:00Z', sourceRevision: 's1', revision: 'r42' });
    expect(served.observedAt).not.toBe('old');
  });

  it('answers a miss computed from rows where the route said nothing', () => {
    expect(meta(withEnvelope([200, { meta: { asOf: 'x' } }], envelope))).toMatchObject({ cacheHit: false, builtAt: null, sourceRevision: null, revision: 'r42' });
  });
});

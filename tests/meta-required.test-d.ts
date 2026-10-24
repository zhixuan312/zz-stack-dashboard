/**
 * `meta` is required of an answer and optional only of what a route or a fixture states.
 *
 * This file declares no test: it is a compile-time fixture, run by `pnpm typecheck` alone. Every console answer this
 * repository types has already crossed `services/gateway/src/console/read-envelope.ts`, which writes all five
 * request-scoped fields onto it, so a page reads `observedAt`, `revision`, `builtAt`, `sourceRevision` and `cacheHit`
 * without handling `undefined`. A `meta` that states the six figures and none of the five is a route's, before the
 * envelope, and is a compile error where an answer is expected — which is what the two `@ts-expect-error` lines below
 * hold. Remove them and the file passes, which is the failure they exist to catch: an unused directive is itself an
 * error, so this fixture is red while the five are optional and green once they are required.
 */
import type { ReadMeta } from '@/lib/platform-shapes';
import type { FixtureMeta } from '../scripts/fake-gateway/envelope';

/** The six a gateway route states: one read cutoff, its window, its scope, its population and where coverage begins. */
const FIGURES = {
  asOf: '2026-10-15T00:00:00Z', timezone: 'UTC',
  period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' },
  scope: 'active-team' as const, population: 'atlas', coverageFrom: null,
};

/** An answer: the six, and the five the envelope wrote as it left the gateway. */
const ANSWERED: ReadMeta = {
  ...FIGURES,
  observedAt: '2026-10-15T00:00:00.250Z', revision: 'a1b2c3', builtAt: null, sourceRevision: null, cacheHit: false,
};

/** The fixture's half of the same split: the six it states, and the five the fake's envelope completes at its boundary. */
const FIXTURE: FixtureMeta = { ...FIGURES };

// @ts-expect-error — all five left out: this is a route's meta, not an answer's.
const STATED: ReadMeta = { ...FIGURES };

// @ts-expect-error — one of the five left out is enough: a caller that needs `cacheHit` never handles `undefined`.
const ONE_SHORT: ReadMeta = {
  ...FIGURES,
  observedAt: '2026-10-15T00:00:00.250Z', revision: null, builtAt: null, sourceRevision: null,
};

void ANSWERED;
void FIXTURE;
void STATED;
void ONE_SHORT;

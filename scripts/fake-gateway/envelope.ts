/**
 * The envelope a fake console answer carries, and the one place an answer reaches the wire.
 *
 * The gateway stamps every console GET with five request-scoped fields (`services/gateway/src/console/read-envelope.ts`),
 * and the fake stamps the same five here, once, rather than in each fixture: a fixture that forgot them would be a route
 * the console's own tests never saw answer as the real one does. `meta` a route already wrote keeps every key the
 * envelope does not own, so a fixture's six stand beside these five. A fixture states the six and none of the five —
 * that is `FixtureMeta`, what its module exports — and `stamped` is the same completion for a fixture handed to
 * something that reads an answer, as the console's own page fixtures are.
 *
 * Split out of `server.ts` when the file passed the 700-line ceiling: none of this is routing, and the fake's routes are.
 */
import type { ServerResponse } from 'node:http';

import type { ReadMeta } from '../../src/lib/platform-shapes';
import { iso, now } from './clock.ts';

/** A route's answer: its status and its body, exactly as the fixture wrote it. */
export type Answer = [status: number, body: unknown];

/** The five fields the envelope adds to an answer's `meta`, as the console's own `ReadMeta` declares them. */
export type Envelope = Pick<ReadMeta, 'observedAt' | 'revision' | 'cacheHit' | 'builtAt' | 'sourceRevision'>;

/**
 * The `meta` a fixture states: the six a gateway route states, and the five the envelope writes onto it. The five are
 * optional here and required on `ReadMeta`, which is what a caller receives — a fixture that stated six where an answer
 * is expected does not compile, and one built through `stamped` below does.
 */
export type FixtureMeta = Omit<ReadMeta, 'observedAt' | 'revision' | 'builtAt' | 'sourceRevision' | 'cacheHit'> & {
  observedAt?: string; revision?: string | null; builtAt?: string | null; sourceRevision?: string | null; cacheHit?: boolean;
};

/**
 * A fixture answer: the shape the console reads, with its `meta` as a fixture states it rather than as a caller
 * receives it. A fixture states the six a route states and none of the five; a caller reads all eleven.
 */
export type FixtureAnswer<T extends { meta: unknown }> = Omit<T, 'meta'> & { meta: FixtureMeta };

/**
 * The meta a fixture states, as the answer a caller receives it: the five request-scoped fields the fixture cannot
 * know, written where a fixture is handed to something that reads an answer. It is the same completion `withEnvelope`
 * makes at the wire — a fixture read straight from its module is then the shape a served answer is, and the wire
 * writes the request's own `observedAt` and marker over this one before anything is sent.
 *
 * DELIBERATE: the fixture's own five win, so a fixture that states them keeps them (`work-record.ts` does, because
 * Record's route fills three of them itself); the rest are the miss this fake answers as.
 */
export function stamped(meta: FixtureMeta): ReadMeta {
  return {
    observedAt: iso(now()),
    revision: null, cacheHit: false, builtAt: null, sourceRevision: null,
    ...meta,
  };
}

/**
 * A fixture answer as the answer a caller receives: the same object with its `meta` stamped, and nothing else touched.
 * This is where a fixture crosses into an answer — at the hand-off, never at the fake's exit, so a fixture still states
 * six keys and the tests that pin that stay true.
 *
 * The assertion is the one this change needs, and it is sound because `meta` is the only field it completes: every other
 * field belongs to the fixture's own `T` and is carried through untouched, and `meta` is the read envelope's whole
 * subject. `T` infers where the argument is already a `FixtureAnswer<T>`; a spread-built literal may need it written out.
 */
export function answered<T extends { meta: unknown }>(a: FixtureAnswer<T>): T {
  return { ...a, meta: stamped(a.meta) } as T;
}

/**
 * The envelope this answer carries, or null for a request that answers none.
 *
 * `observedAt` is sampled here, before any route runs, as the gateway samples it: a read held past its bound (`slow`)
 * still says when it was asked, not when its answer was finally written. The marker is the one the read is answered
 * with (`revisionHeader`), null where its collection is one no tab may follow — the honest marker here, as null is
 * there. A write, a route outside `/api/console` and the screens before sign-in carry none, as they carry none in the
 * gateway.
 */
export function envelopeFor(consoleGet: boolean, revised: [string, string] | null): Envelope | null {
  return consoleGet
    ? { observedAt: new Date().toISOString(), revision: revised?.[1] ?? null, cacheHit: false, builtAt: null, sourceRevision: null }
    : null;
}

/**
 * `answer`'s body with `envelope` merged into its `meta`, as the gateway's own middleware merges it. None of the five is
 * ever a fixture's to state — the gateway lets a route keep its own `builtAt`, `sourceRevision` and `cacheHit` where it
 * stated them, and no fixture states one.
 *
 * A refusal (a status of 400 or more), a 204 and an array answer are handed back exactly as the route wrote them — an
 * error body carries no read, and an array has no object to be stamped on.
 */
export function withEnvelope(answer: Answer, envelope: Envelope | null): unknown {
  const body = answer[1];
  if (envelope === null || answer[0] >= 400 || typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const held = (body as { meta?: unknown }).meta;
  const meta = typeof held === 'object' && held !== null && !Array.isArray(held) ? held : {};
  return { ...body, meta: { ...meta, ...envelope } };
}

/**
 * Write the answer after `delayMs`, envelope and revision header included.
 *
 * A 204, or a 404 that says nothing, has no body to serialise, and a client that is sent one reads it wrong.
 */
export function sendAnswer(
  res: ServerResponse, answer: Answer, envelope: Envelope | null, revised: [string, string] | null, delayMs: number,
): void {
  setTimeout(() => {
    if (answer[1] === null) { res.writeHead(answer[0], { 'cache-control': 'no-store' }); res.end(); return; }
    res.writeHead(answer[0], { 'content-type': 'application/json', 'cache-control': 'no-store', ...(revised ? { [revised[0]]: revised[1] } : {}) });
    res.end(JSON.stringify(withEnvelope(answer, envelope)));
  }, delayMs);
}

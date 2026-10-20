/**
 * The fake gateway's state per request, and the answers `states.ts` does not draw: `partial`, and a fresh deployment's
 * answer for the routes `empty` had none for (Record, Releases, Usage and every detail route).
 *
 * A state is chosen by the session value, `zz_console=<person>+<state>`, which every console read forwards, the
 * browser's through the app's rewrite and the server's through `src/data/gateway.ts` (reconciliation 79). So one sweep
 * draws a page in every state beside the audit, the presses and the keyboard walk, which send a value with no `+` and
 * read the process-wide mode, `normal` in `pnpm verify`, throughout. The spec's five states have one mode each: loading
 * is `slow`, empty `empty`, a transport error `error`, a failed aggregate and a partial success both `partial`.
 *
 * `partial` is one part unavailable and the others answered: the first `Part` a response holds, in its own key order
 * and nearest the top, is `{ state: 'unavailable', reason: 'query_failed' }`, and Status's needs are also partial, one
 * kind of check not answered. A response with no part has nothing to fail alone and is answered as it is.
 *
 * `empty` for a detail route is the record there with nothing in it: an initiative with no document written, a
 * document with no body and no history, a lesson with no text, tag, citation or neighbour, a team with nobody in it and
 * no week recorded, a plugin never profiled. A release and a bug report are what a fresh deployment has none of, so
 * theirs is the route's not-found (`NOT_RECORDED`), as the gateway answers an id it does not hold. COUPLED: the
 * states-* tests draw the same records.
 */
import type { DocumentDetail, DocumentRevision, InitiativeDetail, KnowledgeBody, PluginEval } from '../../src/lib/api-shapes.ts';
import type { TeamDetail } from '../../src/lib/fleet-shapes.ts';
import type { PeriodFigure, PlatformStatus, Releases } from '../../src/lib/platform-shapes.ts';
import type { RecordRead, WritingEstimate } from '../../src/lib/work-shapes.ts';

/**
 * How long `slow` holds a page's read, and the status read: past every bound a read is given, the 4.5 seconds each page's
 * read on the console's server and each read in the browser wait before the page says the platform did not answer, so
 * the state draws each page's loading and then that bounded state, never its content late. `/me` is spared, so the gate
 * still lets the person in. COUPLED: `READ_BOUND_MS` (src/views/context.ts), which tests/sweep-docs.test.ts holds under this.
 */
export const SLOW_MS = 6000;

/** Every state a request may ask for: the spec's five, and `extreme`, which a ceiling is drawn in. */
export const STATES = ['normal', 'empty', 'error', 'slow', 'extreme', 'partial'] as const;
export type State = (typeof STATES)[number];
export const isState = (s: string): s is State => (STATES as readonly string[]).includes(s);

/** A session value split at its first `+`: the person it signs in, and the state it asks for, null when it names none. */
export function sessionOf(value: string | null): { person: string | null; state: string | null } {
  if (value === null) return { person: null, state: null };
  const at = value.indexOf('+');
  return at < 0 ? { person: value, state: null } : { person: value.slice(0, at), state: value.slice(at + 1) };
}

/** What a session value asking for a state this fake does not draw is answered, naming it. */
export const unknownState = (value: string, state: string): [number, { error: string }] =>
  [400, { error: `zz_console=${value} asks for the state ${JSON.stringify(state)}, and this fake gateway draws ${STATES.join(', ')}` }];

const UNAVAILABLE = { state: 'unavailable', reason: 'query_failed' } as const;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
/** A `Part` that answered: `{ state: 'ok', data }`, and nothing else beside them. */
const isPart = (v: unknown): boolean => isObject(v) && v.state === 'ok' && 'data' in v && Object.keys(v).length === 2;

/** The keys to the first answered part in `body`, nearest the top first and in key order within a level; null for none. */
function firstPart(body: unknown): (string | number)[] | null {
  let level: { at: (string | number)[]; v: unknown }[] = [{ at: [], v: body }];
  while (level.length) {
    const next: typeof level = [];
    for (const { at, v } of level) {
      if (at.length && isPart(v)) return at;
      if (Array.isArray(v)) v.forEach((x, i) => next.push({ at: [...at, i], v: x }));
      else if (isObject(v)) for (const [k, x] of Object.entries(v)) if (k !== 'meta') next.push({ at: [...at, k], v: x });
    }
    level = next;
  }
  return null;
}

/** `body` with the value at `at` replaced, copied along the way and nowhere else. */
function replaced(body: unknown, at: (string | number)[], value: unknown): unknown {
  if (!at.length) return value;
  const [k, ...rest] = at;
  if (Array.isArray(body)) return body.map((x, i) => (i === k ? replaced(x, rest, value) : x));
  return { ...(body as Json), [k]: replaced((body as Json)[k], rest, value) };
}

/** Status's needs with the first row's kind of check unanswered: its rows gone, nothing totalled, the rest still known. */
function partialNeeds(needs: PlatformStatus['needs']): PlatformStatus['needs'] {
  const kind = needs.rows[0]?.kind ?? 'drift';
  const rows = needs.rows.filter((r) => r.kind !== kind);
  const { [kind]: _dropped, ...overflowByKind } = needs.overflowByKind;
  const knownCount = rows.reduce((n, r) => n + r.instanceCount, 0) + Object.values(overflowByKind as Record<string, number | undefined>).reduce((n: number, c) => n + (c ?? 0), 0);
  return { ...needs, state: 'partial', rows, total: null, knownCount, unavailableKinds: [kind], overflowByKind, headline: `${knownCount} known issues; some checks unavailable` };
}

/** One part unavailable, the others answered; Status's needs partial too. */
export function partial(seg: string[], body: unknown): unknown {
  const [head, a] = seg;
  const status = head === 'platform' && a === 'status' && !seg[2];
  const shaped = status ? { ...(body as PlatformStatus), needs: partialNeeds((body as PlatformStatus).needs) } : body;
  const at = firstPart(shaped);
  return at ? replaced(shaped, at, UNAVAILABLE) : shaped;
}

const NO_DATA = { value: null, why: 'no_data' } as const;
const isFigure = (v: Json) => 'value' in v && 'why' in v && Object.keys(v).length <= 3;
const isPeriodFigure = (v: Json) => 'window' in v && 'figure' in v && 'numerator' in v;
/** A timestamp a fresh deployment has none of: the instant something last or first happened. */
const INSTANT = /(^at|At|Since)$/;

/**
 * A route's answer as a fresh deployment gives it, for a shape with no fresh answer of its own: every figure read and
 * holding no data, every count zero, every list of records empty, every instant something happened at unrecorded, and a
 * series of weeks still its weeks, each holding nothing. What the read says about itself (`meta`) is kept.
 */
function unrecorded(v: unknown, key = ''): unknown {
  if (key === 'meta' || key === 'window' || key === 'timezone') return v;
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return INSTANT.test(key) ? null : v;
  if (Array.isArray(v)) {
    // A series of weeks, or a grid of counts, keeps its places; any other list is of records, and there are none.
    if (v.every((x) => typeof x === 'number' || Array.isArray(x) || (isObject(x) && 'window' in x))) return v.map((x) => unrecorded(x));
    return [];
  }
  if (!isObject(v)) return v;
  if (isFigure(v)) return { ...v, ...NO_DATA };
  if (isPeriodFigure(v)) return { ...v, figure: NO_DATA, numerator: null, denominator: null };
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unrecorded(x, k)]));
}

const NO_CLAIMS = { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 };

/** What `freshDetail` answers for a record a fresh deployment does not hold: the server answers it as the route's not-found. */
export const NOT_RECORDED = Symbol('not recorded');

/**
 * The writing estimate of a team that has written nothing: no word read and no hour estimated, out of no document. A
 * null estimate is a store that could not be read, which is a failure, not a fresh deployment.
 */
export const noWriting = (e: WritingEstimate | null): WritingEstimate | null => e && {
  ...e, words: 0, hours: 0,
  coverage: { documents: 0, revisions: 0, importMade: 0, unrecorded: 0, mixed: 0, datedByLastWrite: 0, undated: 0, missingLegacy: 0 },
};
const unread = (p: PeriodFigure): PeriodFigure => ({ ...p, figure: NO_DATA, numerator: null, denominator: null });

/** Releases on a fresh deployment: nothing released, no migration applied, every week holding no release. */
function noReleases(r: Releases): Releases {
  return {
    ...r,
    tiles: { releases: 0, lastWeek: 0, latest: null, migrations: { applied: 0, lastAt: null } },
    weeks: r.weeks.map((w) => ({ ...w, releases: 0, malformedPer1000: unread(w.malformedPer1000) })),
    rows: { state: 'ok', data: { rows: [], total: 0 } },
  };
}

/**
 * The fresh answer for a route `empty` in states.ts has none for, or undefined when the route is one it draws itself:
 * Record, Releases and Usage, and every detail route, each with nothing in it.
 */
export function freshDetail(seg: string[], body: unknown, q: URLSearchParams): unknown {
  const [head, a, b, c] = seg;
  if (!isObject(body)) return undefined;
  switch (head) {
    case 'record': return { ...(unrecorded(body) as Json), lead: { ...(body.lead as RecordRead['lead']), estimate: noWriting((body as unknown as RecordRead).lead.estimate) } };
    case 'initiatives':
      return a && b ? { ...(body as unknown as InitiativeDetail), documents: [], decisions: [], decisionCounts: NO_CLAIMS, steps: [], gates: [], at: 0, of: 0, stage: '', correction: null } satisfies InitiativeDetail : undefined;
    case 'document':
      if (q.get('revision') !== null) return { ...(body as unknown as DocumentRevision), body: null } satisfies DocumentRevision;
      return { ...(body as unknown as DocumentDetail), body: null, bytes: 0, versions: [], sources: [], decisions: [], decisionCounts: NO_CLAIMS } satisfies DocumentDetail;
    case 'knowledge':
      return a && a !== 'summary' && a !== 'log'
        ? { ...(body as unknown as KnowledgeBody), body: '', tags: null, evidence: null, evidence_in: null, cited_elsewhere: 0, related: [] } satisfies KnowledgeBody
        : undefined;
    case 'teams':
      return a ? { ...(body as unknown as TeamDetail), members: [], tiles: { people: 0, openWork: 0, waiting: 0, lessons: 0 }, calls: [] } satisfies TeamDetail : undefined;
    case 'plugins':
      return a && b === 'eval' ? { plugin: a, found: false } satisfies PluginEval : undefined;
    case 'platform':
      if (a === 'usage' && !b) return unrecorded(body);
      if (a === 'releases' && !b) return noReleases(body as unknown as Releases);
      if ((a === 'releases' || a === 'bugs') && b && !c) return NOT_RECORDED;
      return undefined;
    default: return undefined;
  }
}

/**
 * What every unread figure stands in as while a check asks for it (`__nulls` in server.ts): a number no fixture holds,
 * so a page that drew a zero for a figure the answer sent as null draws this in its place, and the check sees which.
 */
export const NULL_STANDIN = 7777;

/** `body` with every figure answered as null (a `Figure`'s value, a `PeriodFigure`'s numerator and denominator) answered as `NULL_STANDIN`. */
export function nullsFilled(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(nullsFilled);
  if (!isObject(v)) return v;
  const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, nullsFilled(x)]));
  if (isFigure(v) && v.value === null) out.value = NULL_STANDIN;
  if (isPeriodFigure(v)) for (const k of ['numerator', 'denominator']) if (v[k] === null) out[k] = NULL_STANDIN;
  return out;
}

/**
 * The fake gateway's journeys: the writes a `<person>+journey` session makes, kept for that session (reconciliation 80).
 *
 * Every other session's writes are answered and forgotten, so the suites `pnpm verify` runs side by side read the same
 * data throughout. A guide's task to try is a write and then a read of what it changed (approve a document and see the
 * history gain it, close an initiative and see Record move), so scripts/journeys.ts signs in as `member+journey` or
 * `superadmin+journey`, and those sessions alone keep what they write, for the life of the process. A journey reads the
 * normal state: it is a kind of session, not one of the states a page is drawn in, so it is not in `STATES`.
 *
 * Five writes are kept: an approval, a close, a bug's resolution, a person added and a token issued. The server records
 * each once the write has been answered as a success, and while it answers a journey session's request it makes that
 * session's record the current one (`within`); the fixtures read `kept()` where they derive what the write changes, and
 * find nothing outside a journey, so every other answer, and every answer zz-stack's checks read with plain `node`, is
 * the fixture's own. The server is synchronous from a request's arrival to its answer, so one record is current at a
 * time.
 *
 * COUPLED: zz-stack's checks import the fixtures that read this, with plain `node`, so it imports nothing through the
 * console's path alias.
 */
import { now } from './clock.ts';
import { sessionOf } from './states-partial.ts';

/** The session kind that keeps its writes: `zz_console=<person>+journey`. */
const JOURNEY = 'journey';

/** What one journey session has written, oldest first. */
type Journal = {
  /** Revisions approved, each by the person who signed it. */
  approved: { team: string; initiative: string; path: string; signer: string; at: string }[];
  /** Initiatives closed, with the outcome the platform derived. */
  closed: { team: string; slug: string; outcome: 'accepted' | 'delivered' | 'abandoned'; at: string }[];
  /** Bug reports resolved, as the resolve form sent them. */
  resolved: { id: string; status: 'fixed' | 'not_a_bug' | 'duplicate'; resolution: string; duplicateOf: string | null; at: string }[];
  /** People added to the platform. */
  added: { email: string; name: string; at: string }[];
  /** Tokens issued, to the person who asked. */
  issued: { id: string; label: string; email: string; at: string }[];
};

const journals = new Map<string, Journal>();
let current: Journal | null = null;

/** Whether a session value is a journey's. */
export const isJourney = (value: string | null): boolean => sessionOf(value).state === JOURNEY;

/** The journey record of the request being answered; null outside a journey. */
export const kept = (): Journal | null => current;

/** `answer()`, with `value`'s record current while it runs when `value` is a journey's, and none otherwise. */
export function within<T>(value: string | null, answer: () => T): T {
  let journal: Journal | null = null;
  if (value !== null && isJourney(value)) {
    journal = journals.get(value) ?? { approved: [], closed: [], resolved: [], added: [], issued: [] };
    journals.set(value, journal);
  }
  const before = current;
  current = journal;
  try {
    return answer();
  } finally {
    current = before;
  }
}

/** How many writes of each kind `value`'s session has kept, none for a session that never wrote or is no journey's. */
export function writtenBy(value: string): Record<keyof Journal, number> {
  const j = journals.get(value);
  return { approved: j?.approved.length ?? 0, closed: j?.closed.length ?? 0, resolved: j?.resolved.length ?? 0, added: j?.added.length ?? 0, issued: j?.issued.length ?? 0 };
}

/**
 * When a kept write happened: a minute before the fake's clock. Every read's cutoff is that clock, the moment the
 * server started (clock.ts), so a write dated at the real time would fall after the cutoff and outside every period.
 */
export const keptAt = (): string => new Date(now() - 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');

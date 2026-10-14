/**
 * The fake gateway's live stream: Server-Sent Events that tell a console tab which collection changed.
 *
 * The shape is the one `zz-stack/services/gateway`'s `/api/console/live` serves and the one
 * `.agents/skills/zz-meridian/references/live.md` asks for, because the console has to be checkable
 * against it without a deployment:
 *
 *   retry: 3000
 *
 *   event: resync
 *   data: {"collections":["initiatives","knowledge"]}
 *
 *   event: change
 *   data: {"collection":"initiatives"}
 *
 *   : beat 1791181947919
 *
 * The `resync` frame is part of the shape and this fixture never sends one: the real gateway raises it for the two
 * things that mean a tab missed changes, and neither is reachable here — see `hint` below, which is the only thing
 * this file can raise.
 *
 * A hint names a collection and nothing else — never a record, a team or a cache tag — and is never data: a missed
 * hint costs freshness, never correctness, which is why the tab also has a safety poll and takes its own catch-up
 * when it is coming back. There is no `id:` because the stream does not replay.
 */
import type { ServerResponse } from 'node:http';

/** The collections a tab may follow: the console's reads, by their first path segment. `document` is singular because the read is (`/document/<team>/<initiative>/<path>`), not because it is one record. */
export const COLLECTIONS = [
  'me', 'overview', 'teams', 'initiatives', 'document', 'knowledge', 'plugins', 'skills',
  'people', 'runs', 'activity', 'settings',
] as const;

export const MAX_NAMES = 50;
const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const HEARTBEAT_MS = 15000;

type Subscriber = {
  names: string[];
  write: (frame: string) => void;
  close: () => void;
};

const subscribers = new Set<Subscriber>();

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * Tell every tab following `name` that its collection changed, and return how many were reached.
 *
 * DELIBERATE, in two places, and both are where the real gateway is not this simple. Nobody signed in here can be
 * revoked mid-stream, so nothing re-authorizes before a frame — the real `/api/console/live` asks the session and
 * the scope again before every data-bearing frame, and closes the stream when
 * the caller may no longer read what they subscribed to. And a frame is written here as soon as it is raised, where
 * the real one queues hints behind that check and collapses the queue into a single `resync` past 100 waiting: with
 * nothing to await there is nothing to queue, and a bound on a queue that never holds more than one thing would be a
 * branch no check could reach. A console that worked against this file's silence would be relying on nothing.
 */
export function hint(name: string): number {
  let reached = 0;
  for (const s of [...subscribers]) {
    if (!s.names.includes(name)) continue;
    reached++;
    s.write(frame('change', { collection: name }));
  }
  return reached;
}

/** How many tabs are following anything: a check reads this to know a stream is open before it fires a hint. */
export function liveStreams(): number {
  return subscribers.size;
}

/** 400 for a list that is empty or malformed, 403 for a name the console has no read for — one body for unknown and forbidden alike. */
export function parseNames(raw: string | null): { names: string[] } | { status: number; error: string } {
  const parts = raw ? raw.split(',') : [];
  if (parts.length === 0 || !parts.every((n) => NAME.test(n))) return { status: 400, error: 'Name the collections to follow.' };
  const names = [...new Set(parts)];
  if (names.length > MAX_NAMES) return { status: 400, error: 'Name the collections to follow.' };
  if (!names.every((n) => (COLLECTIONS as readonly string[]).includes(n))) return { status: 403, error: 'You do not have access to that.' };
  return { names };
}

/** Hold `res` open as one tab's stream, with `names` already authorized. */
export function serveLive(res: ServerResponse, names: string[]): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });
  // Flush the header now: a stream whose headers wait for the first frame shows nothing until one arrives.
  res.flushHeaders?.();

  let closed = false;
  const s: Subscriber = {
    names,
    write: (f) => { if (!closed) res.write(f); },
    close: () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      subscribers.delete(s);
      res.end();
    },
  };

  const timer = setInterval(() => s.write(`: beat ${Date.now()}\n\n`), HEARTBEAT_MS);
  /* The RESULT's close, not the request's: a GET's request stream ends as soon as its headers are read, so
   * `req.on('close')` fires at once and would close every stream the moment it opened. */
  res.on('close', s.close);
  subscribers.add(s);
  s.write(`retry: 3000\n\n`);
  /* DELIBERATE: no resync here, which is the real gateway's shape too.
   *
   * This used to write one, on the reasoning that "a tab that has just opened has read nothing yet" — which is the
   * half that is wrong, and it cost a document route its LCP. The tab has read: it read every collection it shows
   * while the page mounted, a moment before it subscribed. Answering the connect with a resync told it to read them
   * all again, so it threw away answers it held, re-rendered every panel, and did it in the window where the page's
   * largest element was waiting to be painted — measured at 390px with the phone profile, the body was read three
   * times and the paint the LCP is taken from landed at 2,676 ms against a 2,500 ms bar.
   *
   * `resync` therefore means what its name says: the tab missed changes. `hint` above is the only thing that raises
   * one here, and the real gateway raises it for the same two reasons — its `LISTEN` connection was down, or a burst
   * overflowed the queue. A tab coming back from an error or from being hidden takes its own catch-up; the console's
   * `src/lib/live.ts` says how it knows to. */
}

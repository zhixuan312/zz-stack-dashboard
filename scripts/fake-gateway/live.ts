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
 *   event: synced
 *   data: {}
 *
 *   event: change
 *   data: {"collection":"initiatives"}
 *
 *   : beat 1791181947919
 *
 * A stream opens with its greeting, as the real gateway's does: `synced` when nothing it follows moved since the
 * revisions the tab's page was served (`since`), or a `resync` naming what did, which is every name for a stream asked
 * with none. After that the real gateway raises `resync` for the two things that mean a tab missed changes, and neither
 * is reachable here, so `hint` below is the only other frame this file can raise.
 *
 * Every read is answered with the revision of its collection (`revisionHeader`), as the real gateway's are: this
 * process's boot and the count of hints raised for that collection since it started. The real gateway counts each
 * caller's own, by the teams that caller may hear; here every tab hears every hint, so one count is every caller's.
 *
 * A hint names a collection and nothing else — never a record, a team or a cache tag — and is never data: a missed
 * hint costs freshness, never correctness, which is why the tab also has a safety poll and takes its own catch-up
 * when it is coming back. There is no `id:` because the stream does not replay.
 */
import type { ServerResponse } from 'node:http';

/** The collections a tab may follow: the console's reads, by their first path segment. `document` is singular because the read is (`/document/<team>/<initiative>/<path>`), not because it is one record. */
export const COLLECTIONS = [
  'me', 'teams', 'initiatives', 'document', 'knowledge', 'plugins', 'skills',
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

/** This process's boot, in every revision it answers: a revision from another process never matches one of this one's. */
const BOOT = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** The hints raised for each collection since the process started. */
const hinted = new Map<string, number>();
const REVISION = /^[A-Za-z0-9_-]+:\d+$/;

/** `name`'s revision now. */
const revisionOf = (name: string): string => `${BOOT}:${hinted.get(name) ?? 0}`;

/** The reads whose collection is another's, as the console's `src/views/console-live.tsx` keeps them. */
const KEPT_UNDER: Record<string, string> = { approvals: 'initiatives', access: 'settings' };

/**
 * The revision header a read of `seg` (the path past `/api/console`) is answered with, as `[name, value]`, or null for a
 * read whose collection a tab may not follow. COUPLED: the real gateway's `x-zz-revision`
 * (zz-stack's services/gateway/src/console/live-revision.ts), read by the console's `src/data/gateway.ts` and
 * `src/lib/api.ts` as `<collection>:<boot>:<n>`.
 */
export function revisionHeader(seg: string[]): [string, string] | null {
  const name = KEPT_UNDER[seg[0] ?? ''] ?? seg[0] ?? '';
  return (COLLECTIONS as readonly string[]).includes(name) ? ['x-zz-revision', `${name}:${revisionOf(name)}`] : null;
}

/**
 * The names a stream's greeting resyncs: every one of `names` whose revision in `since` is not the one held now, all of
 * them with no `since`. A pair that is not `<name>:<boot>:<n>` is ignored, which resyncs its name, as the real gateway's
 * `movedSince` does.
 */
function movedSince(names: string[], since: string | null): string[] {
  if (since === null) return names;
  const served = new Map<string, string>();
  for (const pair of since.split(',')) {
    const at = pair.indexOf(':');
    const name = pair.slice(0, at);
    const revision = pair.slice(at + 1);
    if (at > 0 && REVISION.test(revision) && !served.has(name)) served.set(name, revision);
  }
  return names.filter((n) => served.get(n) === undefined || served.get(n) !== revisionOf(n));
}

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
  hinted.set(name, (hinted.get(name) ?? 0) + 1);
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

/** Hold `res` open as one tab's stream, with `names` already authorized; `since` is the revisions the tab's page was
 *  served, as the request sent them, or null. */
export function serveLive(res: ServerResponse, names: string[], since: string | null = null): void {
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
  const moved = movedSince(names, since);
  s.write(`retry: 3000\n\n`);
  /* The stream opens with its greeting, which the real gateway sends too (zz-stack's
   * `services/gateway/src/console/live.ts`, held by its `checks/console-live-greeting.ts` and `console-live-since.ts`).
   *
   * COUPLED: `src/lib/live.ts`, ZZ Meridian's own file. Asked with revisions, it waits for the greeting and reads only
   * what a resync names, nothing for `synced`; asked with none, it reads everything as it opens and takes the first
   * resync for that read, then reads again on every later one. A stream with no greeting would have its first real
   * resync taken for the greeting and thrown away. Nothing here raises a second one: `hint` writes `change` frames, and
   * the real gateway's two reasons to resync again — its `LISTEN` connection was down, or a burst overflowed the queue —
   * are unreachable in a fixture that revokes nobody and queues nothing. */
  s.write(moved.length > 0 ? frame('resync', { collections: moved }) : frame('synced', {}));
}

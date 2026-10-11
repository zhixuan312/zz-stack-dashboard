# Live data: one stream per tab, hints, resync and the safety poll

A console tab keeps its tables fresh with one Server-Sent Events stream that carries hints, never data. A hint says
which collection changed; the tab then reads that collection again through the authorized `read()` of
`cache.md`. Every migration `update` reports for the live console names a section below.

Read "The demo's limits" before relying on any of this across more than one server process.

## The live starters

`GET /api/live?collections=members,keys` authenticates first, bounds the request to at most 50 distinct names and
authorizes each. An empty or malformed request is 400, no session is 401, and an unknown or forbidden name is 403 with
one generic body that does not say which, so no existence is disclosed. The caller is never silently subscribed to a
broader scope. A successful response has `content-type: text/event-stream` and `cache-control: no-cache, no-transform`:

```text
retry: 3000

event: resync
data: {"collections":["members","keys"]}

event: change
data: {"collection":"members"}

: beat 1791181947919
```

The stream carries no `id:` because it does not replay. A `Last-Event-ID` the browser sends back never suppresses the
first `resync` and never implies that anything was recovered. A heartbeat carries transport time, not proof that data
was fetched. An adapter may observe richer events internally, but it authorizes and reduces them to the `LiveEvent`
hint, `{ collection: string }`, before anything is sent: no row identifier, tenant or cache tag reaches the browser.

Before each data-bearing `change` or `resync` is sent, the stream asks `authorize` again, with the current session
and authorization, not the admission check made when the stream opened. When the scope may no longer read the
collection, or access cannot be established, delivery stops and the stream closes; the browser authenticates again to
reconnect. Heartbeats may check session expiry; they never stand in for authorizing a payload. Subscriptions and timers
are cleaned up on abort, error or cancellation, and the queue is bounded: past 100 waiting hints they collapse into one
`resync` of every name instead of growing.

`optional:app/api/live/route.ts` is the Route Handler. It exports only `GET`:

```ts
import { Unauthenticated, can, collectionFor, resolveAccess } from '@/data/access';
import { liveStream } from '@/data/live-stream';

const MAX_NAMES = 50;
const NAME = /^[A-Za-z0-9_-]{1,64}$/;

const text = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** `GET /api/live?collections=members,keys`: change hints for the collections the caller may read. 400 malformed, 401 without a session, 403 for any name they may not read. */
export async function GET(request: Request): Promise<Response> {
  const scope = await resolveAccess().catch((e: unknown) => { if (e instanceof Unauthenticated) return null; throw e; });
  if (!scope) return text(401, 'Sign in to continue.');

  const raw = new URL(request.url).searchParams.get('collections');
  const parts = raw ? raw.split(',') : [];
  if (parts.length === 0 || !parts.every((n) => NAME.test(n))) return text(400, 'Name the collections to follow.');
  const names = [...new Set(parts)];
  if (names.length > MAX_NAMES) return text(400, 'Name the collections to follow.');

  // An unknown name and a forbidden one answer alike, so neither is disclosed.
  if (!(await Promise.all(names.map((n) => can(scope, n, 'read')))).every(Boolean)) return text(403, 'You do not have access to that.');

  return liveStream({
    names,
    collections: names.map((n) => collectionFor(scope, n)),
    signal: request.signal,
    authorize: async (name) => {
      const now = await resolveAccess().catch(() => null);
      return now !== null && now.tenantId === scope.tenantId && now.subjectId === scope.subjectId && can(now, name, 'read');
    },
  });
}
```

`optional:src/data/live-stream.ts` is the stream:

```ts
/**
 * The live stream: Server-Sent Events that tell a tab which collections changed, so it reads them again. A hint names
 * a collection and nothing else: no record, tenant or cache tag leaves the server. A hint is sent only after the
 * scope is checked again, and a scope that may no longer read what it subscribed to ends the stream.
 */
import type { AnyCollection } from '@/lib/collection';

/** The most hints waiting to be sent; beyond that they collapse into one resync. */
const MAX_QUEUED = 100;

let noted = false;

type LiveStreamOptions = {
  /** The requested names, already authorized once; the first frame is a resync of them. */
  names: string[];
  /** One scope-bound collection per name, in the same order. */
  collections: AnyCollection[];
  signal: AbortSignal;
  heartbeatMs?: number;
  /** Whether the current scope may still read a collection; asked before every hint is sent. */
  authorize: (name: string) => Promise<boolean>;
};

export function liveStream({ names, collections, signal, heartbeatMs = 15000, authorize }: LiveStreamOptions): Response {
  const encoder = new TextEncoder();
  const unsubscribe: Array<() => void> = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const send = (frame: string) => controller.enqueue(encoder.encode(frame));
  const resync = () => `event: resync\ndata: ${JSON.stringify({ collections: names })}\n\n`;

  function close() {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    for (const off of unsubscribe) off();
    unsubscribe.length = 0;
    signal.removeEventListener('abort', close);
    try { controller.close(); } catch { /* already cancelled */ }
  }

  // Hints wait here while the scope is checked; past the bound they collapse into one resync of every name.
  let queue: string[] = [];
  let overflowed = false;
  let draining = false;

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (!closed && (overflowed || queue.length > 0)) {
        const checked = overflowed ? names : [queue.shift()!];
        const frame = overflowed ? resync() : `event: change\ndata: ${JSON.stringify({ collection: checked[0] })}\n\n`;
        overflowed = false;
        const allowed = (await Promise.all(checked.map(authorize))).every(Boolean);
        if (closed) return;
        if (!allowed) return close();
        send(frame);
      }
    } catch {
      close();
    } finally {
      draining = false;
    }
  }

  function hint(name: string) {
    if (closed) return;
    if (process.env.LIVE_DROP_HINTS === '1') {
      if (!noted) {
        noted = true;
        console.log('note: LIVE_DROP_HINTS is set; change hints are dropped (a test switch)');
      }
      return;
    }
    if (overflowed) return;
    if (queue.length >= MAX_QUEUED) {
      queue = [];
      overflowed = true;
    } else if (!queue.includes(name)) queue.push(name);
    void drain();
  }

  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      if (signal.aborted) return close();
      signal.addEventListener('abort', close);
      send(`retry: 3000\n\n${resync()}`);
      collections.forEach((collection, i) => {
        const off = collection.subscribe?.(() => hint(names[i]!));
        if (off) unsubscribe.push(off);
      });
      timer = setInterval(() => { if (!closed) send(`: beat ${Date.now()}\n\n`); }, heartbeatMs);
    },
    cancel: close,
  });

  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform' },
  });
}
```

## Refreshing

`optional:src/data/live-actions.ts` exports `refreshCollections(names)`, a Server Action. The names come from the
browser, so each is authorized against the caller's current access, and one the caller may not read is skipped without a
trace. It drops only those collections' cached reads, and the router refresh that follows reads them again. With no
session it resolves `{ ok: false, status: 401 }` instead of throwing, because a thrown error loses its `status` in a
production build; the client turns that value into a 401 error, which pauses the live provider.

```ts
'use server';

import { updateTag } from 'next/cache';
import { Unauthenticated, can, resolveAccess } from '@/data/access';
import { collectionTag } from '@/data/read';

const MAX_NAMES = 50;

/**
 * Drops the cached reads of the collections the caller may read, so the router refresh that follows reads them again.
 * The names come from the browser, so each is authorized here; one the caller may not read is skipped without a trace.
 * A caller without a session gets a refusal value, not a throw: a thrown error loses its status in a production build.
 */
export async function refreshCollections(names: string[]): Promise<{ ok: true } | { ok: false; status: 401 }> {
  const scope = await resolveAccess().catch((e: unknown) => { if (e instanceof Unauthenticated) return null; throw e; });
  if (!scope) return { ok: false, status: 401 };
  const asked = [...new Set(Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [])].slice(0, MAX_NAMES);
  for (const name of asked) {
    if (await can(scope, name, 'read')) updateTag(collectionTag(scope.tenantId, name));
  }
  return { ok: true };
}
```

The managed `src/lib/live.ts` holds the provider and does not import this file, so a project that has not added it still
compiles. The team-owned client `optional:src/views/console-live.tsx` injects it. The layout passes it a promise of the
scope key and never awaits it, so the page does not wait for the request:

```tsx
'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { refreshCollections } from '@/data/live-actions';
import { LiveProvider } from '@/lib/live';

type Ready = { scopeKey: string; pollMs?: number };

/** Waits for the caller's scope in its own boundary and reports it, so the page never waits and its children never remount. */
function ResolveScope({ scope, onReady }: { scope: Promise<string>; onReady: (ready: Ready) => void }) {
  const scopeKey = use(scope);
  useEffect(() => {
    // `?livePollMs=` is a test hook: the live check shortens the safety poll with it.
    const ms = Number(new URLSearchParams(window.location.search).get('livePollMs'));
    onReady({ scopeKey, pollMs: ms > 0 ? ms : undefined });
  }, [scopeKey, onReady]);
  return null;
}

/** Every console page's live data: one stream per tab, opened once the scope has resolved. A refresh reauthorizes the names, then reads the route again; a refusal throws a 401 the provider pauses on. */
export function ConsoleLive({ scope, children }: { scope: Promise<string>; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState<Ready>({ scopeKey: '' });
  const refresh = async (names: string[]) => {
    const result = await refreshCollections(names);
    if (!result.ok) throw Object.assign(new Error('Sign in to see live data.'), { status: result.status });
    router.refresh();
  };
  return (
    <LiveProvider refresh={refresh} scopeKey={ready.scopeKey} pollMs={ready.pollMs}>
      <Suspense fallback={null}>
        <ResolveScope scope={scope} onReady={setReady} />
      </Suspense>
      {children}
    </LiveProvider>
  );
}
```

In the dashboard layout, wrap the page in it, with `scope` resolved from the caller and never awaited:

```tsx
const scope = resolveAccess().then((s) => `${s.tenantId}/${s.subjectId}`);
// ...
<ConsoleLive scope={scope}>{children}</ConsoleLive>
```

A view calls `useLive(['members'])` to register what it shows and gets one of `'connecting'`, `'live'`, `'polling'`,
`'paused'` or `'stale'`. The provider owns the one `EventSource` for the union of the names, the visibility listener,
the timeouts and the safety poll. How it behaves:

- A transport open is not `live`: the first resynchronization must succeed. A failed read keeps the previous observation
  and shows the data as stale; it never advances the data's observation time.
- Hints wait at most 500 ms and coalesce. One refresh runs at a time, and what arrives meanwhile runs next. A refresh
  slower than 10 s counts as failed.
- A safety refresh runs every `pollMs` (30 s) even on a healthy stream. A failed connection is retried after a second;
  after the third failure the tab polls, and tries the stream again on every fifth poll.
- An authorization failure pauses the stream. A hidden tab closes it, and showing the tab again resyncs. On logout, a
  scope change or an authorization failure the provider disposes the stream and the old scope's client state, and no
  event from an earlier connection applies after that. `scopeKey` is a reset key for the browser, never proof of access.

## The demo's limits

The sample's collections are arrays on `globalThis`, so the demo is a single process: the route handler, the Server
Actions and the pages of one `next start` or `next dev` share them, and a change in that process reaches that
process's streams. Two server processes each hold their own copy. A write in one is invisible in the other, its hints
never cross, and the arrays cannot be shared between processes. A serverless or multi-instance deployment therefore
needs a store and a hint transport that all instances share: the adapters below.

Polling cannot reconcile divergent stores. The safety poll and the resync only make a tab read again; what a tab reads
is whatever the process it reached holds. When the stores differ, the poll faithfully shows the wrong answer on a
schedule. Fix the store, not the schedule.

## What an adapter must do

A production collection is bound to the authorized scope: its database predicate is applied inside `query`, and its
`subscribe` is filtered to what that scope may see. It then:

- emits a hint only after the write has committed, never before and never for a rolled-back write;
- sends the collection's name and nothing else to the browser (the transports below carry a tenant and a collection
  name between servers, and never a row);
- on any gap, such as a lost connection, a restarted server or a full queue, emits a hint for every subscribed
  collection, which is a resync: a notification sent while the listener was away is gone, and a hint is cheap;
- cleans up when the last subscriber leaves, and when a reconnect fails retries with a bounded backoff.

The two adapters below need packages the template does not install (`pg`, `ioredis`). They are working shapes to adapt,
not files to paste unread, and the template's checks do not compile them.

## Postgres: LISTEN and NOTIFY

One dedicated connection per server process does `LISTEN`, shared by every subscriber, including those that subscribe while
it is still connecting (`opening` is the one in-flight connection; a second `Client` would leak and duplicate hints). A writer calls `pg_notify` in the
same transaction as its write, so Postgres delivers the NOTIFY only when that transaction commits, and a rollback sends
nothing. The payload is a tenant and a collection name (a payload may not exceed 8000 bytes, and carries no row).

```ts
// example: src/data/postgres-live.ts, which needs `pg`
import { Client, type PoolClient } from 'pg';
import type { LiveEvent } from '@/lib/collection';

const CHANNEL = 'meridian_changes';
type Subscriber = { tenantId: string; name: string; deliver: (event: LiveEvent) => void };

/** Call inside the writing transaction, before COMMIT: Postgres sends the NOTIFY only if the transaction commits. */
export async function notifyChange(tx: PoolClient, tenantId: string, name: string): Promise<void> {
  await tx.query('select pg_notify($1, $2)', [CHANNEL, JSON.stringify({ t: tenantId, c: name })]);
}

export function postgresLive(connectionString: string) {
  const subscribers = new Set<Subscriber>();
  let client: Client | undefined;
  let opening: Promise<void> | undefined; // the connection in flight: every subscriber that arrives meanwhile shares it
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const fanOut = (match: (s: Subscriber) => boolean) => {
    for (const s of [...subscribers]) {
      if (!match(s)) continue;
      try { s.deliver({ collection: s.name }); } catch { /* a subscriber's failure is never the listener's */ }
    }
  };

  function lost(c: Client) {
    if (client === c) client = undefined;
    c.removeAllListeners();
    c.on('error', () => {});
    void c.end().catch(() => {});
    schedule();
  }

  function schedule() {
    if (retry || client || subscribers.size === 0) return;
    // Bounded backoff: half a second, doubling, never more than 30 seconds.
    retry = setTimeout(() => { retry = undefined; connect(); }, Math.min(30_000, 500 * 2 ** attempt++));
  }

  function connect() {
    if (client || opening || subscribers.size === 0) return;
    opening = open().finally(() => { opening = undefined; });
  }

  async function open() {
    const c = new Client({ connectionString });
    c.on('error', () => lost(c));
    c.on('end', () => lost(c));
    c.on('notification', (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      let change: { t?: unknown; c?: unknown };
      try { change = JSON.parse(msg.payload); } catch { return fanOut(() => true); }
      fanOut((s) => s.tenantId === change.t && s.name === change.c);
    });
    try {
      await c.connect();
      await c.query(`LISTEN ${CHANNEL}`);
    } catch {
      return lost(c);
    }
    if (subscribers.size === 0) return void c.end().catch(() => {});
    client = c;
    attempt = 0;
    // A notification sent while no connection was listening is gone: every subscriber reads again (a resync).
    fanOut(() => true);
  }

  function stop() {
    clearTimeout(retry);
    retry = undefined;
    const c = client;
    client = undefined;
    if (c) { c.removeAllListeners(); c.on('error', () => {}); void c.end().catch(() => {}); }
  }

  /** The `subscribe` of a collection bound to one tenant's scope: the policy's `bind` puts it on the collection. */
  return (tenantId: string, name: string) => (deliver: (event: LiveEvent) => void) => {
    const s: Subscriber = { tenantId, name, deliver };
    subscribers.add(s);
    connect();
    return () => {
      subscribers.delete(s);
      if (subscribers.size === 0) stop();
    };
  };
}
```

Bind it where the policy binds the collection, so the subscription is the tenant's own:

```ts
const subscribeTo = postgresLive(process.env.DATABASE_URL!);
// in policy.bind: the collection with its predicate applied, and its tenant's subscription
return { ...membersFor(scope.tenantId), subscribe: subscribeTo(scope.tenantId, 'members') };
```

If what a subject may see differs inside a tenant, put a visibility group in the payload and filter on it in `fanOut`;
the stream still asks `authorize` before each hint is sent.

## Redis pub/sub

Every server process holds one subscriber connection; a writer publishes after its write has committed. Redis pub/sub
is at-most-once: a message published while a subscriber is disconnected is not kept, so the adapter resyncs every
subscriber each time the connection becomes ready again.

```ts
// example: src/data/redis-live.ts, which needs `ioredis`
import Redis from 'ioredis';
import type { LiveEvent } from '@/lib/collection';

const CHANNEL = 'meridian:changes';
type Subscriber = { tenantId: string; name: string; deliver: (event: LiveEvent) => void };

export function redisLive(url: string) {
  const subscribers = new Set<Subscriber>();
  let sub: Redis | undefined;
  let publisher: Redis | undefined;
  let ready = false;

  const fanOut = (match: (s: Subscriber) => boolean) => {
    for (const s of [...subscribers]) {
      if (!match(s)) continue;
      try { s.deliver({ collection: s.name }); } catch { /* a subscriber's failure is never the listener's */ }
    }
  };

  function start() {
    if (sub) return;
    // ioredis reconnects with its own backoff and subscribes again; `ready` fires after each connection.
    const c = new Redis(url, { maxRetriesPerRequest: null });
    sub = c;
    c.on('error', () => {});
    c.on('ready', () => {
      // Anything published while this connection was away is gone: every subscriber reads again (a resync).
      if (ready) fanOut(() => true);
      ready = true;
    });
    c.on('message', (channel, payload) => {
      if (channel !== CHANNEL) return;
      let change: { t?: unknown; c?: unknown };
      try { change = JSON.parse(payload); } catch { return fanOut(() => true); }
      fanOut((s) => s.tenantId === change.t && s.name === change.c);
    });
    void c.subscribe(CHANNEL).catch(() => {});
  }

  function stop() {
    sub?.removeAllListeners();
    sub?.disconnect();
    sub = undefined;
    ready = false;
  }

  /** Call after the write has committed. A failed publish is never the write's failure: the safety poll bounds the delay. */
  async function publish(tenantId: string, name: string): Promise<void> {
    publisher ??= new Redis(url, { maxRetriesPerRequest: 1 });
    try { await publisher.publish(CHANNEL, JSON.stringify({ t: tenantId, c: name })); } catch { /* the next poll reads it */ }
  }

  /** The `subscribe` of a collection bound to one tenant's scope. */
  const subscribeTo = (tenantId: string, name: string) => (deliver: (event: LiveEvent) => void) => {
    const s: Subscriber = { tenantId, name, deliver };
    subscribers.add(s);
    start();
    return () => {
      subscribers.delete(s);
      if (subscribers.size === 0) stop();
    };
  };

  return { subscribeTo, publish };
}
```

Both adapters hint a collection by name only. Neither replays: a client that reconnects gets a `resync`, and reads the
collection through `read()`, which is the only thing that ever returns data.

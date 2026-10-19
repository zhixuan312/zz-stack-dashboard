/**
 * Live data in the browser: one stream per tab that hints which collections changed, and a scheduler that reads them
 * again. A hint is never data: it only says a collection is worth reading, so a missed hint costs freshness, never
 * correctness, and the safety poll and the resync on every open bound that cost. The open that does not resync is one
 * for new names, a page's first or a client navigation's: the views' servers read the collections at a revision, the
 * stream is asked whether any moved since, and the greeting says `synced` (nothing to read) or `resync` naming what moved.
 *
 * `createLiveClient` is the whole scheduler and needs no framework; `LiveProvider` and `useLive` put it in a React tree.
 * The page's `refresh` is injected, so this file imports nothing from a product's data layer.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** `connecting` until the first resync succeeds, `live` while hints and resyncs both work, `polling` after the stream gave up, `paused` when access was refused, `stale` when the last read failed. */
export type LiveState = 'connecting' | 'live' | 'polling' | 'paused' | 'stale';

/** The revision of each collection a page was served, by name: `<boot>:<n>`, as the server's reads return it. */
export type Revisions = Record<string, string>;

export type LiveClientOptions = {
  /** Reads the named collections again; a rejection becomes a state, it never escapes. */
  refresh: (names: string[]) => Promise<void>;
  endpoint?: string;
  pollMs?: number;
  EventSource?: typeof EventSource;
  /** The revisions the views were served, asked for when a stream opens for new names; none, or an empty answer, opens as a reopen after a gap does. */
  since?: () => Revisions | undefined;
  onState?: (state: LiveState) => void;
};

export type LiveClient = {
  setNames: (names: string[]) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

/** The longest a hint waits before its refresh starts: a maximum wait, so a sustained burst still refreshes every 500 ms. */
const MAX_WAIT_MS = 500;
/** A refresh slower than this is abandoned as failed, so it never blocks the next one. */
const REFRESH_TIMEOUT_MS = 10_000;
const RECONNECT_MS = 1000;
/** Consecutive failed connection attempts before the client polls instead. */
const MAX_ATTEMPTS = 3;
/** While polling, the stream is tried again on every fifth poll. */
const RETRY_EVERY = 5;

const isAuthError = (e: unknown): boolean => {
  const { status, name } = (e ?? {}) as { status?: unknown; name?: unknown };
  return status === 401 || status === 403 || name === 'Unauthenticated' || name === 'AccessDenied';
};

const pageVisible = (): boolean => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function createLiveClient({ refresh, endpoint = '/api/live', pollMs = 30000, EventSource: Source = globalThis.EventSource, since, onState }: LiveClientOptions): LiveClient {
  let names: string[] = [];
  let visible = pageVisible();
  let disposed = false;
  let paused = false;
  let polling = false;
  let state: LiveState | null = null;
  /** Bumped whenever results in flight must stop counting: the page hid, or the client ended. */
  let epoch = 0;
  let source: EventSource | null = null;
  let opened = false;
  /** Whether a full read has succeeded since the stream last opened; only then does a hint's refresh mean `live`. */
  let synced = false;
  let attempts = 0;
  let polls = 0;
  let inFlight = false;
  let wantAll = false;
  /** Set by a `resync` greeting: the names it carries are read, and the read counts as the full one the open skipped. */
  let greeted = false;
  /** Whether the names changed since a stream last opened: only such an open may carry the revisions the views were served, since a reopen after a gap (an error, a hidden tab, a poll's retry) follows lost hints. */
  let newNames = true;
  const dirty = new Set<string>();
  let dirtyTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const emit = (next: LiveState) => {
    if (next === state) return;
    state = next;
    onState?.(next);
  };
  const active = () => !disposed && !paused && visible && names.length > 0;

  function closeSource() {
    source?.close();
    source = null;
    opened = false;
    synced = false;
  }
  function stopTimers() {
    clearTimeout(dirtyTimer);
    clearTimeout(reconnectTimer);
    clearInterval(pollTimer);
    dirtyTimer = reconnectTimer = pollTimer = undefined;
  }

  /** Runs the next refresh when none is in flight: everything on a resync, otherwise the dirty names. */
  function pump() {
    if (inFlight || !active() || (!wantAll && dirty.size === 0)) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = undefined;
    const full = wantAll || greeted;
    const batch = wantAll ? names : names.filter((n) => dirty.has(n));
    wantAll = false;
    greeted = false;
    dirty.clear();
    if (batch.length > 0) void run(batch, full);
  }

  async function run(batch: string[], full: boolean) {
    inFlight = true;
    const mine = epoch;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => refresh(batch))(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('The refresh took too long.')), REFRESH_TIMEOUT_MS); }),
      ]);
      if (mine === epoch && !disposed) {
        if (full) synced = true;
        if (synced && opened) emit('live');
        else if (polling) emit('polling');
      }
    } catch (e) {
      if (mine === epoch && !disposed) {
        if (isAuthError(e)) {
          paused = true;
          closeSource();
          stopTimers();
          emit('paused');
        } else {
          emit('stale');
        }
      }
    } finally {
      clearTimeout(timeout);
      inFlight = false;
      pump();
    }
  }

  const resync = () => {
    wantAll = true;
    pump();
  };
  /** The first greeting named what moved since the page's read: read just those, and a read of them is a full one. */
  const resyncMoved = (moved: string[]) => {
    const some = moved.filter((n) => names.includes(n));
    if (some.length === 0) {
      synced = true;
      if (opened) emit('live');
      return;
    }
    for (const n of some) dirty.add(n);
    greeted = true;
    pump();
  };
  const hint = (name: string) => {
    if (!names.includes(name)) return;
    dirty.add(name);
    if (!inFlight && dirtyTimer === undefined) dirtyTimer = setTimeout(pump, MAX_WAIT_MS);
  };

  function connect() {
    closeSource();
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    if (!active()) return;
    if (!polling) emit('connecting');
    if (!Source) return failed();
    const served = newNames ? since?.() : undefined;
    const pairs = Object.entries(served ?? {}).filter(([n, r]) => names.includes(n) && r);
    const sent = pairs.length > 0;
    const asked = sent ? `&since=${encodeURIComponent(pairs.map(([n, r]) => `${n}:${r}`).join(','))}` : '';
    const mine = new Source(`${endpoint}?collections=${encodeURIComponent(names.join(','))}${asked}`);
    source = mine;
    const current = () => source === mine && !disposed;
    mine.addEventListener('open', () => {
      if (!current()) return;
      opened = true;
      attempts = 0;
      polling = false;
      newNames = false;
      // With revisions sent, the greeting answers whether anything moved, and the read waits for it.
      if (!sent) resync();
    });
    // A stream opened without revisions is greeted with a resync of every name (src/data/live-stream.ts). The open above
    // has just asked for that read, and it began after the frame was written, so the frame says nothing the open did
    // not: answering both read every collection twice on every open, and on a page load the second router read sent
    // every prefetch out again. Any later resync is the server reporting lost hints. A stream opened with the revisions
    // the page was served is greeted with what moved since, and that greeting is the only answer: `synced` is live
    // with no read, `resync` reads the names it carries.
    let greeting = true;
    mine.addEventListener('synced', () => {
      if (!current() || !greeting) return;
      greeting = false;
      if (!sent) return;
      synced = true;
      if (opened) emit('live');
    });
    mine.addEventListener('resync', (e) => {
      if (!current()) return;
      if (greeting) {
        greeting = false;
        if (!sent) return;
        let moved = names;
        try {
          const { collections } = JSON.parse((e as MessageEvent<string>).data) as { collections?: unknown };
          if (Array.isArray(collections)) moved = collections.filter((n): n is string => typeof n === 'string');
        } catch {
          // A greeting that is not one reads everything, as a resync does.
        }
        return resyncMoved(moved);
      }
      resync();
    });
    mine.addEventListener('change', (e) => {
      if (!current()) return;
      // A hint before any greeting means the greeting was lost: read everything, as an open without revisions does.
      if (greeting && sent) resync();
      greeting = false;
      try {
        const { collection } = JSON.parse((e as MessageEvent<string>).data) as { collection?: unknown };
        if (typeof collection === 'string') hint(collection);
      } catch {
        // A hint that is not one is ignored; the next resync or poll still covers the collection.
      }
    });
    mine.addEventListener('error', () => {
      if (!current()) return;
      closeSource();
      failed();
    });
  }

  /** One failed connection attempt: try again in a second, or give the stream up for polling after the third. */
  function failed() {
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      polling = true;
      emit('polling');
      return;
    }
    if (!polling) emit('connecting');
    reconnectTimer = setTimeout(connect, RECONNECT_MS);
  }

  function startPoll() {
    if (pollTimer !== undefined || !active()) return;
    pollTimer = setInterval(() => {
      resync();
      if (!polling) return;
      polls += 1;
      if (polls % RETRY_EVERY === 0) {
        attempts = MAX_ATTEMPTS - 1;
        connect();
      }
    }, pollMs);
  }

  const onOnline = () => { if (active()) resync(); };
  globalThis.addEventListener?.('online', onOnline);

  return {
    setNames(next) {
      const union = [...new Set(next)].sort();
      if (disposed || union.join(',') === names.join(',')) return;
      names = union;
      newNames = true;
      closeSource();
      stopTimers();
      if (names.length === 0) return;
      connect();
      startPoll();
    },
    setVisible(next) {
      if (disposed || next === visible) return;
      visible = next;
      epoch += 1;
      if (!visible) {
        closeSource();
        stopTimers();
        return;
      }
      if (active()) {
        attempts = 0;
        connect();
        startPoll();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch += 1;
      closeSource();
      stopTimers();
      globalThis.removeEventListener?.('online', onOnline);
    },
  };
}

type LiveContextValue = { state: LiveState; register: (names: string[], since?: Revisions) => () => void };
const LiveContext = createContext<LiveContextValue | null>(null);

export type LiveProviderProps = {
  children: ReactNode;
  refresh: (names: string[]) => Promise<void>;
  endpoint?: string;
  pollMs?: number;
  /** A non-authoritative browser reset key, never proof of access: a new one disposes the old stream, and an empty one opens nothing. */
  scopeKey: string;
};

/** Owns the tab's one stream: the hooks below register the names they show, and the stream follows their union. */
export function LiveProvider({ children, refresh, endpoint, pollMs, scopeKey }: LiveProviderProps): ReactNode {
  const [reported, setReported] = useState<{ scopeKey: string; state: LiveState }>({ scopeKey, state: 'connecting' });
  const [hub] = useState(() => {
    const hooks = new Map<symbol, { names: string[]; since?: Revisions }>();
    const h = {
      client: null as LiveClient | null,
      latest: refresh,
      attach(c: LiveClient | null) { h.client = c; },
      follow(r: LiveProviderProps['refresh']) { h.latest = r; },
      union: () => [...hooks.values()].flatMap((hook) => hook.names),
      // Per name, the oldest revision any hook was served: a hook without one, or served by another process, leaves the name out, and the server then resyncs it.
      since(): Revisions | undefined {
        const out: Revisions = {};
        for (const name of new Set(h.union())) {
          const held = [...hooks.values()].filter((hook) => hook.names.includes(name)).map((hook) => hook.since?.[name]);
          const at = held.map((r) => (r ? /^([^:]+):(\d+)$/.exec(r) : null));
          if (at.some((m) => !m) || new Set(at.map((m) => m![1])).size !== 1) continue;
          out[name] = `${at[0]![1]}:${Math.min(...at.map((m) => Number(m![2])))}`;
        }
        return Object.keys(out).length > 0 ? out : undefined;
      },
      // A hook that changes its names unregisters and registers in one commit; applying the union a microtask later keeps the stream from closing in between.
      register(wanted: string[], since?: Revisions) {
        const id = Symbol('live');
        hooks.set(id, { names: wanted, since });
        void Promise.resolve().then(() => h.client?.setNames(h.union()));
        return () => {
          hooks.delete(id);
          void Promise.resolve().then(() => h.client?.setNames(h.union()));
        };
      },
    };
    return h;
  });
  useEffect(() => { hub.follow(refresh); });

  useEffect(() => {
    if (!scopeKey) return;
    const c = createLiveClient({ refresh: (names) => hub.latest(names), endpoint, pollMs, since: () => hub.since(), onState: (state) => setReported({ scopeKey, state }) });
    hub.attach(c);
    c.setNames(hub.union());
    const onVisibility = () => c.setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      c.dispose();
      hub.attach(null);
    };
  }, [hub, scopeKey, endpoint, pollMs]);

  const value = useMemo<LiveContextValue>(
    () => ({ state: reported.scopeKey === scopeKey ? reported.state : 'connecting', register: hub.register }),
    [reported, scopeKey, hub],
  );
  return createElement(LiveContext.Provider, { value }, children);
}

/**
 * Registers the collections a view shows and returns how fresh the tab's data is. `since` is the revisions the page's
 * server read them at: the stream that opens for them asks whether any moved instead of reading them all again. Outside a
 * provider it registers nothing and reports `paused`.
 */
export function useLive(collections: string[], since?: Revisions): LiveState {
  const live = useContext(LiveContext);
  const register = live?.register;
  const key = [...new Set(collections)].sort().join(',');
  const served = since ? JSON.stringify(since) : '';
  useEffect(() => register?.(key ? key.split(',') : [], served ? (JSON.parse(served) as Revisions) : undefined), [register, key, served]);
  return live?.state ?? 'paused';
}

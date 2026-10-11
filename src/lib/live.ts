/**
 * Live data in the browser: one stream per tab that hints which collections changed, and a scheduler that reads them
 * again. A hint is never data: it only says a collection is worth reading, so a missed hint costs freshness, never
 * correctness, and the safety poll and the resync on every open bound that cost.
 *
 * `createLiveClient` is the whole scheduler and needs no framework; `LiveProvider` and `useLive` put it in a React tree.
 * The page's `refresh` is injected, so this file imports nothing from a product's data layer.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** `connecting` until the first resync succeeds, `live` while hints and resyncs both work, `polling` after the stream gave up, `paused` when access was refused, `stale` when the last read failed. */
export type LiveState = 'connecting' | 'live' | 'polling' | 'paused' | 'stale';

export type LiveClientOptions = {
  /** Reads the named collections again; a rejection becomes a state, it never escapes. */
  refresh: (names: string[]) => Promise<void>;
  endpoint?: string;
  pollMs?: number;
  EventSource?: typeof EventSource;
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

export function createLiveClient({ refresh, endpoint = '/api/live', pollMs = 30000, EventSource: Source = globalThis.EventSource, onState }: LiveClientOptions): LiveClient {
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
    const full = wantAll;
    const batch = full ? names : names.filter((n) => dirty.has(n));
    wantAll = false;
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
    const mine = new Source(`${endpoint}?collections=${encodeURIComponent(names.join(','))}`);
    source = mine;
    const current = () => source === mine && !disposed;
    mine.addEventListener('open', () => {
      if (!current()) return;
      opened = true;
      attempts = 0;
      polling = false;
      resync();
    });
    mine.addEventListener('resync', () => { if (current()) resync(); });
    mine.addEventListener('change', (e) => {
      if (!current()) return;
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

type LiveContextValue = { state: LiveState; register: (names: string[]) => () => void };
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
    const names = new Map<symbol, string[]>();
    const h = {
      client: null as LiveClient | null,
      latest: refresh,
      attach(c: LiveClient | null) { h.client = c; },
      follow(r: LiveProviderProps['refresh']) { h.latest = r; },
      union: () => [...names.values()].flat(),
      // A hook that changes its names unregisters and registers in one commit; applying the union a microtask later keeps the stream from closing in between.
      register(wanted: string[]) {
        const id = Symbol('live');
        names.set(id, wanted);
        void Promise.resolve().then(() => h.client?.setNames(h.union()));
        return () => {
          names.delete(id);
          void Promise.resolve().then(() => h.client?.setNames(h.union()));
        };
      },
    };
    return h;
  });
  useEffect(() => { hub.follow(refresh); });

  useEffect(() => {
    if (!scopeKey) return;
    const c = createLiveClient({ refresh: (names) => hub.latest(names), endpoint, pollMs, onState: (state) => setReported({ scopeKey, state }) });
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

/** Registers the collections a view shows and returns how fresh the tab's data is. Outside a provider it registers nothing and reports `paused`. */
export function useLive(collections: string[]): LiveState {
  const live = useContext(LiveContext);
  const register = live?.register;
  const key = [...new Set(collections)].sort().join(',');
  useEffect(() => register?.(key ? key.split(',') : []), [register, key]);
  return live?.state ?? 'paused';
}

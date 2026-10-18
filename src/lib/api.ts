'use client';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { createContext, createElement, use, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { preload } from 'react-dom';
import { clearThread } from '@/components/patterns/assistant/thread';

/**
 * Every read a page does for its own content.
 *
 * From the browser. The session cookie belongs to the person at the browser, and it sends it to the origin that issued
 * it. The console's server makes one read of its own for every page, `/me` as the caller, to decide whether the page
 * may render and which destinations the rail draws (`src/data/access.ts`, through `src/data/gateway.ts`, which says what
 * it sends and why), and the assistant's route reads through the same module. A page's own content is still read here,
 * in the browser: nothing in this file goes through that module.
 *
 * Which is why the path is relative. `/api/console/...` resolves against whatever host the page
 * was served from, and Caddy routes that path on the console host to the gateway — no base URL,
 * no CORS, no preflight. On a laptop `next.config.ts` routes it to the gateway in `ZZ_GATEWAY`, the
 * same address the server reads `/me` from; the console has no offline mode.
 */
const BASE = '/api/console';

export class ApiError extends Error {
  // Declared and assigned rather than a `readonly status` parameter property: those are the
  // one class member TypeScript cannot erase, and this repository is compiled by erasure.
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * How long a page read may go unanswered, from the moment it is sent, before the page says it failed: half a second
 * under the spec's five, which is what the phone profile takes to draw that state, so a person sees it within five
 * seconds of the read (spec AC-8.7; measured 111 to 255 ms on 2026-10-14). COUPLED: `scripts/primary-data.ts` holds
 * the screen to five seconds with no allowance.
 */
const READ_BOUND_MS = 4_500;

/**
 * One page read, given `READ_BOUND_MS`: a read that has not answered by then is a 504 with a sentence that says so, and
 * the request is aborted. A page never shows an endless skeleton; it shows the read's error state, whose Retry reads
 * again. The sentence names no number, so it stays true whatever the bound is. The bound is a race, not only the abort, so it holds when a request does not honour the signal,
 * and an answer that arrives after it is never seen.
 *
 * Page reads only. The live stream is an EventSource held open by design, and writes go through `src/lib/mutate.ts`.
 */
async function consoleFetch<T>(path: string): Promise<T> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new ApiError(504, 'The platform did not answer in time. Nothing in this part of the page was read.'));
    }, READ_BOUND_MS);
  });
  try {
    return await Promise.race([read<T>(path, abort.signal), bound]);
  } finally {
    clearTimeout(timer);
  }
}

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // The cookie is HttpOnly and same-origin; this says "send it".
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    // The gateway names its refusals — "the console needs a browser sign-in — x@y
    // authenticated by pat" — and that sentence is the whole diagnosis. A generic "request
    // failed" throws it away.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Who a page is read by, as the console's server resolved it for the page: the caller's address, the team they act for
 * and their role, from `chromeAccess()` (`src/data/access.ts`), the one promise the layout makes and hands down. Every
 * read's key carries the three, so an answer is drawn only for the caller, team and role it was asked as.
 */
type PageCaller = { caller: string; team: string | null; role: string };

/** What the layout hands down: `chromeAccess()`'s promise, settled on null when nobody could be resolved. */
type ServerAccess = Promise<{ caller?: string; team?: string | null; user: { role: string } } | null>;

const CallerContext = createContext<ServerAccess | null>(null);

function callerOf(access: Awaited<ServerAccess>): PageCaller | null {
  return access?.caller ? { caller: access.caller, team: access.team ?? null, role: access.user.role } : null;
}

/** The key a team switch is announced on to every other tab of this browser. */
const SWITCH_KEY = 'zz-stack-team-switch';

/**
 * Mounted by the layout around the shell, with the promise the rail is given. It holds the promise, never awaits it:
 * a read awaits it (`useConsole`), and the server resolved it before any page's content, so in the browser it has
 * settled before anything reads it and nothing waits.
 *
 * It also follows a team switched in another tab of this browser, which arrives as a `storage` event on `SWITCH_KEY`:
 * this tab leaves for the new team as the switching tab did (`afterTeamSwitch`), since the session is the browser's and
 * every tab now reads the new team. `storage` never fires in the tab that wrote it, so this cannot loop with the switch.
 *
 * The assistant's thread is not kept here: ZZ Meridian's `AssistantScope`, which the layout mounts with the same
 * person and team, keeps it for that scope alone and removes one stored for another as soon as it resolves.
 */
export function ConsoleCaller({ access, children }: { access: ServerAccess; children?: ReactNode }) {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SWITCH_KEY && e.newValue !== null) leaveForTheNewTeam();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return createElement(CallerContext.Provider, { value: access }, children);
}

/** Clears the thread, then replaces the document with the same address: every query, the mounted assistant and any answer or stream in flight go with it. */
function leaveForTheNewTeam(tellTheOtherTabs = false) {
  clearThread(window.localStorage);
  if (tellTheOtherTabs) {
    try {
      // A fresh value every time: the browser announces a write to the other tabs only when the value changes.
      window.localStorage.setItem(SWITCH_KEY, `${Date.now()}:${Math.random()}`);
    } catch {
      // Storage refused: the other tabs are not told, and each reads the new team at its next load.
    }
  }
  window.location.replace(window.location.href);
}

/**
 * What a team switch the gateway accepted does, in this order: the assistant's thread is cleared, every other tab is
 * told, and this document is replaced with the same address, so the server draws the chrome again for the new team and
 * the next load reads an empty thread. A refused switch never reaches this, and leaves the page as it was.
 */
export function afterTeamSwitch(): void {
  leaveForTheNewTeam(true);
}

/**
 * False on the server and on the render that hydrates a component, true on every render after it.
 *
 * What it is for: React hydrates a page in pieces, a `<Suspense>` boundary at a time, and the shell's pieces come
 * first. They read `/me`, so by the time a later piece hydrates the answer can already be in the cache, and a component
 * that draws it on that first render draws something the server's HTML does not hold: React #418. `/settings` did
 * exactly that, since every section there branches on who is signed in — 4 loads in 6 with the CPU slowed 20 times,
 * none without, and once in a run on the CI runner. A component that renders the server's answer while it hydrates and
 * its own straight after never disagrees, whatever arrived in between.
 *
 * `useSyncExternalStore` is the hook React gives for this: the server snapshot is used for the hydrating render and
 * the client's replaces it at once, in the same commit pass, with no effect and no extra paint. A component mounted by
 * a later navigation is not hydrating, so it reads `true` from its first render and waits for nothing.
 */
const neverChanges = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(neverChanges, () => true, () => false);
}

/**
 * Every read asks for the platform's scope (reconciliation 76), respecting a path that already has its own query string
 * (`/activity?period=90d`) versus one that doesn't (`/home`), exactly as the console's server asks (`gatewayGet` in
 * `src/data/gateway.ts`). The gateway answers each caller what they may read: `resolveScope` honours the parameter for
 * a superadmin, whose console is the whole platform, and answers anybody else exactly what the parameterless request
 * would have, the team they act for. Two reads take none: `/me`, which is who the caller is, and the search, which the
 * platform runs as the team the caller acts for and refuses a platform scope.
 */
function withScope(path: string): string {
  if (path === '/me' || path === '/search' || path.startsWith('/search?')) return path;
  return path.includes('?') ? `${path}&scope=platform` : `${path}?scope=platform`;
}

/**
 * The data's clock for a component that holds no query of its own: the oldest arrival time among the queries that have
 * data. `Freshness`, `ShellTools`, `AlertsPanel` and
 * `formatRelative` all take `now` because the clock is the data's, not the browser's — this is where a component that
 * cannot ask its page for one gets it.
 *
 * `useSyncExternalStore` over the query cache, so the value is a number React can compare and a component re-renders
 * when a query settles rather than on every notification. The snapshot is `0` until the first answer — on the server as
 * well as in the browser — so the server render and the first client render agree, and `new Date(0)` is returned until
 * real data gives the page a clock. Nothing renders a relative time without data, so nothing shows the placeholder.
 *
 * The browser clock is read in an effect, never at render: this is a Client Component, and Next fails the build on
 * `Date.now()` evaluated during a prerender. Its own guidance is to defer it, which is what this does; the value is
 * only what a component rendered with no data at all measures against.
 */
export function useDataClock(): Date {
  const client = useQueryClient();
  const stamp = useSyncExternalStore(
    // Only what can move the clock: a query that settled, or one that left. The cache also announces a query the
    // moment `useQuery` builds one, which is during another component's render, and telling React to re-render this
    // one from inside that render is the "cannot update a component while rendering a different component" warning.
    // A query that was only just built has no data, so it never changes the answer below.
    (notify) => client.getQueryCache().subscribe((event) => { if (event.type === 'updated' || event.type === 'removed') notify(); }),
    () => {
      let oldest = 0;
      for (const q of client.getQueryCache().getAll()) {
        const at = q.state.dataUpdatedAt;
        if (at > 0 && (oldest === 0 || at < oldest)) oldest = at;
      }
      return oldest;
    },
    () => 0,
  );
  const [fallback, setFallback] = useState(0);
  // The browser's clock is an external store read once on mount, the same shape `usePreferences` uses for
  // localStorage: the server render never sees it, and reading it at render instead would fail the build, because Next
  // reports a dynamic value evaluated during the prerender.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!stamp) setFallback(Date.now()); }, [stamp]);
  return useMemo(() => new Date(stamp || fallback), [stamp, fallback]);
}

/**
 * One hook for every page.
 *
 * `retry: false` because the two failures that matter — 401 (not signed in) and 403 (signed in,
 * wrong door) — are answers, not outages.
 *
 * The URL is the path with the platform's scope (`withScope`), the same for every caller, so the key is the path: the
 * gateway decides what a scope holds from the CALLER, never from the parameter (`scope.ts`), and the response under the
 * key is the caller's own data, never another team's and never a scope they do not hold.
 *
 * The key does carry who the page is read by: the caller, the team they act for and their role, as the console's
 * server resolved them for the page (`ConsoleCaller`), after the path. A team switch replaces the document, so the
 * cache never outlives the team it was read for; the key is what holds when something does, a response for the old
 * team held back past the switch landing under the old team's key and never drawn for the new one. Outside
 * `ConsoleCaller` the three are null.
 *
 * `/me` is the exception to all of this: it answers "who is this", not "which team's data", so it
 * carries neither the parameter nor the caller, and the shell reads it above the layout that resolves the caller.
 */
export function useConsole<T>(path: string | null): UseQueryResult<T, ApiError> {
  const access = useContext(CallerContext);
  const hydrated = useHydrated();
  const scoped = path !== null && path !== '/me';
  const url = path === null ? null : withScope(path);
  const who = scoped && access ? callerOf(use(access)) : null;
  const query = useQuery<T, ApiError>({
    // COUPLED: the path stays second, where `ConsoleLive` reads it.
    queryKey: scoped ? ['console', path, who?.caller ?? null, who?.team ?? null, who?.role ?? null] : ['console', path],
    queryFn: () => consoleFetch<T>(url as string),
    enabled: path !== null,
    retry: false,
    staleTime: 30_000,
  });
  /* A resource hint, written into the page's HTML when it renders on the server: the browser
   * starts the read while it is still parsing, instead of after the script has downloaded and
   * hydrated, and the fetch above picks the response up. Still the browser's own request with its
   * own cookie; the page's server never holds it.
   *
   * DELIBERATE: only while this read has neither an answer nor a request in flight. A hint for a
   * read already answered or on its way fetches in full a payload the page is holding or waiting
   * for, and will not look at. The hint that matters is the first, which is what the server
   * rendered and what the browser starts while it parses. */
  if (url !== null && !query.dataUpdatedAt && !query.isFetching) {
    preload(`${BASE}${url}`, { as: 'fetch', crossOrigin: 'anonymous' });
  }
  // While this component hydrates it is told what the server was told: nothing has arrived (`useHydrated`). The read
  // itself is untouched, so whatever is in the cache is on screen one render later, with no second request.
  return hydrated || path === null ? query : asOnTheServer(query);
}

/** A read as the server rendered it: asked for, and not yet answered. */
function asOnTheServer<T>(query: UseQueryResult<T, ApiError>): UseQueryResult<T, ApiError> {
  return {
    ...query,
    data: undefined, error: null, dataUpdatedAt: 0, errorUpdatedAt: 0,
    status: 'pending', fetchStatus: 'fetching',
    isPending: true, isLoading: true, isFetching: true, isInitialLoading: true,
    isSuccess: false, isError: false, isLoadingError: false, isRefetchError: false,
    isFetched: false, isFetchedAfterMount: false, isRefetching: false, isPlaceholderData: false, isStale: true,
  } as UseQueryResult<T, ApiError>;
}

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';

// The one shape the transport itself needs: `useConsoleMode` reads the caller's role off
// `/me` to decide whether the platform view is even offered. Shapes never import back.
import type { Me } from './api-shapes';

/**
 * Every read the console does.
 *
 * FROM THE BROWSER, NEVER FROM THIS APP'S SERVER — and that is the whole design.
 * The session cookie belongs to the person sitting at the browser. If a Next
 * server component fetched the API instead, it would have to take that cookie
 * out of the incoming request and replay it upstream, which is precisely the
 * "a proxy forwards the caller's credentials" shape the platform forbids and
 * has a check for. Fetching from the client means this app never holds anybody's
 * credential at all: the browser has a cookie, it sends it to the origin that
 * issued it, and this app is a renderer.
 *
 * WHICH IS WHY THE PATH IS RELATIVE. `/api/console/...` resolves against
 * whatever host the page was served from, and Caddy routes that path on the
 * console host to the gateway. No base URL, no CORS, no preflight, and nothing
 * to misconfigure between environments — the page and its API are one origin by
 * construction. In local development there is no gateway behind that path and
 * every call fails honestly with a connection error, which is the correct
 * outcome: the console has no offline mode and pretending otherwise would mean
 * shipping fixtures that drift from the real shape.
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

export async function consoleFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // The cookie is HttpOnly and same-origin; this says "send it".
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    // The gateway names its refusals — "the console needs a browser sign-in —
    // x@y authenticated by pat" — and that sentence is the whole diagnosis.
    // Swallowing it for a generic "request failed" is how somebody spends an
    // afternoon on a problem the server already explained.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The superadmin's platform/team choice — see `ConsoleModeProvider`.
 *
 * Client state only, by design (AC-1): no cookie, no server round trip to set
 * it. The gateway decides scope for real on every request per FR-3, so this
 * value only ever changes which parameter `useConsole` attaches; it is never
 * itself an authorization check.
 */
export type ConsoleMode = 'platform' | 'team';

interface ConsoleModeState {
  mode: ConsoleMode;
  setMode: (mode: ConsoleMode) => void;
}

const ConsoleModeContext = createContext<ConsoleModeState | null>(null);

const MODE_STORAGE_KEY = 'zz-console-mode';

function readStoredMode(): ConsoleMode | null {
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    return v === 'platform' || v === 'team' ? v : null;
  } catch {
    // Some browsers throw on ANY localStorage access — private browsing,
    // storage disabled by policy — not just on a missing key. Losing the
    // remembered choice is fine; failing every page load because of it is not.
    return null;
  }
}

function writeStoredMode(mode: ConsoleMode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // See readStoredMode — persistence is a nicety, not a requirement.
  }
}

/**
 * Mounted once in `Providers`, above every page, so the platform/team choice
 * survives navigation without a cookie or a server round trip.
 *
 * The default depends on who is signed in — platform for a superadmin (the
 * console has always shown the fleet, and it is their job), team otherwise —
 * which this provider cannot know until `/me` resolves. It fetches `/me`
 * itself for exactly that, using the SAME query key `useConsole('/me')` uses
 * everywhere else (see the `scoped` guard below), so this is a shared cache
 * hit, not a second request. Once a choice is explicit — restored from
 * localStorage, or made by hand through `ModeSwitch` — it wins over the
 * me-derived default forever.
 */
export function ConsoleModeProvider({ children }: { children: ReactNode }) {
  const [explicitMode, setExplicitMode] = useState<ConsoleMode | null>(readStoredMode);
  // Not `useConsole('/me')`: that hook reads THIS context to build its query,
  // and this component is still in the middle of producing it — calling it
  // here would read the context from whatever is above this provider (nothing,
  // in practice), not the value this render is about to supply. A plain
  // `useQuery` keyed identically sidesteps the self-reference and still shares
  // the one cached `/me` result with every other caller.
  const me = useQuery<Me, ApiError>({
    queryKey: ['console', '/me'],
    queryFn: () => consoleFetch<Me>('/me'),
    retry: false,
    staleTime: 30_000,
  });

  // A STORED `platform` IS ONLY HONOURED FOR A SUPERADMIN. localStorage is per
  // browser, not per account: a superadmin who signs out of a shared machine
  // leaves `platform` behind, and the member who signs in next would get the
  // platform rail — every flow, block, run and activity link in their face.
  // The gateway would still refuse them the data (`resolveScope` only grants
  // `scope=platform` to `isSuper`), so this was never a disclosure; it was the
  // console lying to somebody about what is theirs, which is its own problem.
  // Discarding the stored value rather than rewriting it keeps the superadmin's
  // own choice intact for when they sign back in.
  const honoured = explicitMode === 'platform' && me.data && !me.data.superadmin
    ? null
    : explicitMode;

  // Nobody has chosen yet: fall back to platform for a superadmin (today's
  // behaviour, and it's their job) or team for everyone else, once `/me` says
  // which — and to platform while it's still loading, the same guess the app
  // always made before this switch existed. This is derived at render time,
  // not synced through an effect, so there is never a render where `mode`
  // disagrees with the `me` data that determines it.
  const mode: ConsoleMode = honoured
    ?? (me.data ? (me.data.superadmin ? 'platform' : 'team') : 'platform');

  function setMode(next: ConsoleMode) {
    setExplicitMode(next);
    writeStoredMode(next);
  }

  // `createElement`, not JSX: this module is `.ts`, not `.tsx`, and staying that
  // way matters — several other agents in this session hold `src/lib/api.ts`
  // as a stable path; renaming it risks a second file resolving ahead of this
  // one and silently reverting every change here.
  return createElement(ConsoleModeContext.Provider, { value: { mode, setMode } }, children);
}

const DEFAULT_MODE_STATE: ConsoleModeState = { mode: 'platform', setMode: () => {} };

/**
 * Reads the platform/team choice. Every real page is inside `ConsoleModeProvider`
 * via the root `Providers`, so the fallback below never runs in the app — it
 * exists so `ModeSwitch` (and anything else that reads this) can still render,
 * inertly, in a test or story that mounts it on its own.
 */
export function useConsoleMode(): ConsoleModeState {
  return useContext(ConsoleModeContext) ?? DEFAULT_MODE_STATE;
}

/**
 * Appends `scope=platform` for platform mode, respecting a path that already
 * has its own query string (`/activity?period=90d`) versus one that doesn't
 * (`/overview`). Team mode adds nothing — per FR-3 that is "no opinion", not
 * "team", and the caller's `activeTeam` on the server applies.
 */
function withScope(path: string, mode: ConsoleMode): string {
  if (mode !== 'platform') return path;
  return path.includes('?') ? `${path}&scope=platform` : `${path}?scope=platform`;
}

/**
 * One hook for every page.
 *
 * `retry: false` because the two failures that matter here — 401 (not signed
 * in) and 403 (signed in, wrong door) — are answers, not outages. Retrying them
 * three times delays the sign-in screen by a couple of seconds and tells the
 * person nothing.
 *
 * THE MODE IS PART OF THE QUERY KEY. Without it, switching from team to
 * platform mode would serve rows TanStack Query already cached for the other
 * scope — the page would look unchanged, or worse show one scope's data under
 * the other's label. `/me` is the one exception: it answers "who is this",
 * not "which team's data", so it carries neither the parameter nor the mode
 * segment — see `ConsoleModeProvider`, which depends on that to avoid
 * refetching `/me` (and re-opening `ConsoleGate`'s spinner) the moment its
 * own default computation changes the mode out from under it.
 */
/**
 * WHEN THE DATA ON THE PAGE ACTUALLY ARRIVED — for the freshness stamp.
 *
 * Every page passed `updatedAt={new Date()}`, evaluated at RENDER. The stamp therefore read
 * "Updated just now" over thirty-second-old cached data, over a background refetch, and over
 * the error state itself: a claim that could not be false, on a header whose whole reason for
 * existing is that "a dashboard that does not say how old its numbers are cannot be trusted".
 *
 * The OLDEST of the queries given, because a page is only as fresh as its stalest panel, and
 * `null` while nothing has loaded — which Freshness renders as "never" rather than as now.
 */
export function freshnessOf(...queries: { dataUpdatedAt?: number }[]): Date | null {
  const stamps = queries.map((q) => q.dataUpdatedAt ?? 0).filter((n) => n > 0);
  return stamps.length ? new Date(Math.min(...stamps)) : null;
}

export function useConsole<T>(path: string | null): UseQueryResult<T, ApiError> {
  const { mode } = useConsoleMode();
  const scoped = path !== null && path !== '/me';
  const url = scoped ? withScope(path as string, mode) : path;
  return useQuery<T, ApiError>({
    queryKey: scoped ? ['console', path, mode] : ['console', path],
    queryFn: () => consoleFetch<T>(url as string),
    enabled: path !== null,
    retry: false,
    staleTime: 30_000,
  });
}

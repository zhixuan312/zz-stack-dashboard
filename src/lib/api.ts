'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';

// The one shape the transport itself needs: `useConsoleMode` reads the caller's role off
// `/me` to decide whether the platform view is even offered. Shapes never import back.
import type { Me } from './api-shapes';

/**
 * Every read the console does.
 *
 * From the browser, never from this app's server. The session cookie belongs to the person at
 * the browser; a Next server component would have to take it out of the incoming request and
 * replay it upstream, which is the "a proxy forwards the caller's credentials" shape the
 * platform forbids and has a check for. Fetching from the client means this app never holds
 * anybody's credential: the browser has a cookie, it sends it to the origin that issued it,
 * and this app is a renderer.
 *
 * Which is why the path is relative. `/api/console/...` resolves against whatever host the page
 * was served from, and Caddy routes that path on the console host to the gateway — no base URL,
 * no CORS, no preflight. In local development there is no gateway behind that path and every
 * call fails with a connection error; the console has no offline mode.
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
    // The gateway names its refusals — "the console needs a browser sign-in — x@y
    // authenticated by pat" — and that sentence is the whole diagnosis. A generic "request
    // failed" throws it away.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The superadmin's platform/team choice — see `ConsoleModeProvider`.
 *
 * Client state only: no cookie, no server round trip to set it. The gateway decides scope on
 * every request, so this value only changes which parameter `useConsole` attaches and is never
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
    // Some browsers throw on any localStorage access — private browsing, storage disabled by
    // policy — not just on a missing key. Losing the remembered choice is fine; failing every
    // page load because of it is not.
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
 * Mounted once in `Providers`, above every page, so the platform/team choice survives
 * navigation without a cookie or a server round trip.
 *
 * The default depends on who is signed in — platform for a superadmin, team otherwise — which
 * this provider cannot know until `/me` resolves. It fetches `/me` itself under the same query
 * key `useConsole('/me')` uses, so this is a shared cache hit rather than a second request.
 * Once a choice is explicit — restored from localStorage, or made through `ModeSwitch` — it
 * wins over the me-derived default.
 */
export function ConsoleModeProvider({ children }: { children: ReactNode }) {
  const [explicitMode, setExplicitMode] = useState<ConsoleMode | null>(readStoredMode);
  // Not `useConsole('/me')`: that hook reads this context to build its query, and this
  // component is still producing it, so the hook would read whatever is above this provider
  // rather than the value this render is about to supply. A plain `useQuery` keyed identically
  // sidesteps the self-reference and still shares the one cached `/me` result.
  const me = useQuery<Me, ApiError>({
    queryKey: ['console', '/me'],
    queryFn: () => consoleFetch<Me>('/me'),
    retry: false,
    staleTime: 30_000,
  });

  // A stored `platform` is only honoured for a superadmin. localStorage is per browser, not
  // per account, so a superadmin signing out of a shared machine leaves `platform` behind and
  // the next member to sign in would get the platform rail. The gateway still refuses them the
  // data — `resolveScope` grants `scope=platform` only to `isSuper` — so this is about what
  // the console shows, not disclosure. Discarding the stored value rather than rewriting it
  // keeps the superadmin's own choice for when they sign back in.
  const honoured = explicitMode === 'platform' && me.data && !me.data.superadmin
    ? null
    : explicitMode;

  // Nobody has chosen yet: platform for a superadmin, team for everyone else once `/me` says
  // which, and platform while it is still loading. Derived at render time rather than synced
  // through an effect, so there is never a render where `mode` disagrees with the `me` data
  // that determines it.
  const mode: ConsoleMode = honoured
    ?? (me.data ? (me.data.superadmin ? 'platform' : 'team') : 'platform');

  function setMode(next: ConsoleMode) {
    setExplicitMode(next);
    writeStoredMode(next);
  }

  // `createElement`, not JSX: this module is `.ts`, not `.tsx`.
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
 * (`/overview`). Team mode adds nothing: that is "no opinion", not
 * "team", and the caller's `activeTeam` on the server applies.
 */
function withScope(path: string, mode: ConsoleMode): string {
  if (mode !== 'platform') return path;
  return path.includes('?') ? `${path}&scope=platform` : `${path}?scope=platform`;
}

/**
 * When the data on the page actually arrived, for the freshness stamp.
 *
 * `new Date()` evaluated at render reads "Updated just now" over cached data, over a background
 * refetch and over the error state itself.
 *
 * The oldest of the queries given, because a page is only as fresh as its stalest panel, and
 * `null` while nothing has loaded — which Freshness renders as "never" rather than as now.
 */
export function freshnessOf(...queries: { dataUpdatedAt?: number }[]): Date | null {
  const stamps = queries.map((q) => q.dataUpdatedAt ?? 0).filter((n) => n > 0);
  return stamps.length ? new Date(Math.min(...stamps)) : null;
}

/**
 * One hook for every page.
 *
 * `retry: false` because the two failures that matter — 401 (not signed in) and 403 (signed in,
 * wrong door) — are answers, not outages.
 *
 * COUPLED: the mode is part of the query key. Without it, switching from team to platform mode
 * would serve rows TanStack Query cached for the other scope. `/me` is the one exception: it
 * answers "who is this", not "which team's data", so it carries neither the parameter nor the
 * mode segment — `ConsoleModeProvider` depends on that to avoid refetching `/me` when its own
 * default computation changes the mode.
 */
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

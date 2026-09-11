'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';

/**
 * Every write the console makes.
 *
 * The POST sibling of `consoleFetch` in `api.ts` — read that file's header for
 * why this goes straight from the browser rather than through this app's own
 * server: the session cookie belongs to whoever is looking at the screen, and
 * a write is the same story as a read, just with a body. `ApiError` is
 * imported rather than redeclared so a `catch` block anywhere in the app can
 * do `err instanceof ApiError` without caring whether the call that threw it
 * was a fetch or a mutation.
 *
 * METHOD IS A PARAMETER, DEFAULTING TO POST. Every write until Task I-13 was a
 * POST with a JSON body; the settings console adds DELETE (revoke a token,
 * delete a credential, disconnect a block) and those routes take no body at
 * all — `body` is optional here for exactly that, and its content-type header
 * is only sent when there is one to describe.
 */
const BASE = '/api/console';

export async function consoleMutate<T>(
  path: string, body?: unknown, method: 'POST' | 'DELETE' | 'PUT' = 'POST',
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    // Same reasoning as consoleFetch: the cookie is HttpOnly and same-origin,
    // and this says "send it".
    credentials: 'same-origin',
    headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // The gateway names its refusals in a full sentence — see consoleFetch's
    // header. Replacing it with a generic "request failed" here would throw
    // away the only diagnosis a failed write actually has.
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, errBody?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * One hook for every console write.
 *
 * Invalidates every cached read under the `console` key on success, rather
 * than threading each caller's own query key through here. A write on this
 * console is rare — a person approves a handful of documents a day, not per
 * keystroke — so refetching everything currently on screen costs nothing,
 * and it is a lot harder to get wrong than asking every future caller to
 * reproduce `useConsole`'s own key-building rules (see api.ts) just to
 * invalidate the one query it changed.
 *
 * `request` is a fixed path (the original shape — every call becomes a POST
 * whose body is the mutation's own variable, e.g. `ApproveAction`) OR a
 * function of the mutation's variable that returns `{ path, body?, method? }`.
 * The settings console needs the second form: revoking a token or
 * disconnecting a block names its target IN THE PATH
 * (`/settings/me/tokens/:id`), not in a body — and the route takes DELETE,
 * not POST — so a single fixed path string could not describe either write.
 */
export function useConsoleMutation<TResult, TVars = unknown>(
  request: string | ((vars: TVars) => { path: string; body?: unknown; method?: 'POST' | 'DELETE' | 'PUT' }),
): UseMutationResult<TResult, ApiError, TVars> {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: (vars: TVars) => {
      const { path, body, method } =
        typeof request === 'string' ? { path: request, body: vars, method: 'POST' as const } : request(vars);
      return consoleMutate<TResult>(path, body, method);
    },
    // RETURNED, not fired-and-forgotten: `useMutation` awaits a promise
    // returned from `onSuccess`, so `isPending` stays true until the
    // invalidated queries have actually refetched. Without the `return`, a
    // caller reading `isPending` to disable its own button sees it go false
    // the instant the request resolves — a window, for as long as the refetch
    // takes, where the UI looks idle and a second click can fire the same
    // write again before the first one's result has even landed on screen.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['console'] }),
  });
}

'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';

/**
 * Every write the console makes.
 *
 * The POST sibling of `consoleFetch` in `api.ts`: it goes straight from the
 * browser, because the session cookie belongs to whoever is looking at the
 * screen. `ApiError` is imported rather than redeclared so a `catch` anywhere
 * can do `err instanceof ApiError` whether the call that threw was a fetch or
 * a mutation.
 *
 * Method is a parameter, defaulting to POST. The settings console's DELETE
 * routes (revoke a token, remove a member, deactivate a person) take no
 * body, so `body` is optional and its content-type header is sent only when
 * there is one to describe.
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
    // header. Replacing it with a generic "request failed" throws away the only
    // diagnosis a failed write has.
    const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, errBody?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * One hook for every console write.
 *
 * Invalidates every cached read under the `console` key on success rather than
 * threading each caller's query key through here. A write on this console is
 * rare, so refetching everything on screen costs nothing and cannot get
 * `useConsole`'s key-building rules wrong.
 *
 * `request` is a fixed path — every call becomes a POST whose body is the
 * mutation's own variable — or a function of that variable returning
 * `{ path, body?, method? }`. Revoking a token names
 * its target in the path (`/settings/me/tokens/:id`) and takes DELETE, which a
 * fixed path string cannot describe.
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
    // Returned, not fired and forgotten: `useMutation` awaits a promise
    // returned from `onSuccess`, so `isPending` stays true until the
    // invalidated queries have refetched. Without the `return`, a caller
    // disabling its button on `isPending` opens a window where the UI looks
    // idle and a second click fires the same write again.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['console'] }),
  });
}

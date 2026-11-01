'use client';

import { useRef } from 'react';
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
 * Method is a parameter, defaulting to POST. Some DELETE routes take no body
 * (Access's revoke a token, an application or a browser) and some take one
 * (remove a member, on Access and on a team's page under Platform, deactivate
 * a person, archive a team, each naming what it confirms), so `body` is
 * optional and its content-type header is sent only when there is one to
 * describe. A 204 resolves with `undefined`.
 */
const BASE = '/api/console';

/** What a write the gateway accepted answers, where the route has nothing more to say. */
export type Done = { ok: true; result: string };

/** What a refused write says: the gateway's own sentence, or `fallback` when the write never reached it. */
export const reasonOf = (err: unknown, fallback: string): string => (err instanceof ApiError ? err.message : fallback);

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
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type Write = { path: string; body?: unknown; method?: 'POST' | 'DELETE' | 'PUT' };

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
 *
 * The same write is sent once while it is out: a call naming the same path,
 * method and body as one not yet answered sends nothing, and its promise never
 * settles, so the caller's toast or refusal follows the first answer only. Told by a ref set
 * from the press, because a keyboard press carries no click count and a second
 * Enter reaches the control before `isPending` is drawn as busy. A different
 * write from the same hook (another row, another role) is its own and goes.
 */
export function useConsoleMutation<TResult, TVars = unknown>(
  request: string | ((vars: TVars) => Write),
): UseMutationResult<TResult, ApiError, TVars> {
  const queryClient = useQueryClient();
  const out = useRef(new Set<string>());
  const of = (vars: TVars): Write => (typeof request === 'string' ? { path: request, body: vars, method: 'POST' } : request(vars));
  const mutation = useMutation<TResult, ApiError, TVars>({
    mutationFn: (vars: TVars) => {
      const { path, body, method } = of(vars);
      return consoleMutate<TResult>(path, body, method);
    },
    // Returned, not fired and forgotten: `useMutation` awaits a promise
    // returned from `onSuccess`, so `isPending` stays true until the
    // invalidated queries have refetched. Without the `return`, a caller
    // disabling its button on `isPending` opens a window where the UI looks
    // idle and a second click fires the same write again.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['console'] }),
  });
  const send = mutation.mutateAsync;
  const mutateAsync: typeof send = async (vars, options) => {
    const { path, body, method = 'POST' } = of(vars);
    const key = JSON.stringify([method, path, body]);
    if (out.current.has(key)) return new Promise<never>(() => {});
    out.current.add(key);
    try {
      return await send(vars, options);
    } finally {
      out.current.delete(key);
    }
  };
  const mutate: typeof mutation.mutate = (vars, options) => { mutateAsync(vars, options).catch(() => {}); };
  return { ...mutation, mutate, mutateAsync };
}

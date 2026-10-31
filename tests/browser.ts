/**
 * The browser's side of a page under test: its reads answered by a stub, and a live hint handed on as the console's
 * live provider hands one on.
 *
 * One module because each of these is a contract of the console's, not a test's: the reads every page makes through
 * `src/lib/api.ts` (`/api/console/<path>`, the caller's `/me` first), and what `ConsoleLive` does with a hint. A copy per
 * suite is one place to change when either changes, and the copies that were forgotten keep passing against the old
 * one.
 */
import { act } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import { collectionOf } from '@/lib/collection-of';

/** A stubbed read's answer: its status and its body. */
export type Reply = [status: number, body: unknown];

/**
 * The browser's reads and writes, answered by `reply` with the path past `/api/console` and its query, or never when
 * `reply` is null; the caller's own `/me` is answered `me`.
 */
export function browserStub(reply: ((path: string, init?: RequestInit) => Reply) | null, me: unknown) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (!reply) return new Promise(() => {});
    const url = new URL(String(input), 'http://console.test');
    const [status, body] = url.pathname.endsWith('/me') ? [200, me] : reply(url.pathname.replace('/api/console', '') + url.search, init);
    return Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);
  }));
}

/** Every request the stub was sent past the caller's `/me`, with what it was sent with. */
export const browserCalls = () => (fetch as unknown as { mock: { calls: [RequestInfo | URL, RequestInit | undefined][] } }).mock.calls
  .filter(([u]) => !String(u).endsWith('/me'));

/** What the browser has read, past who it is: each address as it was asked. */
export const browserReads = () => browserCalls().filter(([, init]) => (init?.method ?? 'GET') === 'GET').map(([u]) => String(u));

/**
 * A hint that `collection` changed, as `ConsoleLive` (src/views/console-live.tsx) hands it on: every console read whose
 * collection `collectionOf` names it is invalidated, and what is on screen is read again.
 */
export const liveHint = (client: QueryClient, collection: string) => act(async () => {
  await client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'console' && collectionOf(String(q.queryKey[1] ?? '')) === collection });
});

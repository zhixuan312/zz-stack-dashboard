'use client';

import { useMemo, useSyncExternalStore } from 'react';

/**
 * The address, as the source of truth for a view's state.
 *
 * DELIBERATE: `window.location`, not `next/navigation`'s `useSearchParams`. In this Next version,
 * calling `useSearchParams` in a prerendered route client-renders every Client Component up to the
 * nearest Suspense boundary — and a page that has none stops being prerendered at all. That is not
 * a detail: `/teams`, `/people`, `/initiatives`, `/runs`, `/knowledge` and the skill's `?view=` tabs
 * shipped an empty shell and painted their own masthead only once hydration finished, which measured
 * 2212ms on `/teams` on the phone profile `scripts/vitals.ts` uses. The pages that read no search
 * params — `/`, `/settings`, an initiative — ship their lead in the HTML and paint it at 620ms. Same
 * app, same machine, same profile; the hook was the whole difference.
 *
 * `useSyncExternalStore` with a server snapshot is what makes reading the address safe: the server
 * and the first client render both see the default view, and the real address applies immediately
 * afterwards, so a shared link corrects itself a frame later instead of refusing to hydrate (#418).
 *
 * The address rather than Next's copy of it is also the other half of that: Next's search params are
 * what it last NAVIGATED to, so anything written by another writer — the reporting period, with
 * `history.replaceState` — is invisible to them.
 */
const listeners = new Set<() => void>();

/** The query string, or empty where there is no `window` to ask. */
export function addressSearch(): string {
  try {
    return window.location.search;
  } catch {
    return '';
  }
}

/* Back and forward move the address without going through the router, and nothing else here would
 * hear them: a reader kept its old view until some unrelated render happened to re-read the address.
 * One listener for the module, added on the first subscriber and kept — the store is small, and
 * tracking who is left to remove it costs more than it saves. */
let lastSeen = '';
if (typeof window !== 'undefined') {
  lastSeen = addressSearch();
  window.addEventListener('popstate', () => {
    const now = addressSearch();
    if (now === lastSeen) return;
    lastSeen = now;
    announceAddress();
  });
}

export function subscribeAddress(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

/** Tell every reader the address has moved. Owed after a write that navigates nowhere — clearing a key
 *  that was already absent — because nothing else would re-render them. The `popstate` bookkeeping moves here
 *  with it, so a write through the router and one through `history.replaceState` leave the same `lastSeen`
 *  behind and a later back-press is compared against the address as it really was. */
export function announceAddress(): void {
  lastSeen = addressSearch();
  for (const notify of listeners) notify();
}

/** One parameter of the address, or null. Null is also the server's answer: the view with no parameters is the
 *  default view, and that is what both the server render and the first client render are entitled to see. */
export function useAddressParam(name: string): string | null {
  const search = useSyncExternalStore(subscribeAddress, addressSearch, () => '');
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

'use client';

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

import { addressSearch, announceAddress } from '@/lib/address';
import { DEFAULT_PERIOD, parsePeriod, type Period } from '@/lib/period';

/**
 * The reporting period, held in context — the same shape `ConsoleModeProvider` uses for the
 * platform/team choice.
 *
 * DELIBERATE: context, not the URL. The claim this used to make — that on a prerendered route a
 * `router.push` of `?period=30d` "is not seen by `useSearchParams()`" — is NOT what happens now,
 * and it read as a warning that the four pages' filters could not work either, since they are
 * written with `router.replace` and read exactly that way. Measured in a browser on `/initiatives`:
 * pressing a filter took the table from 8 rows to 2 and the address from `/initiatives` to
 * `/initiatives?show=waiting`.
 *
 * It stays out of the URL all the same, for two reasons that are now the ones that hold:
 *
 *   `useSearchParams` would cost the prerender. This provider wraps the whole shell, and reading
 *   search params in a prerendered route client-renders every Client Component up to the nearest
 *   Suspense boundary — the shell, its rail, every page frame. The period is not worth that.
 *
 *   The reporting window is the chrome's, not a page's. `useQueryState`'s "Clear filters" clears
 *   the filters of the page it sits on; this spans every page and is chosen once in the top bar, so
 *   clearing one page's table filters must not reset it. `history.replaceState` is what keeps the
 *   two apart, and `useQueryState` rebuilds from the address rather than from Next's copy of it
 *   precisely so a filter change cannot drop `?period=` on its way past.
 *
 * The URL is still written, with `history.replaceState`, so a windowed view stays linkable and
 * survives a refresh — but nothing re-renders off it. `replaceState`, not `pushState`: five
 * back-presses to undo five glances at a dropdown is not what the back button is for.
 */
interface PeriodState {
  period: Period;
  setPeriod: (p: Period) => void;
}

const PeriodContext = createContext<PeriodState | null>(null);

/**
 * The period named in the address bar, or null.
 *
 * The address through `lib/address.ts`, which is the one place that says why it is `window` rather
 * than `useSearchParams`; that reader is safe to run during render in both environments, on the
 * server included, which is what the server snapshot below relies on.
 */
function readUrlPeriod(): Period | null {
  const raw = new URLSearchParams(addressSearch()).get('period');
  return raw ? parsePeriod(raw) : null;
}

/**
 * The chosen period, as an external store. The address wins whenever it names one (a shared link, a refresh); a
 * page reached inside the console without the parameter keeps the period last chosen; a choice is mirrored back into
 * the address. DELIBERATE: not a `useState` initializer. The
 * server cannot read the browser's address, so an initializer that does renders the shared link's period over a
 * server render of the default, and React refuses the hydration (#418).
 */
let chosen: Period | null = null;
const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
};
const snapshot = () => readUrlPeriod() ?? chosen ?? DEFAULT_PERIOD;

export function PeriodProvider({ children }: { children: ReactNode }) {
  const period = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PERIOD);

  const setPeriod = useCallback((next: Period) => {
    chosen = next;
    for (const l of listeners) l();
    try {
      const url = new URL(window.location.href);
      // The default period is the absence of the parameter, so `?period=all` and a bare `/`
      // are not two URLs for one view.
      if (next === DEFAULT_PERIOD) url.searchParams.delete('period');
      else url.searchParams.set('period', next);
      window.history.replaceState(null, '', url);
      // Every other reader of the address hears about it: this write does not go through the router,
      // so nothing else would tell them their view has moved under them.
      announceAddress();
    } catch {
      // A URL the browser will not let us rewrite does not fail the change: the state above
      // has already moved.
    }
  }, []);

  return (
    <PeriodContext.Provider value={{ period, setPeriod }}>{children}</PeriodContext.Provider>
  );
}

/**
 * Reads the period. Outside a provider it reports the default and ignores writes, so a control
 * that only consumes this can be rendered standalone — the same inert fallback
 * `useConsoleMode` offers.
 */
export function usePeriod(): PeriodState {
  return useContext(PeriodContext) ?? { period: DEFAULT_PERIOD, setPeriod: () => {} };
}

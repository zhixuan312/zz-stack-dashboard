'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_PERIOD, parsePeriod, type Period } from '@/lib/period';

/**
 * The reporting period, held in context — the same shape `ConsoleModeProvider` uses for
 * the platform/team choice, and for the same reason.
 *
 * IT USED TO BE THE URL, and the URL did not work. `PeriodSelect` pushed `?period=30d`
 * through `router.push` and read it back with `useSearchParams()`, and on this app's
 * statically prerendered routes the read never saw the write: the address changed and the
 * hook did not, so the control sat on "Last 24 hours" for ever while every option
 * underneath it did nothing. Not the picker's fault and not the page's — the two ends of
 * one round trip through the router, and the round trip was open.
 *
 * The comment defending URL-as-state said it made the view "readable by a server component
 * without any client round-trip". There are no server components here. Every page in this
 * console is `'use client'` and fetches from the browser, on purpose (see api.ts), so that
 * argument buys nothing and cost the feature.
 *
 * THE URL IS STILL WRITTEN, with `history.replaceState` — so a windowed view is still
 * linkable and still survives a refresh — but nothing re-renders off it. The address bar
 * reports the state; it no longer transports it. `replaceState`, not `pushState`: five
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
 * Reads `window` inside a try/catch and returns null on any failure, exactly as
 * `readStoredMode` does in api.ts — on the server `window` is undefined and throws, which
 * makes this a lazy initialiser that is safe to run during render in both environments.
 */
function readUrlPeriod(): Period | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('period');
    return raw ? parsePeriod(raw) : null;
  } catch {
    return null;
  }
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setState] = useState<Period>(() => readUrlPeriod() ?? DEFAULT_PERIOD);

  const setPeriod = useCallback((next: Period) => {
    setState(next);
    try {
      const url = new URL(window.location.href);
      // All time is the default, so it is the ABSENCE of the parameter rather than a
      // spelling of it — `?period=all` and a bare `/` must not be two URLs for one view.
      if (next === DEFAULT_PERIOD) url.searchParams.delete('period');
      else url.searchParams.set('period', next);
      window.history.replaceState(null, '', url);
    } catch {
      // A URL the browser will not let us rewrite is not a reason to refuse the change the
      // person just asked for. The state above already moved; the address bar is the part
      // that can fail harmlessly.
    }
  }, []);

  return (
    <PeriodContext.Provider value={{ period, setPeriod }}>{children}</PeriodContext.Provider>
  );
}

/**
 * Reads the period. Outside a provider it reports the default and ignores writes, so a
 * control that only consumes this can still be rendered standalone in a test — the same
 * inert fallback `useConsoleMode` offers.
 */
export function usePeriod(): PeriodState {
  return useContext(PeriodContext) ?? { period: DEFAULT_PERIOD, setPeriod: () => {} };
}

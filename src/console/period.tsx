'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { DEFAULT_PERIOD, parsePeriod, type Period } from '@/lib/period';

/**
 * The reporting period, held in context — the same shape `ConsoleModeProvider` uses for the
 * platform/team choice.
 *
 * DELIBERATE: context, not the URL. On this app's statically prerendered routes a
 * `router.push` of `?period=30d` is not seen by `useSearchParams()`, so the control sits on
 * its old value while every option does nothing.
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
 * Reads `window` inside a try/catch and returns null on any failure, as `readStoredMode` does
 * in api.ts: on the server `window` is undefined and throws, so this is safe to run during
 * render in both environments.
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
      // The default period is the absence of the parameter, so `?period=all` and a bare `/`
      // are not two URLs for one view.
      if (next === DEFAULT_PERIOD) url.searchParams.delete('period');
      else url.searchParams.set('period', next);
      window.history.replaceState(null, '', url);
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

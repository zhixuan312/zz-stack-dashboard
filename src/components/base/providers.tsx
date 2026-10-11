'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import { app } from '../../app.config';
import { STORAGE_KEY, type Preferences } from '../../lib/preferences';
import { Toaster } from '../ui/toast/index';

const cfg: { name: string; theme?: 'dark' | 'light' } = app;
const DEFAULTS: Preferences = { theme: cfg.theme ?? 'system', accent: app.accent, density: 'comfortable', assistant: true };
const Ctx = createContext<{ prefs: Preferences; set: (p: Partial<Preferences>) => void }>({ prefs: DEFAULTS, set: () => {} });

/** The person's appearance choices. Read with usePreferences(); the pre-paint script applies them before hydration. */
export function usePreferences() {
  return useContext(Ctx);
}

function apply(p: Preferences) {
  const d = document.documentElement;
  if (p.theme === 'system') d.removeAttribute('data-theme');
  else d.setAttribute('data-theme', p.theme);
  d.setAttribute('data-accent', p.accent);
  d.setAttribute('data-density', p.density);
}

export function Providers({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    const read = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        // The stored choice is an external store: read on mount, and again when another tab writes. The server render
        // never sees localStorage, so there is no render-time value to derive it from.
        setPrefs((p) => {
          const next = { ...p, ...stored };
          apply(next);
          return next;
        });
      } catch {
        /* storage unavailable: the defaults stand */
      }
    };
    read();
    // Another tab's choice. `storage` fires only in the tabs that did NOT write, which is exactly the ones that need
    // it: without this, two tabs of the same dashboard disagree about the theme until one of them reloads.
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  const set = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the choice lasts for this visit */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, set }), [prefs, set]);
  return (
    <Ctx.Provider value={value}>
      <Tooltip.Provider delayDuration={300} skipDelayDuration={120}>
        {children}
        <Toaster />
      </Tooltip.Provider>
    </Ctx.Provider>
  );
}

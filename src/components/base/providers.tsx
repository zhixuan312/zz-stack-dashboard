'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import { app } from '@/app.config';
import { STORAGE_KEY, type Preferences } from '@/lib/preferences';
import { Toaster } from '@/components/ui/toast';

const DEFAULTS: Preferences = { theme: 'system', accent: app.accent, density: 'comfortable' };
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
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored choice is an external store read once on mount; there is no render-time value to derive it from, because the server render never sees localStorage.
      setPrefs((p) => ({ ...p, ...stored }));
    } catch {
      /* storage unavailable: the defaults stand */
    }
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

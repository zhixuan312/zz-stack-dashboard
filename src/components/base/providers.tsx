'use client';

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import { app } from '../../app.config';
import { ACCENTS, STORAGE_KEY, type Preferences } from '../../lib/preferences';
import { Toaster } from '../ui/toast/index';

const cfg: { name: string; theme?: 'dark' | 'light' } = app;
const DEFAULTS: Preferences = { theme: cfg.theme ?? 'system', accent: app.accent, density: 'comfortable', assistant: true };
const Ctx = createContext<{ prefs: Preferences; set: (p: Partial<Preferences>) => void }>({ prefs: DEFAULTS, set: () => {} });

/** The person's appearance choices. Read with usePreferences(); the pre-paint script applies them before hydration. */
export function usePreferences() {
  return useContext(Ctx);
}

/** The stored choices this version knows, over the defaults: a value it does not know (an older or hand-edited one) is not applied. */
function known(stored: Record<string, unknown>): Preferences {
  const { theme, accent, density, assistant } = stored;
  return {
    theme: theme === 'dark' || theme === 'light' || theme === 'system' ? theme : DEFAULTS.theme,
    accent: typeof accent === 'string' && ACCENTS.includes(accent) ? accent : DEFAULTS.accent,
    density: density === 'compact' || density === 'comfortable' ? density : DEFAULTS.density,
    assistant: typeof assistant === 'boolean' ? assistant : DEFAULTS.assistant,
  };
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
        //
        // As a transition, because it is an update above every part of the page whose code has not arrived yet (a
        // `dynamic()` card, a lazy panel). Made urgently, React answers it by discarding the server's HTML for such a
        // part and drawing its fallback until the code loads: a page that arrived whole empties and fills again. A
        // transition waits for the part to hydrate first. The pre-paint script has already put the choice on the root.
        startTransition(() => setPrefs(() => {
          // The whole stored choice over the defaults, so another tab clearing it puts this one back on them too.
          const next = known(stored && typeof stored === 'object' ? stored : {});
          apply(next);
          return next;
        }));
      } catch {
        /* storage unavailable: the defaults stand */
      }
    };
    read();
    // Another tab's choice. `storage` fires only in the tabs that did NOT write, which is exactly the ones that need
    // it: without this, two tabs of the same dashboard disagree about the theme until one of them reloads.
    // Only this key, or the whole storage cleared (`key` null): the assistant's thread is written to it on every message.
    const changed = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null) read(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
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

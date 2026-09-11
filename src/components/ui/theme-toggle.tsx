'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

const MODES = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

type Mode = (typeof MODES)[number]['value'];

const THEME_STORAGE_KEY = 'theme';

/**
 * Light / System / Dark.
 *
 * THREE options, not a two-way switch. A binary toggle forces a choice the user
 * may not want to make and then ignores their OS preference forever; `system`
 * is the honest default and the one most people leave it on.
 *
 * The mechanism is one attribute: `data-theme` on `<html>`. `globals.css`
 * defines the palette three times over — bare `:root` for light, a
 * `prefers-color-scheme` block for system, and `[data-theme='dark']` for the
 * explicit choice — so switching re-resolves every token at once with no React
 * re-render and no flash of the wrong colours mid-navigation.
 *
 * Pair it with the inline script in `app/layout.tsx`, which applies the stored
 * choice BEFORE first paint. Without that script the page paints light, then
 * corrects itself once this component hydrates, and the flash is the most
 * conspicuous bug a dark theme can have.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('system');

  // Read the stored choice after mount. It cannot be read during render — the
  // server has no localStorage, so using it as initial state would mean the
  // markup disagrees with the client on first paint.
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing React state FROM an external store (localStorage) on mount is the case effects exist for; there is no render-time value to derive it from.
    if (stored === 'light' || stored === 'dark') setMode(stored);
  }, []);

  function apply(next: Mode) {
    setMode(next);
    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      root.setAttribute('data-theme', next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--r)] border border-line bg-surface-2 p-0.5',
        className,
      )}
    >
      {MODES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
          className={cn(
            'focus-ring inline-flex size-7 items-center justify-center rounded-[var(--r-sm)]',
            'transition-colors duration-150 ease-[var(--ease-out)]',
            mode === value
              ? 'bg-surface text-ink shadow-[var(--shadow-lg)]'
              : 'text-ink-faint hover:text-ink',
          )}
        >
          <Icon className="size-[15px]" aria-hidden />
        </button>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The rail, below `lg`.
 *
 * A fixed 232px rail on a 390px screen leaves 158px of content — the dashboard
 * is not "cramped" at that width, it is unusable, and the layout audit does not
 * catch it because it only drives viewports from 1280px up. So the rail is
 * `hidden lg:flex` in `AppShell` and this renders the same nav as an overlay
 * drawer underneath that breakpoint.
 *
 * The SAME sidebar node is rendered in both places — no second navigation to
 * keep in sync. The drawer is the rail, moved.
 *
 * Behaviour that a hand-rolled drawer usually misses, and why each matters:
 *   - closes on route change, or you tap a link and the drawer stays over the
 *     page you just navigated to
 *   - closes on Escape and on backdrop press
 *   - `aria-expanded` + `aria-controls` on the trigger, `role="dialog"` +
 *     `aria-modal` on the panel
 *   - returns focus to the trigger on close, so keyboard focus does not fall
 *     back to the top of the document
 *   - locks body scroll while open
 */
export function SidebarDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating closes it. Keyed on pathname rather than on the link's onClick so
  // it holds for every way a route can change — a link, a redirect, the back
  // button.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closing on navigation is exactly "synchronise React state with an external system": the route is the external system, and there is no render-time value to derive from because the drawer must also survive re-renders that do NOT change the route.
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the panel so the next Tab lands on a nav link rather than
    // continuing through the page behind the overlay.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="sidebar-drawer"
        className={cn(
          'focus-ring inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--r-sm)]',
          'border border-line bg-surface text-ink-soft transition-colors duration-150',
          'hover:text-ink lg:hidden',
        )}
      >
        <Menu className="size-[18px]" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* The scrim is a DIV, not a button. As a button it was a second
              control with the identical accessible name "Close navigation", so
              a screen-reader user met the same command twice and could not tell
              the two apart. Pointer users get tap-to-dismiss; keyboard users get
              Escape and the visible ✕, which is the one announced control. */}
          <div
            aria-hidden
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="absolute inset-0 bg-ink/25"
          />
          <div
            id="sidebar-drawer"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="ds-rise-in absolute inset-y-0 left-0 flex w-[var(--rail-w)] max-w-[85vw] flex-col overflow-y-auto outline-none"
          >
            {children}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close navigation"
              className="focus-ring absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-[var(--r-sm)] text-ink-faint hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

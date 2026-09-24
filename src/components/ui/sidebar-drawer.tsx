'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The rail, below `lg`.
 *
 * A fixed 232px rail on a 390px screen leaves 158px of content. The rail is `hidden lg:flex` in
 * `AppShell` and this renders the same nav as an overlay drawer underneath that breakpoint.
 * COUPLED: the same sidebar node is rendered in both places — there is no second navigation.
 *
 * Behaviour this drawer carries:
 *   - closes on route change, so a tapped link does not leave it over the new page
 *   - closes on Escape and on backdrop press
 *   - `aria-expanded` + `aria-controls` on the trigger, `role="dialog"` + `aria-modal` on the
 *     panel
 *   - returns focus to the trigger on close
 *   - locks body scroll while open
 */
export function SidebarDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating closes it. Keyed on pathname rather than on the link's onClick so it holds for
  // every way a route can change — a link, a redirect, the back button.
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
          {/* DELIBERATE: the scrim is a div, not a button. A button here carries the same
              accessible name as the visible ✕, so a screen-reader user meets one command
              twice. Pointer users get tap-to-dismiss; keyboard users get Escape and the ✕. */}
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

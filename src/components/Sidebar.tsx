'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Eyebrow } from '@/components/ui';
import { AppMark } from '@/components/AppMark';
import { navSections, type NavItem } from '@/nav';
import { useConsole, useConsoleMode, type Me } from '@/lib/api';

/**
 * The primary rail. Route knowledge lives in `@/nav`, not here — this component
 * only renders the sections that mode asks for and marks the active one.
 *
 * THE MODE, NOT `me.superadmin`, decides which items appear. A member defaults
 * to team mode and a superadmin to platform (see `ConsoleModeProvider`), so
 * keying on mode narrows the rail for a real member AND makes the superadmin's
 * Team view a faithful preview of what that member sees — which is the only
 * thing the switch was ever for. Keying on the role instead would have left the
 * preview showing the fleet's own rail.
 *
 * NOTHING IS DRAWN UNTIL `/me` HAS ANSWERED. A member never touches
 * `ModeSwitch`, so nothing ever writes their choice to localStorage and
 * `ConsoleModeProvider` falls back to `platform` for the whole time `/me` is in
 * flight — which meant the rail painted Flows, Blocks, Runs and Activity on
 * every cold page load and then collapsed by four links a moment later. Holding
 * the links back for one round trip costs a member nothing (they were about to
 * lose them anyway) and spares everyone the flicker; the rail keeps its width
 * and its wordmark throughout, so nothing moves but the links themselves. The
 * `/me` read is the same unscoped query key `SidebarFooter` and
 * `ConsoleModeProvider` already share — a cache hit, not a third request.
 *
 * `footer` is the rail's own status block. Without something down there the
 * lower two thirds of the rail is empty pale surface, which reads as a panel
 * that stops short rather than a full-height rail. Use `SidebarStat` for the
 * usual two-column label/value lines.
 */
export function Sidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();
  const { mode } = useConsoleMode();
  const me = useConsole<Me>('/me');
  // `isFetched`, not `data`: an anonymous visitor's 401 is an ANSWER — they get
  // the platform rail, exactly as they did before, because the layout wants
  // them to see what this product is before they sign in.
  const sections = me.isFetched ? navSections(mode) : [];

  function renderLink(item: NavItem) {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-[var(--r)] px-2.5 py-2 text-sm',
          'transition-colors duration-150 ease-[var(--ease-out)]',
          active
            ? 'bg-accent-tint font-semibold text-accent-deep [&_svg]:text-accent'
            : 'text-ink-soft hover:bg-bg-sunk hover:text-ink [&_svg]:text-ink-faint',
        )}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
          />
        ) : null}
        <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">{item.label}</span>
        {active ? <Sparkle /> : null}
      </Link>
    );
  }

  return (
    <aside
      data-testid="sidebar"
      className="flex min-h-full w-[var(--rail-w)] flex-col border-r border-line bg-surface-2 px-3 py-4"
    >
      <div className="flex items-center gap-2 px-2 pb-4 pt-1">
        <AppMark withWordmark />
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-5">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            {section.label ? (
              <Eyebrow className="px-2.5 pb-1 !text-[0.6875rem] text-ink-faint">
                {section.label}
              </Eyebrow>
            ) : null}
            {section.items.map(renderLink)}
          </div>
        ))}
      </nav>

      {footer ? (
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">{footer}</div>
      ) : null}
    </aside>
  );
}

/**
 * The kit's four-point sparkle, marking the page you are on.
 *
 * INLINE, NEVER AN IMAGE FILE. It is on every page, and it has to be there before any
 * asset loads — it is what carries the brand in the first paint, when the mascot has not
 * arrived and may never arrive on a slow connection. It is also decorative, so it is
 * `aria-hidden`: `aria-current="page"` on the link is what actually announces the active
 * item, and a second signal would just be noise to a screen reader.
 */
function Sparkle() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="ml-auto size-3 shrink-0 text-accent"
    >
      <path d="M6 0.6 7.1 4.2 10.7 5.3 7.1 6.4 6 10 4.9 6.4 1.3 5.3 4.9 4.2 Z" fill="currentColor" />
    </svg>
  );
}

/** A label/value line for the sidebar footer. `attention` tints the value amber. */
export function SidebarStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'attention';
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[0.6875rem] text-ink-faint">{label}</dt>
      <dd
        className={cn(
          'truncate text-[0.6875rem] tabular-nums',
          tone === 'attention' ? 'font-medium text-[var(--amber-deep)]' : 'text-ink-soft',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

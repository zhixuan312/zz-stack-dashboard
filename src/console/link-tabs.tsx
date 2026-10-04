import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type LinkTab = { key: string; label: ReactNode; href: string; count?: ReactNode };

/**
 * Meridian's tab strip for views that are routes of their own: each tab is a link, so every view is linkable and the
 * back button is right. The current one is ink with the accent line under it.
 */
export function LinkTabs({ tabs, active, label }: { tabs: readonly LinkTab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="flex items-stretch gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'hit relative inline-flex h-10 shrink-0 items-center gap-2 px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-hover) first:-ml-2.5 focus-visible:-outline-offset-2',
              on ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className={cn('t-num rounded-full px-1.5 py-px text-2xs font-semibold', on ? 'bg-accent-tint text-accent-ink' : 'bg-fill-track text-ink-2')}>{t.count}</span> : null}
            {on ? <span aria-hidden className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

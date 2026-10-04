'use client';

import Link from 'next/link';
import { Tabs as T } from 'radix-ui';
import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Views of one subject, one at a time: a record's Overview, Logs and Settings; a list's All, Failed and Slow. The
 * current tab is ink with an accent line under it that slides to the tab you choose. On a narrow screen the strip
 * scrolls sideways with snap points; it never wraps to a second line.
 */
export const Tabs = T.Root;

export function TabList({ className, children, ...rest }: ComponentProps<typeof T.List>) {
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const active = () => el.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    const measure = () => {
      const on = active();
      setBar(on ? { x: on.offsetLeft, w: on.offsetWidth } : null);
    };
    /* Keep the chosen tab in view by scrolling the strip only, never the page around it. */
    const reveal = () => {
      const on = active();
      if (!on) return;
      if (on.offsetLeft < el.scrollLeft) el.scrollTo({ left: on.offsetLeft - 8, behavior: 'smooth' });
      else if (on.offsetLeft + on.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollTo({ left: on.offsetLeft + on.offsetWidth - el.clientWidth + 8, behavior: 'smooth' });
    };
    measure();
    const mo = new MutationObserver(() => { measure(); reveal(); });
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { mo.disconnect(); ro.disconnect(); };
  }, []);
  return (
    <T.List
      ref={list}
      className={cn(
        'relative flex snap-x snap-mandatory items-stretch gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...rest}
    >
      {children}
      {bar ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-accent transition-[transform,width] duration-(--dur-enter) ease-out"
          style={{ transform: `translateX(${bar.x}px)`, width: bar.w }}
        />
      ) : null}
    </T.List>
  );
}

export function Tab({ className, count, children, ...rest }: ComponentProps<typeof T.Trigger> & { count?: ReactNode }) {
  return (
    <T.Trigger
      className={cn(
        'group/tab hit relative inline-flex h-10 shrink-0 snap-start items-center gap-2 px-2.5 text-sm font-medium whitespace-nowrap text-ink-2 transition-colors duration-(--dur-hover)',
        'hover:text-ink data-[state=active]:text-ink data-disabled:pointer-events-none data-disabled:text-ink-disabled',
        'focus-visible:-outline-offset-2 first:-ml-2.5',
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined ? (
        <span className="t-num rounded-full bg-fill-track px-1.5 py-px text-2xs font-semibold text-ink-2 group-data-[state=active]/tab:bg-accent-tint group-data-[state=active]/tab:text-accent-ink">
          {count}
        </span>
      ) : null}
    </T.Trigger>
  );
}

export function TabPanel({ className, ...rest }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn('pt-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent', className)} {...rest} />;
}

export type LinkTab = { key: string; label: ReactNode; href: string; count?: ReactNode };

/**
 * The same strip for views that are routes of their own (/knowledge, /knowledge/ask, or ?view=log): each tab is a link,
 * so every view has an address and the back button works. A navigation landmark, not a tablist: the current one carries
 * aria-current="page", and Tab moves between them as between any links.
 */
export function LinkTabs({ tabs, active, label, className }: { tabs: readonly LinkTab[]; active: string; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('flex snap-x snap-mandatory items-stretch gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'hit relative inline-flex h-10 shrink-0 snap-start items-center gap-2 px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-hover) first:-ml-2.5 focus-visible:-outline-offset-2',
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

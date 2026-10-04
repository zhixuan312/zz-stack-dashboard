'use client';

import Link from 'next/link';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

export type Crumb = { label: string; href?: string };

/**
 * Where this page sits: its ancestors, each a link, then the page itself. Past four levels the middle ones fold into
 * a menu, so the trail stays one line and the first and the last two are always visible.
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const folded = items.length > 4;
  const shown: (Crumb | 'fold')[] = folded ? [items[0], 'fold', ...items.slice(-2)] : items;
  const hidden = folded ? items.slice(1, -2) : [];
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1 text-xs">
        {shown.map((c, i) => {
          const last = i === shown.length - 1;
          return (
            <Fragment key={c === 'fold' ? 'fold' : `${c.label}-${i}`}>
              <li className={cn('flex min-w-0 items-center', last ? 'shrink' : 'shrink-0')}>
                {c === 'fold' ? (
                  <Menu>
                    <MenuTrigger aria-label={`${hidden.length} more levels`} className="press hit grid h-5 w-6 place-items-center rounded-xs text-ink-3 hover:bg-fill-hover hover:text-ink">
                      <MoreHorizontal className="size-3.5" />
                    </MenuTrigger>
                    <MenuContent>
                      {hidden.map((h) => (
                        <MenuItem key={h.label} asChild>
                          <Link href={h.href ?? '#'}>{h.label}</Link>
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </Menu>
                ) : last ? (
                  <span aria-current="page" className="truncate font-medium text-ink">{c.label}</span>
                ) : c.href ? (
                  // The hit area is drawn outside the link, so the link itself does not clip: the label inside it truncates.
                  <Link href={c.href} className="hit row-link flex min-w-0 text-ink-2 hover:text-ink"><span className="truncate">{c.label}</span></Link>
                ) : (
                  <span className="truncate text-ink-2">{c.label}</span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className="shrink-0 text-ink-3">
                  <ChevronRight className="size-3" strokeWidth={2} />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

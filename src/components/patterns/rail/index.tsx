'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { app, type NavGroup } from '@/app.config';
import { cn } from '@/lib/cn';
import { AppMark } from '@/components/base/app-mark';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { AppearanceMenu } from '@/components/patterns/appearance-menu';

/** One scope the workspace menu offers: the console reads the whole platform or one team. */
export type Scope = { id: string; label: string; active: boolean; onSelect: () => void };

/**
 * The navigation rail: a translucent wash on the lit ground. The current page is an accent-tinted pill with a lit
 * edge that springs to the item you choose; groups are named in mono caps; a count is a quiet badge.
 */
export function Rail({
  nav,
  current,
  workspace = app.workspace,
  scopes = [],
  user = app.user,
  signOut = '/sign-in',
}: {
  /** The groups and destinations, as the signed-in person may see them. */
  nav: NavGroup[];
  /** The active route; defaults to the current pathname. */
  current?: string;
  /** The line under the product name: the scope in view. */
  workspace?: string;
  /** The scopes the workspace menu switches between; the active one carries the check. */
  scopes?: Scope[];
  /** The signed-in person; pass your session's. `null` while it is still being found out: a placeholder, not a name. Defaults to the sample user in app.config. */
  user?: { name: string; role: string } | null;
  /** Where Sign out goes (a route), what it does (a function, such as your auth's signOut), or null to hide it. */
  signOut?: string | (() => void) | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Menu items only for routes the product has.
  const hasSettings = nav.some((g) => g.items.some((it) => it.href === '/settings'));
  const path = current ?? pathname;
  const list = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<{ y: number; h: number } | null>(null);
  // The longest matching href is the current page, so /enhancements and /enhancements/objectives never both light up.
  const matches = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const here = nav.flatMap((g) => g.items.map((it) => it.href)).filter(matches).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === here;

  const measure = useCallback(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setMarker(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, []);
  // COUPLED: what the marker follows. `[path]` alone re-measured only when the ROUTE changed, so
  // the ring stayed where the active item used to be whenever the list moved under it — a group
  // opened or closed, the rail resized, a font arriving after first paint. `here` is the active
  // item, and the observer is everything else that moves it without changing either.
  useLayoutEffect(() => { measure(); }, [measure, path, here]);
  useLayoutEffect(() => {
    const node = list.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-16 items-center px-4">
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label={`${app.name}, ${workspace}: workspace menu`} className="group -mx-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-fill-hover data-[state=open]:bg-fill-hover">
              <AppMark size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-md leading-tight font-semibold tracking-[-0.015em]">{app.name}</span>
                <span className="t-eyebrow mt-0.5 block truncate">{workspace}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-ink-3 group-hover:text-ink-2" />
            </button>
          </MenuTrigger>
          <MenuContent className="w-60">
            <MenuLabel>{scopes.length > 1 ? 'Show' : 'Workspace'}</MenuLabel>
            {scopes.length ? scopes.map((s) => (
              <MenuItem key={s.id} onSelect={s.onSelect} aria-checked={s.active} role="menuitemradio">
                <Check className={cn('size-4 text-accent', !s.active && 'invisible')} strokeWidth={2.25} />
                <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
              </MenuItem>
            )) : (
              <MenuItem disabled className="opacity-100">
                <Check className="size-4 text-accent" strokeWidth={2.25} />
                <span className="min-w-0 flex-1 truncate text-ink">{app.name} {workspace}</span>
              </MenuItem>
            )}
            {hasSettings || signOut ? <MenuSeparator /> : null}
            {hasSettings ? <MenuItem onSelect={() => router.push('/settings')}><Settings />Workspace settings</MenuItem> : null}
            {signOut ? <MenuItem onSelect={() => (typeof signOut === 'function' ? signOut() : router.push(signOut))}><LogOut />Sign out</MenuItem> : null}
          </MenuContent>
        </Menu>
      </div>
      <nav ref={list} aria-label="Main" className="scroll-fade-y relative flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {marker ? (
          <span
            aria-hidden
            className="absolute inset-x-3 overflow-hidden rounded-md bg-accent-tint ring-1 ring-accent-line ring-inset transition-[transform,height] duration-(--dur-enter) ease-spring"
            style={{ transform: `translateY(${marker.y}px)`, height: marker.h, top: 0 }}
          >
            <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full bg-accent shadow-[0_0_12px_var(--accent)]" />
          </span>
        ) : null}
        {nav.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-6')}>
            {g.label ? <p className="t-eyebrow mb-2 px-3">{g.label}</p> : null}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const on = isActive(it.href);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={on ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-9 pointer-coarse:h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-(--dur-hover)',
                        on ? 'font-medium text-ink' : 'text-ink-2 hover:bg-fill-hover hover:text-ink',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0 transition-colors', on ? 'text-accent-ink' : 'text-ink-3 group-hover:text-ink-2')} strokeWidth={1.75} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.badge ? <span className="t-num grid h-5 min-w-5 place-items-center rounded-full bg-warning-tint px-1.5 text-2xs font-semibold text-warning-ink">{it.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-lg border border-line bg-surface/50 p-2.5">
        {user ? (
          <>
            <Avatar name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-medium">{user.name}</p>
              <p className="truncate text-xs leading-tight text-ink-3">{user.role}</p>
            </div>
          </>
        ) : (
          <div aria-hidden className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <span className="flex flex-1 flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></span>
          </div>
        )}
        <AppearanceMenu />
      </div>
    </div>
  );
}

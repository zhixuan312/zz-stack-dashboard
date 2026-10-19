'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLeave } from '../../base/shell/index';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { app, type NavGroup } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { AppMark } from '../../base/app-mark/index';
import { Avatar } from '../../ui/avatar/index';
import { Skeleton } from '../../ui/skeleton/index';
import { Spinner } from '../../ui/spinner/index';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '../../ui/menu/index';
import { toast } from '../../ui/toast/index';
import { AppearanceMenu } from '../appearance-menu/index';
import { clearThread } from '../assistant/thread';

/** One scope the workspace menu offers: the console reads the whole platform or one team. */
/**
 * A row of the workspace menu. `href` is where choosing it goes, when it goes to a page: the rail prefetches it as the
 * menu opens, since a row is a press and nothing prefetches it before.
 */
export type Scope = { id: string; label: string; active: boolean; onSelect: () => void; href?: string };

/** Who the console is being read as: the persona in view, the ones it may be switched to, and the action that does it. */
export type ViewAs = {
  /** The id of the persona in view; its option carries the check. */
  current: string;
  /** Every persona, in order. A persona who cannot be chosen now stays in the list, disabled. */
  options: { id: string; label: string; disabled?: boolean }[];
  /** Sign in as one: resolves once the route is refreshed, and rejects with a message for the person. */
  choose: (id: string) => Promise<void>;
};

/**
 * What every destination repeats, written once on the nav and keyed on `aria-current`: the pill's size and ink, and the
 * icon's. A link carries only its own href. Literal strings, so Tailwind finds them.
 */
const LINKS = [
  '[&_a]:relative [&_a]:flex [&_a]:h-9 pointer-coarse:[&_a]:h-11 [&_a]:items-center [&_a]:gap-3 [&_a]:rounded-md [&_a]:px-3 [&_a]:text-sm [&_a]:text-ink-2 [&_a]:transition-colors [&_a]:duration-(--dur-hover)',
  '[&_a:not([aria-current]):hover]:bg-fill-hover [&_a:not([aria-current]):hover]:text-ink [&_a[aria-current=page]]:font-medium [&_a[aria-current=page]]:text-ink',
  '[&_a_svg]:size-4 [&_a_svg]:shrink-0 [&_a_svg]:text-ink-3 [&_a_svg]:transition-colors [&_a:not([aria-current]):hover_svg]:text-ink-2 [&_a[aria-current=page]_svg]:text-accent-ink',
].join(' ');

/** The current link's own pill, drawn until the marker has measured where it goes; the marker brings the lit edge a frame later. */
const UNMEASURED = '[&_a[aria-current=page]]:bg-accent-tint [&_a[aria-current=page]]:ring-1 [&_a[aria-current=page]]:ring-accent-line [&_a[aria-current=page]]:ring-inset';

/**
 * The navigation rail: a translucent wash on the lit ground. The current page is an accent-tinted pill with a lit
 * edge that springs to the item you choose; groups are named in mono caps; a count is a quiet badge.
 */
export function Rail({
  nav,
  declared,
  current,
  workspace = app.workspace,
  scopes = [],
  user = app.user,
  signOut = '/sign-in',
  viewAs,
}: {
  /** The groups and destinations, as the signed-in person may see them. */
  nav: NavGroup[];
  /**
   * Every destination the product declares, the ones this person does not hold included, as hrefs. The current page is
   * the longest of these the address sits under, lit only when `nav` holds it: an address under a destination the person
   * may not open lights nothing, never the shorter one above it. Defaults to `nav`'s own hrefs.
   */
  declared?: string[];
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
  /** Who the console may be read as, shown as a "View as" group at the foot of the workspace menu. A product that has one session passes nothing. */
  viewAs?: ViewAs;
}) {
  // Nothing to switch between is not a switcher: with one workspace or none, the row opens the account menu and the menu
  // carries no `Show` group and no checked row of its own (issue #20).
  const switcher = scopes.length > 1;
  const pathname = usePathname();
  const router = useRouter();
  const leave = useLeave();
  // Menu items only for routes the product has.
  const hasSettings = nav.some((g) => g.items.some((it) => it.href === '/settings'));
  const path = current ?? pathname;
  const list = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<{ y: number; h: number } | null>(null);
  // The longest matching href is the current page, so /enhancements and /enhancements/objectives never both light up. It
  // is found among every destination declared, and lit only if this person's rail holds it.
  const matches = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const held = nav.flatMap((g) => g.items.map((it) => it.href));
  const longest = [...new Set([...(declared ?? []), ...held])].filter(matches).sort((a, b) => b.length - a.length)[0];
  const here = longest !== undefined && held.includes(longest) ? longest : undefined;
  const isActive = (href: string) => href === here;

  // View as signs the console in as someone else and re-reads the route. A choice that fails says why in a toast and
  // changes nothing: the check stays on the person in view, which is still who is signed in.
  const choosePersona = (id: string) => {
    if (!viewAs || id === viewAs.current) return;
    void viewAs.choose(id).catch((e) => toast({ tone: 'critical', title: 'Person not changed', description: e instanceof Error ? e.message : undefined }));
  };

  // The observer IS the measurement, the first one included. A rail mounts inside the tap that opens the phone
  // drawer, and reading offsets there makes the browser lay the whole page out inside that tap: measured at a 50 ms
  // frame on a throttled phone against 33 ms for the mount alone. An observation reports the same two numbers after
  // the browser has laid out for itself, and `observe` delivers one for the element it is handed. Until a position
  // exists the current link draws the same pill itself, so nothing moves when the marker takes over — which is what
  // makes it safe for the marker to arrive a frame late.
  // The link also moves without a navigation (the rail is resized, a font arrives late, a group above it changes
  // height), so the list is observed and the marker measured again whenever its size changes.
  useEffect(() => {
    const nav = list.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"]');
      setMarker((was) => {
        const now = el ? { y: el.offsetTop, h: el.offsetHeight } : null;
        return was?.y === now?.y && was?.h === now?.h ? was : now;
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [path, here]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-16 items-center px-4">
        <Menu
          onOpenChange={(open) => {
            // Opening the menu is the person's intent: each other workspace's page is fetched now, so the press that
            // follows finds it ready, as a link the drawer shows is prefetched when the drawer opens.
            if (open) for (const s of scopes) if (!s.active && s.href) router.prefetch(s.href);
          }}
        >
          <MenuTrigger asChild>
            <button type="button" aria-label={`${app.name}, ${workspace}: ${switcher ? 'workspace menu' : 'account menu'}`} className="group -mx-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-fill-hover data-[state=open]:bg-fill-hover">
              <AppMark size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-md leading-tight font-semibold tracking-[-0.015em]">{app.name}</span>
                <span className="t-eyebrow mt-0.5 block truncate">{workspace}</span>
              </span>
              {/* `ChevronsUpDown` is the glyph for choosing between things; with nothing to switch, the row is the menu. */}
              {switcher ? <ChevronsUpDown className="size-3.5 text-ink-3 group-hover:text-ink-2" /> : <ChevronDown className="size-3.5 text-ink-3 group-hover:text-ink-2" />}
            </button>
          </MenuTrigger>
          <MenuContent className="w-60">
            {switcher ? (
              <>
                <MenuLabel>Show</MenuLabel>
                {scopes.map((s) => (
                  <MenuItem key={s.id} onSelect={s.onSelect} aria-checked={s.active} role="menuitemradio">
                    <Check className={cn('size-4 text-accent', !s.active && 'invisible')} strokeWidth={2.25} />
                    <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                  </MenuItem>
                ))}
              </>
            ) : null}
            {hasSettings || signOut ? <MenuSeparator /> : null}
            {hasSettings ? <MenuItem onSelect={() => leave(() => router.push('/settings'))}><Settings />Workspace settings</MenuItem> : null}
            {/* The assistant's conversation is the signed-in person's: it leaves the browser with them. */}
            {signOut ? <MenuItem onSelect={() => leave(() => { clearThread(localStorage); if (typeof signOut === 'function') signOut(); else router.push(signOut); })}><LogOut />Sign out</MenuItem> : null}
            {viewAs ? (
              <>
                <MenuSeparator />
                <MenuLabel>View as</MenuLabel>
                {/* Radio items, so arrow keys move through the personas and the one in view reads as checked. */}
                <MenuRadioGroup value={viewAs.current} onValueChange={choosePersona} aria-label="View as">
                  {viewAs.options.map((o) => (
                    <MenuRadioItem key={o.id} value={o.id} disabled={o.disabled}>{o.label}</MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>
      <nav ref={list} aria-label="Main" className={cn('scroll-fade-y relative flex-1 overflow-y-auto px-3 pt-3 pb-4', LINKS, !marker && UNMEASURED)}>
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
                      // Under partialPrefetching a link prefetches its route's App Shell only. An item that asks (the Docs
                      // item, whose article is its page's URL data) is prefetched in full: from /settings, the start guide's
                      // desktop warm shell went from 77-146 ms to 26-27 ms with no request after the press, at the cost of
                      // one prefetch of about 15 KiB on each main-workspace page on the desktop; the phone's closed drawer
                      // shows no link and prefetches nothing. The `in` test keeps this compiling in a project whose NavItem has no field.
                      prefetch={'prefetch' in it && it.prefetch === true ? true : undefined}
                      aria-current={on ? 'page' : undefined}
                    >
                      <LinkIcon icon={<Icon strokeWidth={1.75} />} label={it.label} />
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

/**
 * A destination's icon, which turns into a spinner while its page is on the way. A route whose page renders on request
 * and has no `loading.tsx` would otherwise give no answer to the click until the server does; a prefetched route is
 * never pending, so it never shows. The spinner sits in the icon's 16px, so nothing shifts.
 */
function LinkIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { pending } = useLinkStatus();
  // The spinner takes the icon's own 16px, so the link carries no wrapper of its own and nothing shifts.
  return pending ? <Spinner size="sm" label={`Opening ${label}`} className="size-4 items-center justify-center" /> : icon;
}

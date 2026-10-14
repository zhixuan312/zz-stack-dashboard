'use client';

import { Suspense, use, type ComponentProps } from 'react';
import { nav, type NavGroup } from '../app.config';
import { CommandPalette } from '../components/patterns/command-palette/index';
import { Rail } from '../components/patterns/rail/index';
import { Skeleton } from '../components/ui/skeleton/index';
import type { ChromeAccess } from '../lib/collection';

/**
 * The console's rail and command palette, with the destinations from app.config. They are chosen here, on the client,
 * because a destination carries its icon, a component that cannot cross from the server layout.
 *
 * What depends on the request comes from the product's own layout as a promise it does not await: `access`, the
 * destinations this person may see, the signed-in person and the View as group (`chromeAccess()` in the template's
 * `src/data/access.ts`). Each piece of chrome waits for it inside its own boundary, so the frame is what the static
 * shell streams first, the person's own rail follows in the same response, and no destination is ever drawn and then
 * taken away. Until it resolves the rail keeps its frame, the placeholder person and no destination.
 *
 * Without `access` at all (the Atlas's previews and held-still screens) the chrome shows the full navigation and
 * `app.user`; that is the no-sign-in console, never a fallback for an identity that failed to resolve.
 *
 * A product that has its own destinations passes them as `nav`: they are drawn in place of the configured ones, in their
 * own groups and order, and filtered by `access` the same way. A supplied empty navigation stays empty.
 *
 * A product that learns who is signed in in the browser has no promise for a layout to hand over: it passes `access` as
 * the value once it has it (`null` for nobody), which is drawn at once, and holds `RailPending` in the rail's place
 * until then.
 */
export function ConsoleRail({ access, nav: given, ...props }: RailProps & { access?: Access }) {
  if (access === undefined) return <Rail nav={given ?? nav} {...props} />;
  if (!pending(access)) return <ResolvedRail access={access} nav={given} {...props} />;
  return (
    <Suspense fallback={<RailPending />}>
      <ResolvedRail access={access} nav={given} {...props} />
    </Suspense>
  );
}

/** Who is signed in and what they may open: on its way from the request, or already known (`null` for nobody). */
type Access = Promise<ChromeAccess | null> | ChromeAccess | null;
const pending = (access: Access): access is Promise<ChromeAccess | null> => access !== null && typeof (access as { then?: unknown }).then === 'function';

/** What the layout hands the rail: the Rail's own props, less the three the request decides, with the navigation optional. */
type RailProps = Omit<ComponentProps<typeof Rail>, 'nav' | 'user' | 'viewAs'> & { nav?: NavGroup[] };

/**
 * The rail's shape while the person's own rail is on its way: the frame's space, held open so the page never shifts and
 * no destination is offered that this person may not have. It is deliberately a skeleton rather than the frame itself —
 * a fallback that drew the real rail would put a second copy of it in every page's HTML, which is what the HTML budget
 * in `pnpm verify` refuses.
 */
export function RailPending() {
  return (
    <div aria-hidden className="flex h-full w-full flex-col">
      <div className="flex h-16 items-center px-4">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <Skeleton className="size-7 rounded-md" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 pt-3">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-7 w-full rounded-md" />)}
      </div>
      <div className="m-3 flex items-center gap-3 p-2.5">
        <Skeleton className="size-8 rounded-full" />
        <span className="flex flex-1 flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></span>
      </div>
    </div>
  );
}

export function ConsolePalette({ access, nav: given }: { access?: Access; nav?: NavGroup[] }) {
  if (access === undefined) return <CommandPalette nav={given ?? nav} />;
  if (!pending(access)) return <ResolvedPalette access={access} nav={given} />;
  return (
    <Suspense fallback={null}>
      <ResolvedPalette access={access} nav={given} />
    </Suspense>
  );
}

/** The rail with nobody signed in yet: its frame, the placeholder person, and no destination to click. */
const NOTHING: NavGroup[] = [];

function ResolvedRail({ access, nav: given, ...props }: RailProps & { access: Access }) {
  const chrome = pending(access) ? use(access) : access;
  // A promise that settled on nothing is an identity nobody could resolve: keep the placeholder, never the sample person.
  if (!chrome) return <Rail nav={NOTHING} user={null} {...props} />;
  return <Rail nav={visible(chrome.only, given)} user={chrome.user} viewAs={chrome.viewAs} {...props} />;
}

function ResolvedPalette({ access, nav: given }: { access: Access; nav?: NavGroup[] }) {
  const chrome = pending(access) ? use(access) : access;
  return <CommandPalette nav={chrome ? visible(chrome.only, given) : NOTHING} />;
}

/**
 * The navigation narrowed to the hrefs given, with a group left empty dropped; every destination without them. The
 * navigation is `sourceNav` when one is supplied, an empty one included, and the configured `nav` otherwise.
 *
 * The hrefs come from `chromeAccess().only`, the destinations this person satisfies the need of. This is presentation
 * only and never the gate: a destination kept out of the rail is still reachable by its address, so each page carries
 * its own gate (a later task puts one on every page). The palette takes the same list, so the two always agree.
 */
export function visible(only?: string[], sourceNav?: NavGroup[]): NavGroup[] {
  const source = sourceNav ?? nav;
  if (!only) return source;
  return source.map((g) => ({ ...g, items: g.items.filter((i) => only.includes(i.href)) })).filter((g) => g.items.length);
}

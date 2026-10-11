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
 * Without `access` at all (the Atlas's previews and held-still screens) the chrome shows the full `nav` and `app.user`;
 * that is the no-sign-in console, never a fallback for an identity that failed to resolve.
 */
export function ConsoleRail({ access, ...props }: Omit<ComponentProps<typeof Rail>, 'nav' | 'user' | 'viewAs'> & { access?: Promise<ChromeAccess | null> }) {
  if (!access) return <Rail nav={nav} {...props} />;
  return (
    <Suspense fallback={<RailPending />}>
      <ResolvedRail access={access} {...props} />
    </Suspense>
  );
}

/**
 * The rail's shape while the person's own rail is on its way: the frame's space, held open so the page never shifts and
 * no destination is offered that this person may not have. It is deliberately a skeleton rather than the frame itself —
 * a fallback that drew the real rail would put a second copy of it in every page's HTML, which is what the HTML budget
 * in `pnpm verify` refuses.
 */
function RailPending() {
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

export function ConsolePalette({ access }: { access?: Promise<ChromeAccess | null> }) {
  if (!access) return <CommandPalette nav={nav} />;
  return (
    <Suspense fallback={null}>
      <ResolvedPalette access={access} />
    </Suspense>
  );
}

/** The rail with nobody signed in yet: its frame, the placeholder person, and no destination to click. */
const NOTHING: NavGroup[] = [];

function ResolvedRail({ access, ...props }: Omit<ComponentProps<typeof Rail>, 'nav' | 'user' | 'viewAs'> & { access: Promise<ChromeAccess | null> }) {
  const chrome = use(access);
  // A promise that settled on nothing is an identity nobody could resolve: keep the placeholder, never the sample person.
  if (!chrome) return <Rail nav={NOTHING} user={null} {...props} />;
  return <Rail nav={visible(chrome.only)} user={chrome.user} viewAs={chrome.viewAs} {...props} />;
}

function ResolvedPalette({ access }: { access: Promise<ChromeAccess | null> }) {
  const chrome = use(access);
  return <CommandPalette nav={chrome ? visible(chrome.only) : NOTHING} />;
}

/**
 * `nav` narrowed to the hrefs given, with a group left empty dropped; every destination without them.
 *
 * The hrefs come from `chromeAccess().only`, the destinations this person satisfies the need of. This is presentation
 * only and never the gate: a destination kept out of the rail is still reachable by its address, so each page carries
 * its own gate (a later task puts one on every page). The palette takes the same list, so the two always agree.
 */
export function visible(only?: string[]): NavGroup[] {
  if (!only) return nav;
  return nav.map((g) => ({ ...g, items: g.items.filter((i) => only.includes(i.href)) })).filter((g) => g.items.length);
}

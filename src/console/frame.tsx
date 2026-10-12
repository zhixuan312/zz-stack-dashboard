'use client';

import { Suspense, useEffect, useState } from 'react';
import { CommandPalette } from '@/components/patterns/command-palette';
import { Rail, type Scope } from '@/components/patterns/rail';
import { ShellTools, type Alert } from '@/components/patterns/shell-tools';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsole, useConsoleMode, useDataClock } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';
import { navGroups } from '@/nav';
import { useLive } from '@/lib/live';
import { useWaitingGates } from '@/console/initiative';

/** Sign out is a POST, so a link prefetch can never end a session: build the form and submit it. */
function signOut() {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/auth/logout';
  document.body.append(form);
  form.submit();
}

/**
 * Work sitting on a person: every gate document that is written and not yet approved, on an open initiative, and a
 * closed initiative's correction awaiting approval. The bell is the one place the console says "this
 * needs you" without being asked.
 */
function useWaitingAlerts(enabled: boolean): Alert[] {
  /* The chrome reads too, so the chrome registers too: without this the bell keeps a count nothing ever corrects. It is
   * the ONE place the console says "this needs you", and a gate approved in another tab left it stale on every page
   * whose own read is not also `initiatives` — which is all of them but two. Registered here, beside the read, rather
   * than by the pages: what a component shows is the component's to declare. Nothing registers while the bell is
   * disabled and reading nothing. */
  useLive(enabled ? ['initiatives'] : []);
  const q = useWaitingGates(enabled);
  return (q.data?.waiting ?? []).map((w) => ({
    id: w.id,
    title: `${w.gate[0].toUpperCase()}${w.gate.slice(1)} waits for approval`,
    detail: `${w.team} · ${w.slug}`,
    at: w.updated,
    href: `/initiatives/${w.team}/${w.slug}`,
    tone: 'warning' as const,
    unread: true,
  }));
}

/**
 * The rail's shape while it is on its way: the frame's space, held open so the page never shifts.
 *
 * Deliberately a skeleton and not the rail's own frame — a fallback that drew the real rail would put a second copy of
 * it in every page's HTML, which is what the `htmlKb` budget in `pnpm verify` refuses.
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

/**
 * The shell's shape while it is on its way, for the one boundary `app/(dash)/layout.tsx` puts around `AppShell`.
 *
 * That boundary is not tidiness and its fallback is not decoration. `AppShell` calls `usePathname`, and Next resolves
 * that on the server only where every segment is known at build time: on a route with an unknown dynamic param
 * (`/initiatives/[team]/[slug]`, `/teams/[slug]`, `/plugins/[plugin]`) the hook SUSPENDS while prerendering, so the
 * boundary is postponed and its fallback is what the prerendered HTML holds. `fallback={null}` made that fallback
 * nothing at all, and a page load then put the client's own render of the shell where the server had emitted no nodes:
 * React reported a hydration mismatch (error #418), on a different route each run and only under load, which is what
 * took three separate audits to see. Next's own guidance is to wrap the hook in a boundary "with a fallback".
 *
 * It draws the shell's own frame — the rail's column at its own width, the canvas beside it — so the fallback holds the
 * space the real shell takes, exactly as `RailPending` does for the rail. The canvas stays empty on purpose: the page
 * has its own `loading.tsx`, and a second skeleton drawn here would be two loading states for one page.
 */
export function ShellPending() {
  return (
    <div aria-hidden className="fixed inset-0 isolate flex overflow-hidden">
      <aside className="hidden h-full w-(--rail-width) shrink-0 border-r border-line bg-frame backdrop-blur-xl backdrop-saturate-150 lg:flex">
        <RailPending />
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col" />
    </div>
  );
}

/**
 * The console's chrome: the rail, the tools beside it and the command palette. Three client components, because each
 * reads who is signed in from `/me` in the browser, and each keeps its own `<Suspense>` boundary.
 *
 * INTERIM, and it says what it is waiting for. Meridian ships this chrome as `src/views/console-chrome.tsx`, and this
 * file is the console's own copy of the same shape. It is not the release's for two reasons, both reported: in 0.14.1
 * `ChromeAccess.viewAs` is required and the rail draws a "View as" group whenever it is given, which a console with
 * one session per person has nothing to put in (zz-meridian#23); and the release's chrome learns who is signed in only
 * from a promise the server resolves, where this console learns it in the browser (zz-meridian#24). When the release
 * takes either a resolved value or an optional `viewAs`, this file goes and the layout renders `console-chrome.tsx`.
 *
 * The boundary is not tidiness. The rail, the tools and the palette read `usePathname` and `useRouter`, and Cache
 * Components refuses a dynamic client hook outside a boundary: the build fails the route outright rather than
 * prerendering it. This is the release's own shape (`src/views/console-chrome.tsx`) — the boundary is what the static
 * shell streams first, and the person's own rail follows in the same response, so no destination is ever drawn and
 * then taken away. Until `/me` answers the rail keeps its frame, the placeholder person and no destination.
 *
 * They are rendered from `app/(dash)/layout.tsx`, a Server Component, and not from a client frame: that is what keeps
 * `AppShell` itself out of the client render, so the shell's own `usePathname` is never a hook reached through a client
 * boundary. The release's layout is built the same way.
 */
export function ConsoleRail() {
  return (
    <Suspense fallback={<RailPending />}>
      <ResolvedRail />
    </Suspense>
  );
}

function ResolvedRail() {
  useLive(['me']);
  const me = useConsole<Me>('/me');
  const { mode, setMode } = useConsoleMode();
  // NOTHING THE SERVER CANNOT HAVE MAY REACH THE MARKUP ON THE HYDRATION RENDER.
  //
  // The server has no `/me`, so this component renders there with `me.data` undefined. The client hydrates the *same*
  // component, and if `/me` has already answered by then it renders with the answer — and the rail's own label turns on
  // it: `switcher` is `scopes.length > 1`, so the server drew `aria-label="…: account menu"` and a superadmin's client
  // draws `"…: workspace menu"`. **That is React #418**, and it is the mismatch this project has chased for five hours
  // across four routes, four suites and every width: it looked like a race only because the boundary resolves at
  // different moments, while the *content* of the mismatch was fixed and the server could be caught holding it.
  //
  // Found by curling the served HTML of a production build — `grep -o 'aria-label="[^"]*"'` — after five hours of
  // driving browsers at it. `next dev` cannot show it: dev server-renders on demand, so there is no
  // prerender-versus-hydrate gap to find.
  //
  // The fix is that the first client render agrees with the server's: no `/me` until the client is past hydration.
  // One frame later the rail is whole. `mode` is read from a context whose server default is the same as its client
  // default, so it is not gated here — and if the reproducer says otherwise, this is not the whole fix.
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);
  const data = hydrated ? me.data : undefined;
  const team = data?.activeTeam;
  const scopes: Scope[] = data?.superadmin
    ? [
      { id: 'platform', label: 'The whole platform', active: mode === 'platform', onSelect: () => setMode('platform') },
      { id: 'team', label: team ? `Your team · ${team}` : 'Your team', active: mode === 'team', onSelect: () => setMode('team') },
    ]
    : [];
  const user = data ? { name: data.name || data.email, role: data.superadmin ? 'Superadmin' : 'Member' } : null;
  return (
    <Rail
      nav={navGroups(mode)}
      workspace={mode === 'platform' ? 'The platform' : team ?? 'Your team'}
      scopes={scopes}
      user={user}
      signOut={data?.mayRead ? signOut : null}
    />
  );
}

/** The bell and the alert times. Its own boundary, for the same reason as the rail's: the clock and the alerts are reads. */
export function ConsoleTools() {
  return (
    <Suspense fallback={<span aria-hidden className="inline-block size-9" />}>
      <ResolvedTools />
    </Suspense>
  );
}

function ResolvedTools() {
  const me = useConsole<Me>('/me');
  // The data's clock, for the alert times under the bell: never `new Date()` at render.
  const clock = useDataClock();
  return <ShellTools alerts={useWaitingAlerts(!!me.data?.mayRead)} now={clock} />;
}

/** The palette reads the router to close itself on navigation, so it is behind a boundary too. */
export function ConsolePalette() {
  return (
    <Suspense fallback={null}>
      <ResolvedPalette />
    </Suspense>
  );
}

function ResolvedPalette() {
  const { mode } = useConsoleMode();
  return <CommandPalette nav={navGroups(mode)} />;
}

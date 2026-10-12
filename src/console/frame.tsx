'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { Scope } from '@/components/patterns/rail';
import { ShellTools, type Alert } from '@/components/patterns/shell-tools';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsole, useConsoleMode, useDataClock } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';
import type { ChromeAccess } from '@/lib/collection';
import { shownIn } from '@/nav';
import { ConsolePalette as ReleasePalette, ConsoleRail as ReleaseRail } from '@/views/console-chrome';
import { useLive } from '@/lib/live';
import { useWaitingGates } from '@/console/waiting-gates';

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
 *
 * INTERIM: this is the release's own pending rail, written out a second time. `src/views/console-chrome.tsx` draws the
 * same frame and keeps it private, and this console needs it in two places the release's chrome is not rendered: the
 * shell's fallback below, and the render before hydration. It goes when the release exports its own (zz-meridian#24).
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
 * The console's chrome is Meridian's: the rail and the command palette are the release's own `ConsoleRail` and
 * `ConsolePalette` (`src/views/console-chrome.tsx`), which draw the destinations, the person, the pending frame and the
 * boundary around each. This file tells them who is signed in, and nothing about how a rail is drawn.
 *
 * **What it has to bridge.** The release's chrome takes who is signed in as `access`, a promise it resolves inside its
 * own `<Suspense>`. Meridian's own layout builds that promise on the server; this console learns who is signed in from
 * `/me` in the browser, because the session is a cookie the browser sends to the gateway. So the promise is made here,
 * in the browser: pending until `/me` answers, then settled with the destinations the view in force shows (`shownIn`)
 * and the person. The chrome cannot tell the difference, which is the point.
 *
 * **Nothing the server cannot have reaches the markup on the hydration render.** The server has no `/me`, and a promise
 * that never settles would hold its response open, so the server and the first client render draw `RailPending` and no
 * palette. One frame after hydration the release's chrome takes over with the promise. That rule is why this console
 * stopped throwing React #418: a rail that rendered `/me` on the hydration pass disagreed with the server's HTML
 * whenever `/me` had already answered, on a different route each run. Found by curling the served HTML of a production
 * build; `next dev` cannot show it, since it renders on demand and has no prerender to disagree with.
 *
 * `viewAs` is left out of what `access` settles with, which the release's `Rail` reads as "nobody to view as" and draws
 * no group for. `ChromeAccess` in 0.14.1 declares it required, so the value is narrowed to the type at the one place
 * below; Meridian's own head has made it optional, and zz-meridian#23 asks for that in a release.
 *
 * They are rendered from `app/(dash)/layout.tsx`, a Server Component, and not from a client frame: that is what keeps
 * `AppShell` itself out of the client render, so the shell's own `usePathname` is never a hook reached through a client
 * boundary. The release's layout is built the same way.
 */

/** Until `/me` answers: the release's chrome waits on this in its own boundary and draws its pending frame. */
const PENDING: Promise<ChromeAccess | null> = new Promise(() => {});

/**
 * A promise already settled with `value`, marked the way React reads one (`status`, `value`), so the chrome that
 * receives it renders at once: an untracked promise suspends for a tick even when it has resolved, and switching the
 * view would flash the pending frame.
 */
function settled(value: ChromeAccess): Promise<ChromeAccess | null> {
  return Object.assign(Promise.resolve<ChromeAccess | null>(value), { status: 'fulfilled' as const, value });
}

/** Who is signed in and what the view in force shows, as the promise Meridian's chrome takes; `null` before hydration. */
function useChromeAccess(): { access: Promise<ChromeAccess | null> | null; me: Me | undefined } {
  const me = useConsole<Me>('/me');
  const { mode } = useConsoleMode();
  const [hydrated, setHydrated] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHydrated(true); }, []);
  const data = hydrated ? me.data : undefined;
  const name = data ? data.name || data.email : null;
  const superadmin = data?.superadmin ?? false;
  const access = useMemo(() => {
    if (name === null) return PENDING;
    // The one place the value is narrowed: see the note on `viewAs` above.
    return settled({ only: shownIn(mode), user: { name, role: superadmin ? 'Superadmin' : 'Member' } } as ChromeAccess);
  }, [name, superadmin, mode]);
  return { access: hydrated ? access : null, me: data };
}

/** The rail: the release's, told who is signed in, with the console's own scope switch and sign-out. */
export function ConsoleRail() {
  return (
    <Suspense fallback={<RailPending />}>
      <SignedInRail />
    </Suspense>
  );
}

function SignedInRail() {
  useLive(['me']);
  const { access, me } = useChromeAccess();
  const { mode, setMode } = useConsoleMode();
  if (!access) return <RailPending />;
  const team = me?.activeTeam;
  const scopes: Scope[] = me?.superadmin
    ? [
      { id: 'platform', label: 'The whole platform', active: mode === 'platform', onSelect: () => setMode('platform') },
      { id: 'team', label: team ? `Your team · ${team}` : 'Your team', active: mode === 'team', onSelect: () => setMode('team') },
    ]
    : [];
  return (
    <ReleaseRail
      access={access}
      workspace={mode === 'platform' ? 'The platform' : team ?? 'Your team'}
      scopes={scopes}
      signOut={me?.mayRead ? signOut : null}
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

/** The palette: the release's, over the same destinations the rail shows. */
export function ConsolePalette() {
  return (
    <Suspense fallback={null}>
      <SignedInPalette />
    </Suspense>
  );
}

function SignedInPalette() {
  const { access } = useChromeAccess();
  return access ? <ReleasePalette access={access} /> : null;
}

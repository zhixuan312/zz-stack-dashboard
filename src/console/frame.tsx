'use client';

import { Suspense, useDeferredValue } from 'react';
import { ShellTools, type Alert } from '@/components/patterns/shell-tools';
import { useConsole, useDataClock } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';
import { RailPending } from '@/views/console-chrome';
import { useLive } from '@/lib/live';
import { useWaitingGates } from '@/console/waiting-gates';

/*
 * The console's own pieces of the shell: its frame while the shell is on its way, and the bell. The rail and the
 * palette are the release's, drawn from the server's answer in `src/views/workspace-chrome.tsx`.
 */

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
  // Deferred: the page commits what it has to show first, and the bell's list follows when the main thread is free.
  const mayRead = useDeferredValue(!!me.data?.mayRead);
  return <ShellTools alerts={useWaitingAlerts(mayRead)} now={clock} />;
}

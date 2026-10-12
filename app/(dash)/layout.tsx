import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/base/shell';
import { ConsolePalette, ConsoleRail, ConsoleTools, ShellPending } from '@/console/frame';
import { ConsoleGate } from '@/console/gate';
import { assistantConfig } from '@/lib/assistant/config';
import { ConsoleLive } from '@/views/console-live';

/**
 * Every console page: the rail on the frame, the page on the canvas, the sign-in gate in front of the page.
 *
 * A Server Component, and `AppShell` is rendered here rather than inside a client frame. That is what keeps the shell
 * out of the client render: rendered from a Client Component, the shell's own `usePathname` is a dynamic client hook
 * reached through a client boundary, and Cache Components fails the route instead of prerendering it. The release's
 * own `app/(dashboard)/layout.tsx` is built the same way — the layout holds the shell and hands it client pieces, each
 * of which resolves its own reads behind its own `<Suspense>`.
 *
 * THE BOUNDARY BELOW IS LOAD-BEARING, and its fallback is why it is written with one rather than `null`. `AppShell`
 * calls `usePathname`, and Next resolves that on the server only where every segment is known at build time; on a route
 * with an unknown dynamic param the hook suspends while prerendering, so this boundary is postponed and what the
 * prerendered HTML holds is the fallback. With `fallback={null}` that was no nodes at all, and a page load put the
 * client's own render of the shell where the server had emitted nothing — React's hydration mismatch (#418), on a
 * different route each run and only under load. `ShellPending` is the fallback Next's guidance asks for, and it draws
 * the shell's own frame so nothing shifts when the real shell arrives.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  // The assistant is on or off per request, from the environment at request time, never baked into the build. The layout
  // hands the shell a promise instead of awaiting it, so the request never blocks the frame: the shell streams in the
  // static chrome and the launcher resolves behind its own boundary.
  const assistant = connection().then(() => assistantConfig(process.env) !== null);
  return (
    <Suspense fallback={<ShellPending />}>
      <AppShell
        assistant={assistant}
        rail={<ConsoleRail />}
        tools={<ConsoleTools />}
      >
        <ConsoleLive>
          {/* No boundary of its own around the page: `loading.tsx` beside this file already gives the segment its
              streamed fallback, and a second one with `fallback={null}` put the page in a boundary whose server HTML and
              client hydration disagreed — React threw its hydration-mismatch error on /settings at every width and in
              both themes. */}
          <ConsoleGate>{children}</ConsoleGate>
        </ConsoleLive>
        <ConsolePalette />
      </AppShell>
    </Suspense>
  );
}

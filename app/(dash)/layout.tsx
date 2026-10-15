import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/base/shell';
import { ConsoleTools, ShellPending } from '@/console/frame';
import { PageViews } from '@/console/page-view';
import { chromeAccess } from '@/data/access';
import { ConsoleCaller } from '@/lib/api';
import { assistantConfig } from '@/lib/assistant/config';
import { ConsoleLive } from '@/views/console-live';
import { WorkspacePalette, WorkspaceRail } from '@/views/workspace-chrome';

/**
 * Every console page: the rail on the frame, the page on the canvas. The sign-in gate is each page's own first
 * statement (`gate` in `src/data/access.ts`), so nothing here decides whether a page may render.
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
  // The rail's destinations and the signed-in person, one promise for both pieces of chrome: not awaited, so the frame
  // is still the first thing streamed, and the same request-scoped read of `/me` the page's gate makes. An identity
  // nobody can resolve, or a gateway that cannot be reached, settles on null, which the chrome draws as the placeholder
  // person and no destination; the page's own gate is what answers it.
  const access = chromeAccess().catch(() => null);
  return (
    <Suspense fallback={<ShellPending />}>
      <ConsoleCaller access={access}>
        <AppShell
          assistant={assistant}
          rail={<WorkspaceRail access={access} />}
          tools={<ConsoleTools />}
        >
          <ConsoleLive>
            {/* No boundary of its own around the page: `loading.tsx` beside each page already gives the segment its
                streamed fallback, and a second one with `fallback={null}` put the page in a boundary whose server HTML and
                client hydration disagreed — React threw its hydration-mismatch error on /settings at every width and in
                both themes. */}
            {children}
          </ConsoleLive>
          <WorkspacePalette access={access} />
          {/* One page view per committed navigation, inside this boundary because it reads the pathname too. */}
          <PageViews />
        </AppShell>
      </ConsoleCaller>
    </Suspense>
  );
}

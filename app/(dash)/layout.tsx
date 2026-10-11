import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/base/shell';
import { ConsolePalette, ConsoleRail, ConsoleTools } from '@/console/frame';
import { ConsoleGate } from '@/console/gate';

/**
 * Every console page: the rail on the frame, the page on the canvas, the sign-in gate in front of the page.
 *
 * A Server Component, and `AppShell` is rendered here rather than inside a client frame. That is what keeps the shell
 * out of the client render: rendered from a Client Component, the shell's own `usePathname` is a dynamic client hook
 * reached through a client boundary, and Cache Components fails the route instead of prerendering it. The release's
 * own `app/(dashboard)/layout.tsx` is built the same way — the layout holds the shell and hands it client pieces, each
 * of which resolves its own reads behind its own `<Suspense>`.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
    <AppShell
      // This console mounts no assistant: the release's shell asks for a promise, and `false` is this product's answer.
      assistant={Promise.resolve(false)}
      rail={<ConsoleRail />}
      tools={<ConsoleTools />}
    >
      {/* The gate reads the path and the router to send a signed-out visitor to sign in, and pages keep their filters
          in the address (`useQueryState`) — both are dynamic client hooks, so both are behind this one boundary. */}
      <Suspense fallback={null}>
        <ConsoleGate>{children}</ConsoleGate>
      </Suspense>
      <ConsolePalette />
    </AppShell>
    </Suspense>
  );
}

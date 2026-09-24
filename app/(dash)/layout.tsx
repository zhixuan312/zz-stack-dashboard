import type { ReactNode } from 'react';
import { AppShell } from '@/components/ui';
import { Sidebar } from '@/components/Sidebar';
import { ConsoleGate } from '@/components/ConsoleGate';
import { SidebarFooter } from '@/components/SidebarFooter';

/**
 * The locked console frame. Only `ShellBody` — reached through each page's
 * `DashboardPage` — ever scrolls.
 *
 * DELIBERATE: the gate wraps the children and not the shell, so a person who is
 * not signed in still sees the rail and the wordmark. The rail's own links do
 * nothing useful until they are in.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={
        <Sidebar
          /* The heading lives inside SidebarFooter, which renders nothing at
             all until there is a session, so an anonymous visitor is never
             told "Signed in". */
          footer={<SidebarFooter />}
        />
      }
    >
      <div data-testid="main-column" className="contents">
        <ConsoleGate>{children}</ConsoleGate>
      </div>
    </AppShell>
  );
}

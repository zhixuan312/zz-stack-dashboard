import type { ReactNode } from 'react';
import { AppShell } from '@/components/ui';
import { Sidebar } from '@/components/Sidebar';
import { ConsoleGate } from '@/components/ConsoleGate';
import { SidebarFooter } from '@/components/SidebarFooter';

/**
 * The locked console frame. Only `ShellBody` — reached through each page's
 * `DashboardPage` — ever scrolls.
 *
 * The gate wraps the CHILDREN and not the shell, deliberately: a person who is
 * not signed in still sees the rail and the wordmark, so the sign-in screen
 * reads as this product asking them to sign in rather than as a bare page that
 * might be anything. The rail's own links do nothing useful until they are in,
 * and that is honest — they can see what is here before they decide to.
 */
export default function DashLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={
        <Sidebar
          /* The heading lives inside SidebarFooter, which renders nothing at
             all until there is a session — a rail that announces "Signed in"
             to an anonymous visitor undermines the one screen whose whole job
             is to be trusted. The theme toggle used to sit below it; it is a
             setting, so it lives in Settings now. */
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

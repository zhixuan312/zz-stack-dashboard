'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui';
import { Toaster } from '@/components/ui/toast';
import { PeriodProvider } from '@/components/PeriodProvider';
import { ConsoleModeProvider } from '@/lib/api';

/**
 * Client-provider shell, mounted once by the root layout.
 *
 * - TanStack Query drives any client-owned polling or mutation flow.
 * - `ConsoleModeProvider` holds the superadmin's platform/team choice above
 *   every page, so it survives navigation; it must sit inside
 *   `QueryClientProvider` because it fetches `/me` itself to pick a default.
 * - `PeriodProvider` holds the reporting period for the same reason, and above the
 *   pages rather than inside one so the picker and the page that answers it cannot
 *   disagree about which window is selected.
 * - Radix `TooltipProvider` is mounted here so individual `Tooltip`s need no
 *   provider of their own.
 * - `Toaster` is the single mount point for `showToast()`; the store is
 *   module-level, so a second mount would render every toast twice.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ConsoleModeProvider>
        <PeriodProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
        </PeriodProvider>
      </ConsoleModeProvider>
    </QueryClientProvider>
  );
}

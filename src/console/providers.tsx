'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ConsoleModeProvider } from '@/lib/api';
import { PeriodProvider } from '@/console/period';

/**
 * The console's own state, mounted once inside Meridian's `Providers` (appearance, tooltips, toasts).
 *
 * - TanStack Query holds every read and write; see `src/lib/api.ts` and `src/lib/mutate.ts`.
 * - `ConsoleModeProvider` holds the superadmin's platform/team choice above every page, so it survives navigation;
 *   it sits inside `QueryClientProvider` because it reads `/me` to pick a default.
 * - `PeriodProvider` holds the reporting period above the pages, so the picker and the page that answers it cannot
 *   disagree about which window is selected.
 */
export function ConsoleProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ConsoleModeProvider>
        <PeriodProvider>{children}</PeriodProvider>
      </ConsoleModeProvider>
    </QueryClientProvider>
  );
}

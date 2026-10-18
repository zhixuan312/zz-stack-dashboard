'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrandArt } from '@/console/brand';
import { PeriodProvider } from '@/console/period';

/**
 * The console's own state, mounted once inside Meridian's `Providers` (appearance, tooltips, toasts).
 *
 * - TanStack Query holds every read and write; see `src/lib/api.ts` and `src/lib/mutate.ts`.
 * - `PeriodProvider` holds the reporting period above the pages, so the picker and the page that answers it cannot
 *   disagree about which window is selected.
 * - `BrandArt` gives every centred empty state ZZ's mascot for its kind.
 */
export function ConsoleProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <BrandArt>{children}</BrandArt>
      </PeriodProvider>
    </QueryClientProvider>
  );
}

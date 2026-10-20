'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrandArt } from '@/console/brand';

/**
 * The console's own state, mounted once inside Meridian's `Providers` (appearance, tooltips, toasts).
 *
 * - TanStack Query holds every read and write; see `src/lib/api.ts` and `src/lib/mutate.ts`.
 * - `BrandArt` gives every centred empty state ZZ's mascot for its kind.
 */
export function ConsoleProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <BrandArt>{children}</BrandArt>
    </QueryClientProvider>
  );
}

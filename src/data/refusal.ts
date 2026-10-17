/**
 * What a gated route's loading state may say of its page, under the product's `refusal` (`src/app.config.ts`). It reads
 * only the configuration, so a `loading.tsx` that asks it pulls in nothing of the gate (`src/data/access.ts`) and the
 * route's shell stays prerendered.
 */
import type { ReactNode } from 'react';
import { refusal } from '@/app.config';

/** What a loading state says of its page: the words `LoadingPage` takes that name it. */
type LoadingNames = { name: string; title?: string; kicker?: ReactNode; description?: ReactNode };

/**
 * The loading state is drawn before `gate` has answered and is prerendered into the route's shell, so it cannot know who
 * is reading: under `refusal: 'absent'` it names nothing for anyone (the busy region is "Loading page", and the heading,
 * the kicker and the line under it are placeholders), so a refused address never shows the page's name while it
 * streams. Under `explain` the page's own words stand. The choice is the configuration's, never the request's.
 */
export function gatedLoading(named: LoadingNames): LoadingNames {
  return refusal === 'absent' ? { name: 'page' } : named;
}

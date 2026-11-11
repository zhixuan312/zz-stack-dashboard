import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class names, with the later of two in the same group winning: `cn('p-2', 'p-4')` is `p-4`.
 *
 * Meridian's own scales need no declaration here. `tailwind-merge` already tells a size from a role (`text-sm` beside
 * `text-ink-2` stay both), takes the later of two sizes, and groups every `shadow-*` with every other — measured against
 * the bare function before this was written, so the file has no list to keep in step with `src/styles/tokens.css`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

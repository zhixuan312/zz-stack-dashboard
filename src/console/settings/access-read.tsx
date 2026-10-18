'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Access } from '@/lib/destination-shapes';

/** The read every Access section draws from: the caller's own answer. */
type Served = { access: Access };

const AccessContext = createContext<Served | null>(null);

/**
 * The page's one read, handed to its sections. DELIBERATE: a context, not a prop on each section, so the page stacks its
 * sections one self-closing component a line, the shape `tests/routes-shape.test.tsx` holds its loading frame to, and a
 * section reads only the part it draws.
 */
export function AccessProvider({ value, children }: { value: Served; children: ReactNode }) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): Served {
  const read = useContext(AccessContext);
  if (!read) throw new Error('an Access section is drawn outside the Access page');
  return read;
}

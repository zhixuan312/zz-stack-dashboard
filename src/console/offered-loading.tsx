'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { nav } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';
import { useOffered } from '@/lib/api';

/** Each destination's name, as the rail draws it. */
const NAMES = new Map(nav.flatMap((g) => g.items).map((i) => [i.href, i.label]));

/**
 * A gated route's loading state that names its page for the person whose own rail offers it, at its own address. The
 * name is the rail's own label, already drawn for them, so the heading says nothing new, and it lands the moment this
 * state commits: from a press in the rail the route's shell is there before the gate has answered, not with the page.
 * Anyone else, any other address this boundary stands in for, the prerendered shell and a page still hydrating get
 * `gatedLoading`'s words, so under `refusal: 'absent'` a refused address names nothing. The name is looked up here, in
 * the browser, and never handed down, so no response carries it for a person who may not open the page.
 */
export function OfferedLoading({ href, kicker, children }: { href: string; kicker?: ReactNode; children: ReactNode }) {
  const here = usePathname() === href;
  const offered = useOffered(href);
  const title = NAMES.get(href);
  if (title === undefined) return <LoadingPage name="page">{children}</LoadingPage>;
  const page = { name: title.toLowerCase(), title, kicker };
  return <LoadingPage {...(here && offered ? page : gatedLoading(page))}>{children}</LoadingPage>;
}

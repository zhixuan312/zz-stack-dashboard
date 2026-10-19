'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { FeatureId } from '@/data/features';
import { consoleMutate } from '@/lib/mutate';
import { entryOf } from '@/views/workspaces';

/**
 * The pages under a rail entry that record a feature of their own, as their gate asks it: a report's page is `bug`
 * (`gate('bug')`), the superadmin's, never a view of the Bugs destination its address falls under. COUPLED: the
 * gateway's closed list of features (`services/gateway/src/console/page-view.ts`) holds each.
 */
const OWN_FEATURE: { under: string; feature: FeatureId }[] = [{ under: '/platform/bugs/', feature: 'bug' }];

/** The feature a page view at `pathname` records: its own page's, where one is listed, or the rail entry's that owns it. */
function featureOf(pathname: string): FeatureId | undefined {
  const own = OWN_FEATURE.find((o) => pathname.startsWith(o.under) && /^[^/]+\/?$/.test(pathname.slice(o.under.length)));
  return own?.feature ?? entryOf(pathname)?.feature;
}

/** Drawn for a person: not inside a route Cache Components keeps hidden in the document (React's Activity). */
function shown(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n instanceof HTMLElement && (n.hidden || n.style.display === 'none')) return false;
  }
  return true;
}

/**
 * Records one page view per committed navigation: `{ feature }` and nothing else, no address, query or title. A rerender,
 * a query-string change (a filter, a period) and a prefetch leave the pathname as it was and record nothing.
 *
 * DELIBERATE: it watches the canvas rather than posting when the pathname changes. The pathname commits with the route's
 * `loading.tsx` while the page's gate is still asking, so the view is decided only once the loading state that was in
 * view has gone: the gate's refused view records nothing (`[data-no-access]` under `refusal: 'explain'`, the missing
 * page's `[data-missing-page]` under `absent`, which an address no page answers draws too), and anything else records
 * the view. A busy panel the page draws after it arrived does not hold the decision.
 *
 * A failed post is swallowed and never retried: telemetry never stands between a person and the page.
 */
export function PageViews() {
  const pathname = usePathname();
  const visit = useRef<{ pathname: string; decided: boolean } | null>(null);

  useEffect(() => {
    // StrictMode runs this twice for one commit: the second run finds the visit decided, or picks up its wait.
    if (visit.current?.pathname === pathname && visit.current.decided) return;
    const current = visit.current?.pathname === pathname ? visit.current : { pathname, decided: false };
    visit.current = current;
    // The feature of the page's own gate where it has one, else the entry's that owns the address (`featureOf`).
    const feature = featureOf(pathname);
    if (feature === undefined) {
      current.decided = true;
      return;
    }
    const canvas = document.querySelector('main') ?? document.body;
    const loading = [...canvas.querySelectorAll('[aria-busy="true"]')].filter(shown);
    const decide = (): boolean => {
      const refused = [...canvas.querySelectorAll('[data-no-access], [data-missing-page]')].some(shown);
      if (!refused && loading.some((el) => el.isConnected && el.getAttribute('aria-busy') === 'true' && shown(el))) return false;
      current.decided = true;
      if (!refused) consoleMutate('/page-view', { feature }).catch(() => {});
      return true;
    };
    if (decide()) return;
    const watch = new MutationObserver(() => {
      if (decide()) watch.disconnect();
    });
    watch.observe(canvas, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'aria-busy'] });
    return () => watch.disconnect();
  }, [pathname]);

  return null;
}

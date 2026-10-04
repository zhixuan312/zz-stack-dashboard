'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useConsole } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';

/**
 * The gate in front of every console route.
 *
 * It redirects to `/login`; it does not render a door inside the shell. That keeps the URL honest, gives the back
 * button something sensible to do, and lets the sign-in screen be designed as a screen. `?next=` carries the page
 * they were trying to reach through the ceremony and back, so a deep link survives a sign-in.
 */
export function ConsoleGate({ children }: { children: ReactNode }) {
  const me = useConsole<Me>('/me');
  const router = useRouter();
  const pathname = usePathname();

  const unauthenticated = me.error?.status === 401;
  // Signed in, wrong door. `/me` says so with a 200 and `mayRead: false`, never a 403: it is the one console route
  // not behind `ok()`, so this component can be told who the caller is while being refused the data.
  const refused = me.error?.status === 403;
  // Anything else (a 5xx, or no answer at all) is an outage, not an answer about the caller. Counted as a refusal,
  // a gateway that could not reach its database would send a signed-in person to the sign-in screen.
  const unreachable = !!me.error && !unauthenticated && !refused;
  const notAllowed = !me.isPending && !me.error && !me.data?.mayRead;

  useEffect(() => {
    if (me.isPending) return;
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (refused || notAllowed) {
      // The gateway's own sentence first, whichever way it arrived: an error on a refused route, or `why` on the 200.
      const reason = me.error?.message ?? me.data?.why
        ?? `You are signed in as ${me.data?.email ?? 'someone'}, but the console needs a browser sign-in.`;
      router.replace(`/login?denied=1&reason=${encodeURIComponent(reason)}`);
    }
  }, [me.isPending, unauthenticated, refused, notAllowed, me.error, me.data?.email, me.data?.why, pathname, router]);

  if (unreachable) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <EmptyState
          kind="error"
          title="The console cannot reach the platform"
          action={<Button size="sm" variant="secondary" busy={me.isFetching} onClick={() => void me.refetch()}>Retry</Button>}
        >
          {me.error?.message}
        </EmptyState>
      </div>
    );
  }

  if (me.isPending || unauthenticated || refused || notAllowed) {
    // A spinner, not a flash of the sign-in screen: the check is one request, and somebody who is signed in should
    // never see a door.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-ink-3">
        <Spinner label="Checking your sign-in" />
        <p className="t-small">Checking your sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}

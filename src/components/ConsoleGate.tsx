'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Banner, Button, Spinner } from '@/components/ui';
import { useConsole } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The gate in front of every dashboard route.
 *
 * It redirects to `/login`; it does not render a door inside the app shell. That keeps the
 * URL honest, gives the back button something sensible to do, and lets the login screen be
 * designed as a screen rather than as an empty state.
 *
 * `?next=` carries the page they were trying to reach all the way through
 * the ceremony and back, so a deep link survives a sign-in.
 */
export function ConsoleGate({ children }: { children: ReactNode }) {
  const me = useConsole<Me>('/me');
  const router = useRouter();
  const pathname = usePathname();

  const unauthenticated = me.error?.status === 401;
  // Signed in, wrong door — and `/me` says so with a 200 and `mayRead: false`, never a 403:
  // it is the one console route not behind `ok()`, so this component can be told who the
  // caller is while being refused the data. A 403 from this route still lands here rather
  // than being read as an outage.
  const refused = me.error?.status === 403;
  // Anything else — a 5xx, or no response at all — is an outage, not an answer about the
  // caller. Counted as a refusal, a gateway that could not reach its database would send a
  // signed-in person to the login screen under "This view is not open to you".
  const unreachable = !!me.error && !unauthenticated && !refused;
  const notAllowed = !me.isPending && !me.error && !me.data?.mayRead;

  useEffect(() => {
    if (me.isPending) return;
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (refused || notAllowed) {
      // The gateway's own sentence first, whichever way it arrived: as an error message on a
      // refused route, or as `why` on the 200 this route answers. /me never 403s, so without
      // the second the gateway's diagnosis would be unreachable and every denial would fall
      // through to the generic line below.
      const reason = me.error?.message ?? me.data?.why
        ?? `You are signed in as ${me.data?.email ?? 'someone'}, but the console needs a browser sign-in.`;
      router.replace(`/login?denied=1&reason=${encodeURIComponent(reason)}`);
    }
  }, [me.isPending, unauthenticated, refused, notAllowed, me.error, me.data?.email, me.data?.why, pathname, router]);

  if (unreachable) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-8">
        <Banner
          variant="danger"
          className="w-full max-w-md"
          title="The console cannot reach the platform"
          description={me.error?.message}
          action={
            <Button size="sm" variant="secondary" loading={me.isFetching} onClick={() => void me.refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (me.isPending || unauthenticated || refused || notAllowed) {
    // A spinner, not a flash of the sign-in screen: the check is one request,
    // and somebody who is signed in should never see a door.
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 p-8">
        <Spinner />
        <p className="text-sm text-ink-faint">Checking your sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}

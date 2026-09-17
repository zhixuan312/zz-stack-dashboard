'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Banner, Button, Spinner } from '@/components/ui';
import { useConsole, type Me } from '@/lib/api';

/**
 * The gate in front of every dashboard route.
 *
 * IT REDIRECTS; IT DOES NOT RENDER A DOOR. Signing in used to happen inside the
 * app shell, so an anonymous visitor saw the full navigation — nine links to
 * pages they could not open — with a sign-in box floating in the content area,
 * and a rail that had to invent "Signed in · You: —" to fill itself. That reads
 * as a dashboard that failed to load rather than as a login.
 *
 * Sending them to `/login` instead makes the URL honest, gives the back button
 * something sensible to do, and lets the login screen be designed as a screen
 * rather than as an empty state.
 *
 * `?next=` carries the page they were trying to reach all the way through
 * the ceremony and back, so a deep link survives a sign-in.
 */
export function ConsoleGate({ children }: { children: ReactNode }) {
  const me = useConsole<Me>('/me');
  const router = useRouter();
  const pathname = usePathname();

  const unauthenticated = me.error?.status === 401;
  // 403, or a 200 that says this caller may not read: signed in, wrong door.
  const refused = me.error?.status === 403;
  // Anything else — a 5xx, or no response at all — is an OUTAGE, not an answer about the
  // caller. It used to count as a refusal, so a gateway that could not reach its database
  // sent a signed-in person to the login screen under "This view is not open to you".
  const unreachable = !!me.error && !unauthenticated && !refused;
  const notAllowed = !me.isPending && !me.error && !me.data?.mayRead;

  useEffect(() => {
    if (me.isPending) return;
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (refused || notAllowed) {
      // The gateway names its refusals — "the console needs a browser sign-in —
      // x@y authenticated by pat" — and that sentence is the whole diagnosis.
      // Carrying it to the login screen is what stops somebody checking a
      // password that was already correct.
      const reason = me.error?.message
        ?? `You are signed in as ${me.data?.email ?? 'someone'}, but the console needs a browser sign-in.`;
      router.replace(`/login?denied=1&reason=${encodeURIComponent(reason)}`);
    }
  }, [me.isPending, unauthenticated, refused, notAllowed, me.error, me.data?.email, pathname, router]);

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
    // and somebody who IS signed in should never see a door.
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 p-8">
        <Spinner />
        <p className="text-sm text-ink-faint">Checking your sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}

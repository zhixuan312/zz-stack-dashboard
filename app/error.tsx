'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Standalone } from '@/console/standalone';

/**
 * A screen that threw, for every route the console's own boundary does not cover: sign-in, enrolment, signed out, an
 * address with no page behind it, and the console's frame itself.
 *
 * `(dash)/error.tsx` sits inside the shell and keeps the rail, because a page that failed still has somewhere to go.
 * This one is above it, so what reaches it is a failure the shell is part of: a rail drawn from a layout that threw is
 * the thing that cannot be trusted, and the standalone screen needs nothing from that layout to stand up.
 *
 * Same two facts as that boundary, with the cause said no wider than it is known. A digest is a server-thrown error's
 * reference: Next attaches one to anything a Server Component threw, and it is what matches the throw in the server's
 * log, so it is what a report quotes. No digest means the page threw while it drew in this browser, and the console has
 * it.
 */
export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const server = error.digest !== undefined;
  return (
    <Standalone
      pose="error"
      kicker={server ? 'The server could not draw this page' : 'This screen failed to render'}
      sentence={server ? 'Nothing here was read.' : 'Something went wrong while it was drawn.'}
      lead={server
        ? `Retrying usually works. Reference ${error.digest}; quote it if you report this.`
        : 'The error was logged to the browser console. Retrying usually works.'}
    >
      {/* No rail on this screen, so the way on is here. Retry first: it asks the server again rather than redrawing
          what failed. */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" icon={<RotateCw />} onClick={retry}>Retry</Button>
        <Button asChild variant="secondary" size="lg"><Link href="/">Back to the console</Link></Button>
      </div>
    </Standalone>
  );
}

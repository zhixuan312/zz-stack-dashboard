'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/console/brand';

/**
 * A screen that threw, for every route the console's own boundary does not cover: sign-in, enrolment, signed out, an
 * address with no page behind it, and the console's frame itself.
 *
 * `(dash)/error.tsx` sits inside the shell and keeps the rail, because a page that failed still has somewhere to go.
 * This one is above it, so what reaches it is a failure the shell is part of: a rail drawn from a layout that threw is
 * the thing that cannot be trusted, and this screen needs nothing from that layout to stand up.
 *
 * DELIBERATE: it draws the sentence, the mark and the way on itself, and does NOT reuse the standalone screen that
 * /login, /enrol and the 404 are built on. A boundary above every route puts whatever it imports into every route's
 * first load, and that screen brings `AppMark` and the logo helper with it: measured on 2026-10-16 it took
 * `/activity`, `/knowledge`, `/people` and `/settings` from about 806 KiB to 823-827 against a 820 KiB cap, for a
 * screen almost nobody sees. The mascot below costs nothing here — `brand.tsx` is already in the root chunk, mounted
 * by `ConsoleProviders` in `app/layout.tsx` for every route — so the product's face is kept and the rest is not.
 *
 * A digest is a server-thrown error's reference: Next attaches one to anything a Server Component threw, and it is
 * what matches the throw in the server's log, so it is what a report quotes. No digest means the page threw while it
 * drew in this browser, and the console has it.
 */
export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const server = error.digest !== undefined;
  return (
    <main className="grid min-h-dvh place-items-center px-(--gutter) py-16">
      <div className="w-full max-w-lg text-center">
        <Mascot pose="error" className="mx-auto w-fit" />
        <p className="t-kicker mt-8">{server ? 'The server could not draw this page' : 'This screen failed to render'}</p>
        <h1 className="t-display mt-3 text-balance">{server ? 'Nothing here was read.' : 'Something went wrong while it was drawn.'}</h1>
        <p className="t-small mt-4 text-pretty text-ink-2">
          {server
            ? `Retrying usually works. Reference ${error.digest}; quote it if you report this.`
            : 'The error was logged to the browser console. Retrying usually works.'}
        </p>
        {/* No rail on this screen, so the way on is here. Retry first: it asks the server again rather than redrawing
            what failed. */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" icon={<RotateCw />} onClick={retry}>Retry</Button>
          <Button asChild variant="secondary" size="lg"><Link href="/">Back to the console</Link></Button>
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { AppMark } from '@/components/AppMark';

/**
 * The ROOT 404 — and until the brand adoption it did not exist, which meant the most
 * likely page a stranger ever sees was Next's built-in default: a BLACK page with
 * "404 | This page could not be found." in the system font. On a product with no dark
 * mode that is not merely unstyled, it is a different product.
 *
 * `app/(dash)/not-found.tsx` was already there and is not this. That one catches
 * `notFound()` raised INSIDE the authenticated shell — a team or node that does not
 * exist — and renders inside the rail, which is right, because the reader is signed in
 * and going somewhere else next. A URL that matches no route at all never reaches the
 * group, so it fell through to the framework. Two 404s, two situations, and the one
 * nobody had written was the one served to everybody.
 *
 * Outside every group on purpose, like `signed-out`: an unknown URL must not render the
 * authenticated shell, and must not ask an unauthenticated stranger to sign in to see a
 * page that is not there.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <AppMark withWordmark />
        <Image
          src="/assets/brand/state-notfound.png"
          alt=""
          width={128}
          height={160}
          className="h-32 w-auto object-contain"
        />
        <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">No such page</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          Nothing lives at this address. The link may be out of date, or the record it
          pointed at may have been removed.
        </p>
        <Link
          href="/"
          className="rounded-[var(--r)] bg-accent px-3.5 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-deep"
        >
          Back to the console
        </Link>
      </div>
    </main>
  );
}

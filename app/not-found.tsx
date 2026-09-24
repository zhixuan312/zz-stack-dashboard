import Link from 'next/link';
import Image from 'next/image';
import { AppMark } from '@/components/AppMark';

/**
 * The root 404, for a URL that matches no route at all. Without it Next serves its own
 * built-in default, a black page in the system font.
 *
 * COUPLED: `app/(dash)/not-found.tsx` is the other one and is not this. It catches
 * `notFound()` raised inside the authenticated shell — a team or node that does not exist —
 * and renders inside the rail. A URL matching no route never reaches that group.
 *
 * DELIBERATE: outside every group, like `signed-out`. An unknown URL must not render the
 * authenticated shell, and must not ask an unauthenticated stranger to sign in to see a page
 * that is not there.
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

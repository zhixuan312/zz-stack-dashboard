import Link from 'next/link';
import { Standalone } from '@/components/patterns/standalone';
import { buttonVariants } from '@/components/ui/button';

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
    <Standalone
      illustration={{ src: '/assets/brand/state-notfound.png', width: 128, height: 160 }}
      eyebrow="404"
      title={<>No such page<span className="text-accent">.</span></>}
    >
      <p className="t-lead max-w-[44ch]">
        Nothing lives at this address. The link may be out of date, or the record it pointed at
        may have been removed.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        Back to the console
      </Link>
    </Standalone>
  );
}

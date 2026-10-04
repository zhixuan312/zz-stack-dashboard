import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Standalone } from '@/console/standalone';

/** An address outside the console's routes. Inside them, the console's own not-found keeps the rail. */
export default function NotFound() {
  return (
    <Standalone pose="notfound" kicker="404" sentence="No such page." lead="Nothing lives at this address. The link may be out of date, or the record it pointed at may have been removed.">
      <Button asChild variant="primary" size="lg" className="mt-8"><Link href="/">Back to the console</Link></Button>
    </Standalone>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Standalone } from '@/console/standalone';

/** An address no route answers: no console page behind it, so no rail around it — this button is the way on. */
export default function NotFound() {
  return (
    <Standalone pose="notfound" kicker="404" sentence="No such page." lead="Nothing lives at this address. The link may be out of date, or the record it pointed at may have been removed.">
      <Button asChild variant="primary" size="lg" className="mt-8"><Link href="/">Back to the console</Link></Button>
    </Standalone>
  );
}

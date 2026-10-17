import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Standalone } from '@/console/standalone';
import { MISSING_METADATA, NOT_FOUND } from '@/views/missing';

export const metadata = MISSING_METADATA;

/**
 * A `notFound()` thrown inside a page: no rail around it, so this button is the way on. An address under the shell that
 * no page answers draws the shell's missing page instead (`app/(dash)/[...missing]/page.tsx`); both say the same words
 * (`NOT_FOUND`) and carry the same title, which a refused address carries too.
 */
export default function NotFound() {
  return (
    <Standalone pose="notfound" kicker={NOT_FOUND.kicker} sentence={NOT_FOUND.sentence} lead={NOT_FOUND.lead}>
      <Button asChild variant="primary" size="lg" className="mt-8"><Link href={NOT_FOUND.way.href}>{NOT_FOUND.way.label}</Link></Button>
    </Standalone>
  );
}

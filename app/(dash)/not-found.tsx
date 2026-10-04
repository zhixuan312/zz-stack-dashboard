import Link from 'next/link';
import { PageFrame } from '@/components/base/shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/** A console address that leads nowhere: the rail stays, so the way on is one press away. */
export default function NotFound() {
  return (
    <PageFrame title="Not found" kicker="404">
      <EmptyState kind="filtered" title="No such page" className="py-16" action={<Button asChild variant="primary"><Link href="/">Back to the overview</Link></Button>}>
        The link may be out of date, or the record may have been removed.
      </EmptyState>
    </PageFrame>
  );
}

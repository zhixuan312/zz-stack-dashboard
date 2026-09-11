import Link from 'next/link';
import { Compass } from 'lucide-react';
import { EmptyState, PageFrame, buttonVariants } from '@/components/ui';

export default function NotFound() {
  return (
    <PageFrame title="Not found" width="full" fill>
      <EmptyState
        icon={<Compass />}
        title="No such page"
        description="The link may be out of date, or the record may have been removed."
        // `Button` renders a real <button>; a navigation target must be an
        // anchor, so the link borrows the button's classes instead of being
        // wrapped in one.
        action={
          <Link href="/" className={buttonVariants()}>
            Back to overview
          </Link>
        }
      />
    </PageFrame>
  );
}

'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button, EmptyState, PageFrame } from '@/components/ui';

/**
 * The route-level error boundary. It shows the digest rather than the message:
 * a production build replaces server error messages with a digest anyway, and
 * showing a stale local message trains people to ignore what is on screen.
 */
export default function DashError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageFrame title="Something went wrong" width="full" fill>
      <EmptyState
        icon={<TriangleAlert />}
        title="This page failed to render"
        description={
          error.digest
            ? `Reference ${error.digest} — quote it if you report this.`
            : 'The error was logged to the console.'
        }
        action={<Button onClick={reset}>Try again</Button>}
      />
    </PageFrame>
  );
}

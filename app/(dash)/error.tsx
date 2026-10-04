'use client';

import { useEffect } from 'react';
import { PageFrame } from '@/components/base/shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/** A page that threw while rendering: what failed, the reference to quote, and Retry. The rail stays. */
export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageFrame title="Something went wrong">
      <EmptyState kind="error" title="This page failed to render" className="py-16" action={<Button variant="primary" onClick={reset}>Try again</Button>}>
        {error.digest ? `Reference ${error.digest}; quote it if you report this.` : 'The error was logged to the browser console.'}
      </EmptyState>
    </PageFrame>
  );
}

'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { PageFrame } from '@/components/base/shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * A page that threw, in place of the page and inside the shell, so the rail stays: what failed, the reference to quote,
 * and Retry, which asks the server again rather than redrawing what failed.
 *
 * An error from the server carries a digest: Next attaches one to anything a Server Component threw, and it is what
 * matches the throw in the server's log, so it is what a report quotes. It does NOT mean the console could not reach
 * the platform — a page that threw for its own reasons carries one too, and saying otherwise blames the platform for
 * the page's own fault. One without a digest was thrown while the page drew in this browser, and the console has it.
 */
export default function DashError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const server = error.digest !== undefined;
  return (
    <PageFrame title={server ? 'The server could not draw this page' : 'This page failed to render'}>
      <EmptyState
        kind="error"
        title={server ? 'Nothing on this page was read' : 'Something went wrong while it was drawn'}
        className="py-16"
        action={<Button variant="primary" icon={<RotateCw />} onClick={retry}>Retry</Button>}
      >
        {server ? `Retrying usually works. Reference ${error.digest}; quote it if you report this.` : 'The error was logged to the browser console.'}
      </EmptyState>
    </PageFrame>
  );
}

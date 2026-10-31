'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

/** Retry for a read the server made: it asks the server for the page again, busy until the answer is drawn. */
export function RetryRead({ size }: { size?: 'sm' }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <Button variant={size ? undefined : 'primary'} size={size} icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>
      Retry
    </Button>
  );
}

/** A page whose server read failed or did not answer: what did not load, why, and Retry. */
export function ServerTrouble({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <Card>
      <EmptyState kind="error" title={title} className="py-16" action={<RetryRead />}>
        {detail}
      </EmptyState>
    </Card>
  );
}

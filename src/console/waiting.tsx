'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FlowPosition, waitingGates } from '@/console/initiative';
import { Panel } from '@/console/panel';
import { When } from '@/console/when';
import { useConsole } from '@/lib/api';
import type { Initiative } from '@/lib/api-shapes';

const SHOWN = 4;

/**
 * The next step: every gate document written and waiting for a person's approval, newest first, each opening the
 * initiative where it is signed. The one panel on the Overview that asks something of the reader.
 */
export function WaitingPanel() {
  const q = useConsole<{ initiatives: Initiative[] }>('/initiatives');
  const waiting = waitingGates(q.data?.initiatives ?? []);
  return (
    <Panel
      title="Waiting on you"
      description={q.data ? (waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'gate needs' : 'gates need'} a person's approval` : 'Nothing needs a signature') : 'Gates that need a signature'}
      flush
    >
      {q.isPending ? (
        <div className="flex flex-col gap-3 p-(--card-pad)">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !waiting.length ? (
        <EmptyState layout="inline" title="Every written gate is signed" className="px-(--card-pad) py-4">The next one appears here the moment its document is written.</EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {waiting.slice(0, SHOWN).map((w) => (
              <li key={w.id}>
                <Link href={`/initiatives/${w.initiative.team}/${w.initiative.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 px-(--card-pad) py-3.5 transition-colors hover:bg-fill-hover">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{w.gate[0].toUpperCase()}{w.gate.slice(1)} waits for approval</span>
                    <span className="t-caption block truncate">{w.initiative.team} · {w.initiative.slug}</span>
                  </span>
                  <span className="t-caption justify-self-end whitespace-nowrap"><When at={w.initiative.updated} /></span>
                  <span className="col-span-2 max-sm:hidden"><FlowPosition at={w.initiative.at} of={w.initiative.of} name={w.initiative.stage} /></span>
                </Link>
              </li>
            ))}
          </ul>
          {waiting.length > SHOWN ? (
            <Link href="/initiatives?show=waiting" className="flex items-center gap-1.5 border-t border-line px-(--card-pad) py-3 text-sm font-medium text-ink hover:bg-fill-hover">
              All {waiting.length} waiting <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </>
      )}
    </Panel>
  );
}

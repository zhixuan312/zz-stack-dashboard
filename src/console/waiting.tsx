'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { plural } from '@/console/words';
import { FlowPosition, useWaitingGates } from '@/console/initiative';
import { Panel } from '@/console/panel';
import { When } from '@/console/when';

const SHOWN = 4;

/**
 * The next step: every gate document written and waiting for a person's approval, newest first, each opening the
 * initiative where it is signed. The one panel on the Overview that asks something of the reader.
 */
export function WaitingPanel() {
  const q = useWaitingGates();
  const waiting = q.data?.waiting ?? [];
  return (
    <Panel
      title="Waiting on you"
      description={q.data ? (waiting.length ? `${waiting.length} ${plural(waiting.length, 'gate needs', 'gates need')} a person's approval` : 'Nothing needs a signature') : 'Gates that need a signature'}
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
                <Link href={`/initiatives/${w.team}/${w.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 px-(--card-pad) py-3.5 transition-colors hover:bg-fill-hover">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{w.gate[0].toUpperCase()}{w.gate.slice(1)} waits for approval</span>
                    {/* Wraps, and carries the whole value. `w.slug` is an initiative slug: the date is at the FRONT
                        and the distinguishing name at the TAIL — `2026-09-22-payout-schedule` — so an ellipsis eats
                        exactly the part that tells two of that day's initiatives apart, in the one panel whose whole
                        job is to say which one is waiting. `initiative.tsx` decided this for the same value on its own
                        page and the decision never reached here. */}
                    <span className="t-caption block whitespace-normal [overflow-wrap:anywhere]" title={`${w.team} · ${w.slug}`}>{w.team} · {w.slug}</span>
                  </span>
                  <span className="t-caption justify-self-end whitespace-nowrap"><When at={w.updated} /></span>
                  <span className="col-span-2 max-sm:hidden"><FlowPosition at={w.at} of={w.of} name={w.stage} /></span>
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

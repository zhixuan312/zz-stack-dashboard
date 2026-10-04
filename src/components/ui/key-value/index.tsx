import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type KeyValueItem = { label: ReactNode; value: ReactNode; action?: ReactNode; mono?: boolean; /** A value read in full (a path, an address, a list of links): it wraps instead of ending in an ellipsis. */ wrap?: boolean };

/**
 * Facts about one thing, label and value per row, divided by hairlines: a request's method and status, a key's
 * scope and last use. Labels are quiet, values carry the reading; numbers are tabular so a column lines up.
 */
export function KeyValue({ items, columns = 1, className }: { items: KeyValueItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cn('grid min-w-0 grid-cols-1', columns === 2 && 'sm:grid-cols-2 sm:gap-x-8', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex min-h-11 min-w-0 items-center gap-4 border-b border-line py-2.5 last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0">
          <dt className="w-32 shrink-0 text-sm text-ink-3">{it.label}</dt>
          <dd className={cn('t-num min-w-0 flex-1 text-sm text-ink', it.wrap ? '[overflow-wrap:anywhere]' : 'truncate', it.mono && 'font-mono text-xs')}>{it.value}</dd>
          {it.action ? <div className="-my-1 shrink-0">{it.action}</div> : null}
        </div>
      ))}
    </dl>
  );
}

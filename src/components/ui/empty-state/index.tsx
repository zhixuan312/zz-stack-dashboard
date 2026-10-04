import { Inbox, SearchX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type EmptyKind = 'first-run' | 'filtered' | 'error';

const KIND: Record<EmptyKind, { disc: string; Icon: typeof Inbox }> = {
  'first-run': { disc: 'bg-accent-tint text-accent-ink', Icon: Inbox },
  filtered: { disc: 'bg-fill-track text-ink-3', Icon: SearchX },
  error: { disc: 'bg-critical-tint text-critical-ink', Icon: TriangleAlert },
};

/**
 * What a view shows when it has nothing to show, and why: never created (first run), filtered to nothing, or failed
 * to load. Each says what is empty and offers the one action that changes it, so an empty screen is a next step, not
 * a dead end. Centred fills a card or a page; inline sits in a row where a list would be.
 */
export function EmptyState({
  kind = 'first-run',
  title,
  children,
  action,
  icon,
  layout = 'centered',
  className,
}: {
  kind?: EmptyKind;
  /** What is empty, said plainly: "No requests match these filters". */
  title: ReactNode;
  /** One sentence: what to do, or what happens next. */
  children?: ReactNode;
  /** The one action: Create key, Clear filters, Retry. */
  action?: ReactNode;
  icon?: ReactNode;
  layout?: 'centered' | 'inline';
  className?: string;
}) {
  const k = KIND[kind];
  const disc = (
    <span aria-hidden className={cn('relative grid shrink-0 place-items-center rounded-full', layout === 'centered' ? 'size-12 [&_svg]:size-5' : 'size-9 [&_svg]:size-4', k.disc)}>
      {layout === 'centered' ? (
        <>
          <span className="absolute -inset-3 rounded-full border border-line" />
          <span className="absolute -inset-6 rounded-full border border-line opacity-50" />
        </>
      ) : null}
      {icon ?? <k.Icon strokeWidth={1.75} />}
    </span>
  );
  if (layout === 'inline')
    return (
      <div role={kind === 'error' ? 'alert' : undefined} className={cn('flex items-center gap-3.5 py-2', className)}>
        {disc}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{title}</p>
          {children ? <p className="t-caption mt-0.5">{children}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  return (
    <div role={kind === 'error' ? 'alert' : undefined} className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {disc}
      <p className="t-card mt-8 max-w-sm text-balance">{title}</p>
      {children ? <p className="t-small mt-1.5 max-w-sm text-pretty text-ink-2">{children}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

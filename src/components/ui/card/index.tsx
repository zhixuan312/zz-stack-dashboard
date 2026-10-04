import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The one container for a group of related content. A card sits one step above the canvas on `surface`, outlined by a
 * hairline with a whisper of shadow; on dark, a lit top edge does the shadow's work.
 */
export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col rounded-lg border border-line bg-surface shadow-card',
        'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-highlight-top',
        interactive && 'edge-lit edge-hover transition-[box-shadow,border-color,transform] duration-(--dur-enter) hover:border-line-strong hover:shadow-halo',
        className,
      )}
      {...rest}
    />
  );
}

/** A card's head: title and an optional line under it on the left, actions on the right. */
export function CardHeader({
  title,
  description,
  actions,
  className,
  divided,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** A hairline under the head, when the body is a table or a list that runs edge to edge. */
  divided?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-4 px-(--card-pad) pt-[calc(var(--card-pad)-4px)]', divided ? 'border-b border-line pb-3.5' : 'pb-1', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="t-card truncate">{title}</h2>
        {description ? <p className="t-caption mt-1 text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="-my-1 flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, flush, ...rest }: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn('min-w-0 flex-1', flush ? '' : 'px-(--card-pad) pt-3 pb-(--card-pad)', className)} {...rest} />;
}

/** A quiet band at the foot of a card: a link to the full view, a caption. */
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-line px-(--card-pad) py-3 text-sm text-ink-2', className)} {...rest} />;
}

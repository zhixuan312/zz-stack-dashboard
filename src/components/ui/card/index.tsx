import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/**
 * The one container for a group of related content. A card sits one step above the canvas on `surface`, outlined by a
 * hairline with a whisper of shadow; on dark, a lit top edge does the shadow's work.
 */
export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        // The look is one class in base.css (`.card`): border, fill, radius, shadow, the lit top edge, and the clip a
        // flush first child needs. Written out as utilities it cost every card about 250 bytes of HTML and payload.
        'card',
        interactive && 'edge-lit edge-hover transition-[box-shadow,border-color,transform] duration-(--dur-enter) hover:border-line-strong hover:shadow-raise',
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
  wrap,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** A hairline under the head, when the body is a table or a list that runs edge to edge. */
  divided?: boolean;
  /** Let the title wrap instead of truncating. For a title that is the point of the card — an objective, a record's
   *  name — rather than a label in a list, where one line and an ellipsis is the right answer. */
  wrap?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-4 px-(--card-pad) pt-[calc(var(--card-pad)-4px)]', divided ? 'border-b border-line pb-3.5' : 'pb-1', className)}>
      <div className="min-w-0 flex-1">
        <h2 className={cn('t-card', wrap ? 'text-pretty' : 'truncate')}>{title}</h2>
        {description ? <p className="t-caption mt-1 text-pretty">{description}</p> : null}
      </div>
      {actions ? <div className="-my-1 flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, flush, ...rest }: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      // `data-flush` is how the Card above clips its own rounded corner when this is its first child. See `Card`.
      data-flush={flush ? '' : undefined}
      className={cn(
        'min-w-0 flex-1',
        flush
          // A table as the body's first child runs edge to edge, so the body clips it and drops the header's own top
          // border. Without the clip the header's `surface-sunk` fill squares off the card's rounded top corners, and
          // without the drop its `border-y` draws a second line directly under the card's own edge — most visible in
          // dark, where both lines are the same colour. DataTable's own section already did this; a plain Card with a
          // Table did not. Only the FIRST table loses its top border: a second one is separated from what is above it.
          ? 'has-[>div:first-child>table]:overflow-hidden [&>div:first-child>table>thead>tr>th]:border-t-0'
          : 'px-(--card-pad) pt-3 pb-(--card-pad)',
        className,
      )}
      {...rest}
    />
  );
}

/** A quiet band at the foot of a card: a link to the full view, a caption. */
export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-line px-(--card-pad) py-3 text-sm text-ink-2', className)} {...rest} />;
}

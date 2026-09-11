import { Hexagon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { APP_NAME } from '@/nav';

/**
 * The product mark. Swap the icon for your own SVG and this is the only file
 * that changes — the sidebar, the auth screen and any empty state all read the
 * mark from here rather than each drawing a logo.
 */
export function AppMark({
  withWordmark = false,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-[var(--r-sm)] bg-accent-tint"
      >
        <Hexagon className="size-4 text-accent-deep" strokeWidth={2.25} />
      </span>
      {withWordmark ? (
        <span className="text-sm font-semibold tracking-[-0.014em] text-ink">
          {APP_NAME}
        </span>
      ) : (
        <span className="sr-only">{APP_NAME}</span>
      )}
    </span>
  );
}

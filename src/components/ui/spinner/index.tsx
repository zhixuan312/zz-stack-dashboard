import { cn } from '@/lib/cn';

const SIZE = { sm: 'size-3.5 border-[1.5px]', md: 'size-4 border-2', lg: 'size-5 border-2' } as const;

/**
 * Busy, for a discrete action: a ring in the current text colour that turns once every 0.8s. Anything that occupies
 * layout while it loads gets a Skeleton instead; never both in one place.
 */
export function Spinner({ size = 'md', label = 'Loading', className }: { size?: keyof typeof SIZE; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex shrink-0', className)}>
      <span aria-hidden className={cn('spin block rounded-full border-current border-r-transparent opacity-80', SIZE[size])} />
    </span>
  );
}

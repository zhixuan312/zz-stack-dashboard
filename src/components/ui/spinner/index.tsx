import { cn } from '../../../lib/cn';

// The three steps are the icon scale's (14, 16, 18px), so a spinner stands in for an icon and nothing shifts.
const SIZE = { sm: 'size-3.5 border-[1.5px]', md: 'size-4 border-2', lg: 'size-[18px] border-2' } as const;

/**
 * Busy, for a discrete action: a ring in the current text colour that turns once every 0.8s. Anything that occupies
 * layout while it loads gets a Skeleton instead; never both in one place.
 */
export function Spinner({ size = 'md', label = 'Loading', className }: { size?: keyof typeof SIZE; label?: string | null; className?: string }) {
  const ring = <span aria-hidden className={cn('spin block rounded-full border-current border-r-transparent opacity-80', SIZE[size])} />;
  // `null` is for a spinner inside a control that already says it is busy (`aria-busy`, a Button's `busy`): a second
  // announcement there is noise, so it draws and says nothing.
  if (label === null) return <span aria-hidden className={cn('inline-flex shrink-0', className)}>{ring}</span>;
  return <span role="status" aria-label={label} className={cn('inline-flex shrink-0', className)}>{ring}</span>;
}

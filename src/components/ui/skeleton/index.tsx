import { cn } from '@/lib/cn';

/** A placeholder in the shape of what is loading. Built from the same rows and cards as the real page, so nothing jumps. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('shimmer block h-3 rounded-xs', className)} />;
}

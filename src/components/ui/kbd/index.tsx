import { cn } from '@/lib/cn';

/** A key or a chord, as the keyboard labels it. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line-strong bg-surface px-1 font-sans text-2xs font-medium text-ink-3 shadow-control',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

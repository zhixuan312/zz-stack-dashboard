import { cn } from '@/lib/cn';

/**
 * ZZ's mark: an accent tile holding a capital and a small Z, the second sitting on the first's baseline, the sleeping
 * "Zz" the brand is named for. Keeps the size steps (20, 24, 28, 32) and the decorative alt: the product name beside
 * it is the accessible name. `app/icon.ts` draws the same paths for the browser tab.
 */
export function AppMark({ size = 24, className }: { size?: 20 | 24 | 28 | 32; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={cn('shrink-0', className)}>
      <rect width="24" height="24" rx="6.5" fill="var(--accent)" />
      <rect width="24" height="24" rx="6.5" fill="url(#am-sheen)" />
      <path d="M5.5 6.5h7.5l-7.5 11h7.5" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 12h4l-4 5.5h4" fill="none" stroke="var(--on-accent)" strokeOpacity=".7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="am-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--on-accent)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--on-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

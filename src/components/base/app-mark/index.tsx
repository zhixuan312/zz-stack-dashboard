import Image from 'next/image';
import { cn } from '@/lib/cn';

/**
 * ZZ's mark inside the application: the Zz wordmark with its sparkle, from the brand kit, never redrawn. One of three
 * ZZ marks and not interchangeable with the others: the flat single Z is the tab icon (app/icon.png), because two
 * letters at 16px is mush, and the mascot squircle is the home-screen icon (app/apple-icon.png). The image is
 * decorative: the product name beside it is the accessible name. Built by scripts/build-brand-assets.py.
 */
export function AppMark({ size = 24, className }: { size?: 20 | 24 | 28 | 32; className?: string }) {
  return <Image src="/assets/brand/wordmark.png" alt="" width={size} height={size} priority className={cn('shrink-0 object-contain', className)} />;
}

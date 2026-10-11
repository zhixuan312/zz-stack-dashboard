import Image from 'next/image';
import { app } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { logoSource } from '../../../lib/logo';

const cfg: { name: string; logo?: string } = app;

/**
 * The product's mark: `app.logo` when it is a root-relative local SVG path, otherwise ZZ's wordmark.
 *
 * ZZ's mark is the Zz wordmark with its sparkle, from the brand kit, never redrawn. One of three ZZ marks and not
 * interchangeable with the others: the flat single Z is the tab icon (`app/icon.png`), because two letters at 16px is
 * mush, and the mascot squircle is the home-screen icon (`app/apple-icon.png`). The image is decorative: the product
 * name beside it is the accessible name, so pass `label` only when the mark stands alone.
 *
 * Built by `scripts/build-brand-assets.py`.
 */
export function AppMark({ size = 24, className, label }: { size?: 20 | 24 | 28 | 32; className?: string; label?: string }) {
  const logo = logoSource(cfg.logo);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a local SVG from public/ at four fixed sizes; next/image adds nothing for it.
      <img src={logo} width={size} height={size} alt={label ?? ''} className={cn('shrink-0', className)} />
    );
  }
  return <Image src="/assets/brand/wordmark.png" alt={label ?? ''} width={size} height={size} priority className={cn('shrink-0 object-contain', className)} />;
}

'use client';

import { useId } from 'react';
import { app } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { logoSource } from '../../../lib/logo';

const cfg: { name: string; logo?: string } = app;

/**
 * The product's mark: `app.logo` when it is a root-relative local SVG path, otherwise the template's neutral mark, an
 * accent tile holding a meridian, a trend crossed by the line that reads it. Beside the app name it is decorative (no
 * `label`); on its own, pass the app name as `label`. Sizes are 20, 24, 28 and 32.
 */
export function AppMark({ size = 24, className, label }: { size?: 20 | 24 | 28 | 32; className?: string; label?: string }) {
  // The sheen is one gradient per mark, and a page holds more than one mark: the Atlas draws one in the phone's bar and
  // one in the shelf, and both are mounted at every width, so a fixed id was a duplicate on every one of its pages and
  // `url(#am-sheen)` named two elements. Read before the logo branch, since a hook cannot come after an early return.
  // The id is cut to letters, digits, `-` and `_`: React's own ids carry punctuation that a `url(#…)` in a fill would
  // have to escape.
  const sheen = `am-sheen-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const logo = logoSource(cfg.logo);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a local SVG from public/ at four fixed sizes; next/image adds nothing for it.
      <img src={logo} width={size} height={size} alt={label ?? ''} className={cn('shrink-0', className)} />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} className={cn('shrink-0', className)}>
      <rect width="24" height="24" rx="6.5" fill="var(--accent)" />
      <rect width="24" height="24" rx="6.5" fill={`url(#${sheen})`} />
      <path d="M4.5 15.5 8.2 11.6l3.1 2.4 4.2-5.6 4 3.6" fill="none" stroke="var(--on-accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 4.6v14.8" stroke="var(--on-accent)" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="15.5" cy="8.4" r="1.9" fill="var(--on-accent)" />
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--on-accent)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--on-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

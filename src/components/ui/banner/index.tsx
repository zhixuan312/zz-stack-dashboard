'use client';

import { AlertTriangle, CheckCircle2, Info, Sparkles, X, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BannerTone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';

const TONE: Record<BannerTone, { box: string; icon: string; title: string; Icon: LucideIcon }> = {
  neutral: { box: 'bg-surface-sunk border-line', icon: 'text-ink-3', title: 'text-ink', Icon: Info },
  accent: { box: 'bg-accent-tint border-accent-line', icon: 'text-accent-ink', title: 'text-accent-ink', Icon: Sparkles },
  positive: { box: 'bg-positive-tint border-positive/25', icon: 'text-positive-ink', title: 'text-positive-ink', Icon: CheckCircle2 },
  warning: { box: 'bg-warning-tint border-warning/30', icon: 'text-warning-ink', title: 'text-warning-ink', Icon: AlertTriangle },
  critical: { box: 'bg-critical-tint border-critical/25', icon: 'text-critical-ink', title: 'text-critical-ink', Icon: XCircle },
};

/**
 * A message about the page or the card it sits in, that stays until it is resolved or dismissed: an incident in
 * progress, a key about to expire, a limit reached. Its tone is said three ways at once, by the icon, the title and
 * the tint, so it never depends on colour alone.
 */
export function Banner({
  tone = 'neutral',
  title,
  children,
  icon,
  action,
  onDismiss,
  className,
}: {
  tone?: BannerTone;
  /** What is happening, in one line: "Elevated latency in eu-west-1". */
  title: ReactNode;
  /** What it means for the reader, and what to do; one or two sentences. */
  children?: ReactNode;
  /** Replaces the tone's icon. */
  icon?: ReactNode;
  /** One button or link: "View incident". */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div role={tone === 'critical' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg border px-4 py-3.5', t.box, className)}>
      <span className={cn('mt-px shrink-0 [&_svg]:size-4', t.icon)}>{icon ?? <t.Icon strokeWidth={2} />}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-x-6 gap-y-2.5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', t.title)}>{title}</p>
          {children ? <div className="t-small mt-0.5 text-ink-2">{children}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2 sm:-my-1">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="press hit -my-0.5 -mr-1.5 grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

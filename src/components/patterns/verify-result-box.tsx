import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

/**
 * The "did the live check pass" result box — one styling for every settings
 * screen that verifies a connection, so they all read identically. A tinted
 * bordered box with a verified / not-verified badge (plus an optional extra
 * badge, e.g. "applied"), then children: the detail line and any check ladder.
 *
 * `FormPanel`'s `validate` prop renders this; you rarely place it yourself.
 */
export function VerifyResultBox({
  ok,
  extra,
  children,
}: {
  ok: boolean;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-[var(--r-md)] border p-3',
        ok ? 'border-[var(--sage)] bg-sage-tint/30' : 'border-rose/40 bg-rose-tint/20',
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant={ok ? 'sage' : 'rose'} size="sm">
          {ok ? 'verified' : 'not verified'}
        </Badge>
        {extra}
      </div>
      {children}
    </div>
  );
}

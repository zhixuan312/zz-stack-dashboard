'use client';

import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * A value to take elsewhere: an ID, an endpoint, a secret. Read-only, in mono, with a Copy button that turns into a
 * check for 1.6s. A secret is masked until Reveal; Copy still copies the real value, so revealing is never required.
 */
export function CopyField({
  value,
  label,
  secret,
  className,
}: {
  value: string;
  /** The accessible name: "API key", "Request ID". */
  label: string;
  /** Mask the value and offer Reveal. */
  secret?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  // A masked secret keeps its prefix up to the last underscore (zzm_live_), so live and test still read apart, and
  // always shows eight dots, so the mask says nothing about the length.
  const display = shown ? value : value.slice(0, value.lastIndexOf('_') + 1) + '•'.repeat(8) + value.slice(-4);
  return (
    <div className={cn('flex h-(--control-md) min-w-0 items-center rounded-md border border-line-strong bg-surface-sunk pl-3 shadow-control', className)}>
      <code aria-label={label} className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{display}</code>
      {secret ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label}` : `Reveal ${label}`}
          className="press hit grid size-8 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); }}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        className={cn(
          'press hit mr-0.5 grid size-8 shrink-0 place-items-center rounded-sm transition-[color,background-color,border-color,transform] duration-(--dur-hover)',
          copied ? 'text-positive-ink' : 'text-ink-3 hover:bg-fill-hover hover:text-ink',
        )}
      >
        {copied ? <Check className="size-4" strokeWidth={2.25} /> : <Copy className="size-4" />}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? `${label} copied` : ''}</span>
    </div>
  );
}

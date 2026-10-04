'use client';

import { cn } from '@/lib/cn';

/**
 * A small segmented control — a horizontal radiogroup for two or three mutually exclusive
 * choices (platform or team, what to rank by), where a `Select` would be heavier than the
 * choice deserves.
 *
 * `label` is required rather than optional: a radiogroup with no accessible name is announced
 * as an unlabelled group.
 */
export function Segmented({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Accessible name for the group, e.g. "Rank skills by". */
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-fit rounded-[var(--r-md)] border border-line bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-label={o.label}
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'focus-ring rounded-[var(--r-sm)] px-3 py-1 text-sm transition-colors',
            value === o.value ? 'bg-accent-tint font-medium text-accent-deep' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

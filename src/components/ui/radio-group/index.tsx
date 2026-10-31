'use client';

import { RadioGroup as R } from 'radix-ui';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export type RadioOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean };

/**
 * One choice from two to five options that each need a sentence to decide: a plan, a retention period, who is notified.
 * Every option stays visible, so the reader compares them in place; a longer list is a Select.
 */
export const RadioGroup = forwardRef<HTMLDivElement, Omit<ComponentPropsWithoutRef<typeof R.Root>, 'children'> & { options: RadioOption[]; variant?: 'list' | 'cards' }>(
  function RadioGroup({ options, variant = 'list', className, ...rest }, ref) {
    const base = useId();
    return (
      <R.Root ref={ref} className={cn(variant === 'cards' ? 'grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]' : 'flex flex-col gap-3', className)} {...rest}>
        {options.map((o) => {
          const id = `${base}-${o.value}`;
          const dot = (
            <R.Item
              id={id}
              value={o.value}
              disabled={o.disabled}
              // The description sits inside the label, so a press on it chooses too; it describes the option rather than naming it.
              {...(o.description ? { 'aria-labelledby': `${id}-label`, 'aria-describedby': `${id}-description` } : null)}
              className={cn(
                'peer relative grid size-4 shrink-0 place-items-center rounded-full border border-line-control bg-surface',
                'transition-[border-color,background-color] duration-(--dur-hover) hover:border-ink-3',
                'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
                // The hit area: 32px for a pointer, 44px for a finger.
                'before:absolute before:-inset-2 before:content-[""] pointer-coarse:before:-inset-4',
                'disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-sunk',
              )}
            >
              <R.Indicator className="size-1.5 rounded-full bg-on-accent [animation:m-pop_var(--dur-hover)_var(--ease-spring)]" />
            </R.Item>
          );
          if (variant === 'cards') {
            return (
              <label
                key={o.value}
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-control transition-[border-color,background-color,box-shadow] duration-(--dur-hover)',
                  'hover:border-line-strong has-data-[state=checked]:border-accent has-data-[state=checked]:bg-accent-tint/50 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-accent has-data-[state=checked]:ring-inset',
                  'has-disabled:cursor-not-allowed has-disabled:opacity-55',
                )}
              >
                <span className="flex h-5 items-center">{dot}</span>
                <span className="min-w-0 text-sm leading-5 font-medium text-ink">
                  <span id={`${id}-label`}>{o.label}</span>
                  {o.description ? <span id={`${id}-description`} className="mt-0.5 block text-xs leading-snug font-regular text-ink-2">{o.description}</span> : null}
                </span>
              </label>
            );
          }
          return (
            <div key={o.value} className="flex items-start gap-2.5">
              <span className="flex h-5 items-center">{dot}</span>
              <label htmlFor={id} data-disabled={o.disabled ? '' : undefined} className={cn('min-w-0 text-sm leading-5 pointer-coarse:-my-3 pointer-coarse:py-3', o.disabled ? 'cursor-not-allowed text-ink-disabled' : 'cursor-pointer text-ink')}>
                <span id={`${id}-label`}>{o.label}</span>
                {o.description ? <span id={`${id}-description`} className="block text-xs leading-snug text-ink-3">{o.description}</span> : null}
              </label>
            </div>
          );
        })}
      </R.Root>
    );
  },
);

/**
 * The accent picker: one colour out of a row of swatches. A radio group like any other — the arrow keys move the choice,
 * the row is one Tab stop, and the chosen one is announced as chosen — drawn as circles because the colour is the label.
 * The swatch inside each item is painted by the product's own `data-accent` rule, so this names no colour itself.
 */
export function AccentSwatches({ value, onChange, accents, size = 'md', label = 'Accent', className }: {
  value: string;
  onChange: (accent: string) => void;
  accents: readonly string[];
  /** `sm` for a toolbar, `md` for a form. */
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}) {
  return (
    <R.Root value={value} onValueChange={onChange} aria-label={label} orientation="horizontal" className={cn('flex items-center gap-1.5', className)}>
      {accents.map((a) => (
        <R.Item
          key={a}
          value={a}
          aria-label={a}
          title={a[0].toUpperCase() + a.slice(1)}
          className={cn('press hit grid shrink-0 place-items-center rounded-full ring-offset-2 ring-offset-surface data-[state=checked]:ring-2 data-[state=checked]:ring-ink-2', size === 'sm' ? 'size-7' : 'size-8')}
        >
          <span data-accent={a} data-swatch className={cn('rounded-full bg-accent ring-1 ring-line', size === 'sm' ? 'size-4' : 'size-5.5')} />
        </R.Item>
      ))}
    </R.Root>
  );
}

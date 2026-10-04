'use client';

import { Checkbox as C } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = Omit<ComponentPropsWithoutRef<typeof C.Root>, 'children'> & {
  /** The label beside the box. Without one, pass `aria-label`. */
  label?: ReactNode;
  /** A line under the label. */
  description?: ReactNode;
};

/**
 * A yes or no that takes effect when the form is saved, or a row picked out of a table. It can be indeterminate when it
 * stands for a set that is partly chosen (a table's select-all).
 */
export const Checkbox = forwardRef<HTMLButtonElement, Props>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const auto = useId();
  const cid = id ?? auto;
  const box = (
    <C.Root
      ref={ref}
      id={cid}
      className={cn(
        'peer group/cb relative grid size-4 shrink-0 place-items-center rounded-xs border border-line-control bg-surface text-on-accent',
        'transition-[background-color,border-color] duration-(--dur-hover)',
        'hover:border-ink-3 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        // The hit area: 32px for a pointer, 44px for a finger.
        'before:absolute before:-inset-2 before:content-[""] pointer-coarse:before:-inset-4',
        'disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-sunk disabled:data-[state=checked]:bg-ink-disabled disabled:data-[state=checked]:border-transparent',
        'aria-[invalid=true]:border-critical',
        !label && className,
      )}
      {...rest}
    >
      <C.Indicator className="grid place-items-center">
        <Check className="size-3 group-data-[state=indeterminate]/cb:hidden" strokeWidth={3} />
        <Minus className="hidden size-3 group-data-[state=indeterminate]/cb:block" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
  if (!label) return box;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="flex h-5 items-center">{box}</span>
      <label htmlFor={cid} data-disabled={rest.disabled ? '' : undefined} className={cn('min-w-0 text-sm leading-5 pointer-coarse:-my-3 pointer-coarse:py-3', rest.disabled ? 'cursor-not-allowed text-ink-disabled' : 'cursor-pointer text-ink')}>
        {label}
        {description ? <span className="block text-xs leading-snug text-ink-3">{description}</span> : null}
      </label>
    </div>
  );
});

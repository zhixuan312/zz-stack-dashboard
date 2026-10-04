'use client';

import { Switch as S } from 'radix-ui';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = Omit<ComponentPropsWithoutRef<typeof S.Root>, 'children'> & {
  label?: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md';
};

/**
 * A setting that takes effect the moment it is flipped: notifications on, a feature enabled. If the change waits for a
 * Save button, it is a Checkbox instead. The label says what is on, never "Enable".
 */
export const Switch = forwardRef<HTMLButtonElement, Props>(function Switch({ label, description, size = 'md', className, id, ...rest }, ref) {
  const auto = useId();
  const sid = id ?? auto;
  const sw = (
    <S.Root
      ref={ref}
      id={sid}
      className={cn(
        'peer group/sw hit relative inline-flex shrink-0 items-center rounded-full border border-transparent bg-line-control/70 p-0.5 transition-colors duration-(--dur-hover)',
        'hover:bg-line-control data-[state=checked]:bg-accent data-[state=checked]:hover:bg-accent-hover',
        'disabled:cursor-not-allowed disabled:bg-fill-track disabled:data-[state=checked]:bg-ink-disabled',
        size === 'sm' ? 'h-4.5 w-8' : 'h-5.5 w-9.5',
        !label && className,
      )}
      {...rest}
    >
      <S.Thumb
        className={cn(
          'block rounded-full bg-on-accent shadow-control ring-1 ring-line transition-transform duration-(--dur-enter) ease-spring',
          // Disabled, the thumb loses its lift; off, it greys too, so a control nobody can flip never looks ready.
          'data-disabled:shadow-none data-disabled:data-[state=unchecked]:bg-ink-disabled data-disabled:data-[state=unchecked]:ring-0',
          size === 'sm' ? 'size-3.5 data-[state=checked]:translate-x-3.5' : 'size-4.5 data-[state=checked]:translate-x-4',
        )}
      />
    </S.Root>
  );
  if (!label) return sw;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={sid} data-disabled={rest.disabled ? '' : undefined} className={cn('min-w-0 text-sm leading-5', rest.disabled ? 'cursor-not-allowed text-ink-disabled' : 'cursor-pointer text-ink')}>
        {label}
        {description ? <span className="mt-0.5 block text-xs leading-snug text-ink-3">{description}</span> : null}
      </label>
      <span className="flex h-5 items-center">{sw}</span>
    </div>
  );
});

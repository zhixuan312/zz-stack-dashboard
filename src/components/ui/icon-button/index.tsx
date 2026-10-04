'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui/tooltip';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** The accessible name, and the tooltip when `tooltip` is set. Required: an icon alone names nothing. */
  label: string;
  icon: ReactNode;
  variant?: 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  /** Show the label in a tooltip on hover and keyboard focus. */
  tooltip?: boolean;
  /** Pressed state, for a toggle: the fill steps up and aria-pressed is set. */
  pressed?: boolean;
};

const SIZE = {
  sm: 'size-(--control-sm) rounded-md [&_svg]:size-3.5',
  md: 'size-(--control-md) rounded-md [&_svg]:size-4',
  lg: 'size-(--control-lg) rounded-lg [&_svg]:size-[18px]',
} as const;
const VARIANT = {
  secondary: 'border border-line-strong bg-surface text-ink-2 shadow-control hover:bg-surface-sunk hover:text-ink',
  ghost: 'text-ink-3 hover:bg-fill-hover hover:text-ink',
} as const;

/** One action shown as an icon: close, refresh, more, copy. Square, the height of a control, always named. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', tooltip, pressed, className, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'press hit inline-grid shrink-0 place-items-center transition-[background-color,color,border-color,transform] duration-(--dur-hover)',
        'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
        VARIANT[variant],
        SIZE[size],
        pressed && 'bg-fill-active text-ink',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});

'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ControlSize = 'sm' | 'md' | 'lg';

/**
 * The shared look of every text control: the outline, the fill, the focus ring and the invalid and disabled states.
 * Input, Textarea and the Select trigger all take it, so a form reads as one system.
 */
export const controlFrame = cn(
  /* control-frame: on a coarse pointer a field is at least 44px tall (base.css). */
  'control-frame rounded-md border border-line-strong bg-surface text-ink shadow-control',
  'transition-[border-color,box-shadow,background-color] duration-(--dur-hover)',
  'hover:border-line-control/40',
  'focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/22 focus-within:hover:border-accent',
  'has-[[aria-invalid=true]]:border-critical has-[[aria-invalid=true]]:focus-within:ring-critical/20',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-line has-[:disabled]:bg-surface-sunk has-[:disabled]:text-ink-disabled has-[:disabled]:shadow-none',
);

export const CONTROL_SIZE: Record<ControlSize, string> = {
  sm: 'h-(--control-sm) gap-1.5 px-2.5 text-sm [&_svg]:size-3.5',
  md: 'h-(--control-md) gap-2 px-3 text-sm [&_svg]:size-4',
  lg: 'h-(--control-lg) gap-2.5 px-3.5 text-base [&_svg]:size-[18px]',
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: ControlSize;
  /** An icon before the text: a search glass, a currency, a key. */
  leading?: ReactNode;
  /** A unit, a hint or a button after the text. */
  trailing?: ReactNode;
  invalid?: boolean;
  /** Classes for the outer frame (width, margins); `className` goes on the native input. */
  frameClassName?: string;
};

/** A single line of text, a number or a value with a unit. It always sits in a Field, which names it. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', leading, trailing, invalid, className, frameClassName, ...rest },
  ref,
) {
  return (
    <div
      // The whole frame is the target: a press on its padding or icons focuses the field, as a press on the text does.
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('input, button, a')) return;
        e.preventDefault();
        e.currentTarget.querySelector('input')?.focus();
      }}
      className={cn('relative flex w-full min-w-0 cursor-text items-center', controlFrame, CONTROL_SIZE[size], frameClassName)}
    >
      {leading ? <span className="flex shrink-0 items-center text-ink-3">{leading}</span> : null}
      <input
        ref={ref}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed',
          '[&::-webkit-search-cancel-button]:appearance-none',
          className,
        )}
        {...rest}
      />
      {trailing ? <span className="flex shrink-0 items-center text-ink-3">{trailing}</span> : null}
    </div>
  );
});

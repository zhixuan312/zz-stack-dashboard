import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Spinner } from '../spinner/index';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent bg-(image:--accent-fill) text-on-accent shadow-accent hover:brightness-[0.94]',
  secondary: 'bg-surface text-ink border border-line-strong shadow-control hover:bg-surface-sunk hover:border-line-control/40',
  ghost: 'text-ink-2 hover:bg-fill-hover hover:text-ink',
  danger: 'bg-critical-fill text-on-critical shadow-accent hover:brightness-95',
};
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-(--control-sm) gap-1.5 rounded-md px-2.5 text-sm [&_svg]:size-3.5',
  md: 'h-(--control-md) gap-2 rounded-md px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-(--control-lg) gap-2 rounded-lg px-5 text-base [&_svg]:size-[18px]',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the child (a link) with the button's look. */
  asChild?: boolean;
  /** An icon before the label. */
  icon?: ReactNode;
  /** An icon after the label; a forward arrow moves 2px on hover. */
  trailing?: ReactNode;
  /** Takes the icon's place with a spinner, at the icon's own size, and ignores presses: it stays focusable (`aria-disabled`), so a focused button that turns busy keeps the person's place. */
  busy?: boolean;
  block?: boolean;
};

/** A button starts one action. One primary per view; every other action is secondary or ghost. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', asChild, icon, trailing, busy, block, className, children, disabled, onClick, ...rest },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  const content = asChild ? (
    children
  ) : (
    <>
      {busy ? <Spinner size={size} label={null} /> : icon}
      {children}
      {trailing ? <span className="transition-transform duration-(--dur-hover) ease-out group-hover/btn:translate-x-0.5">{trailing}</span> : null}
    </>
  );
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (rest.type ?? 'button')}
      // Busy is not disabled: a disabled control loses focus, so a Retry that turns busy from a refetch would send the
      // keyboard back to the top of the page. It stays in the tab order and drops the press, a submit's included.
      disabled={disabled}
      aria-disabled={(busy && !disabled) || undefined}
      aria-busy={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}
      className={cn(
        // The frame is `.btn` (src/styles/base.css): the same on every button, so it is not repeated in each class list.
        'group/btn press hit btn',
        // A busy button is working, not unavailable: it keeps its colour, its shadow and its place, and the spinner is
        // the answer. Only a button nobody may press greys out.
        !busy && 'disabled:opacity-45 disabled:shadow-none',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {content}
    </Comp>
  );
});

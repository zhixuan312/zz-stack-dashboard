import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
  /** Shows a spinner in place of the icon and blocks the action, keeping the width. */
  busy?: boolean;
  block?: boolean;
};

/** A button starts one action. One primary per view; every other action is secondary or ghost. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', asChild, icon, trailing, busy, block, className, children, disabled, ...rest },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  const content = asChild ? (
    children
  ) : (
    <>
      {busy ? <span aria-hidden className="spin size-3.5 rounded-full border-[1.5px] border-current border-r-transparent" /> : icon}
      {children}
      {trailing ? <span className="transition-transform duration-(--dur-hover) ease-out group-hover/btn:translate-x-0.5">{trailing}</span> : null}
    </>
  );
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (rest.type ?? 'button')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'group/btn press hit inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,box-shadow,filter,transform] duration-(--dur-hover)',
        'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
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

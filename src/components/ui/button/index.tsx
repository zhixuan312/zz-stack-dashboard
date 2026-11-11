import { Slot } from 'radix-ui';
import { cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { Spinner } from '../spinner/index';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};
const SIZE: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

const ignorePress: MouseEventHandler<HTMLElement> = (event) => {
  event.preventDefault();
  event.stopPropagation();
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
  { variant = 'secondary', size = 'md', asChild, icon, trailing, busy, block, className, children, disabled, onClick, onClickCapture, ...rest },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  const blocked = disabled || busy;
  // A server component renders this tree with no client runtime, and React refuses a function anywhere in its props
  // there ("Event handlers cannot be passed to Client Component props", #134): one function among them fails the whole
  // view. So the injected handler appears only where a function may exist — on the client, which knows it is, or
  // beside a handler the caller passed, which only a client component can. A server render drops a press with the
  // platform instead: `disabled` on the native button, `pointer-events-none` on an `asChild` child, which is a class and
  // so renders the same on both sides of hydration.
  const hasHandler = Boolean(onClick || onClickCapture);
  const attach = blocked && (hasHandler || typeof document !== 'undefined');
  const content = asChild ? (
    blocked && isValidElement<HTMLAttributes<HTMLElement>>(children)
      ? cloneElement(children, {
          // Slot composes the child's handler first, so replace its capture handler while unavailable.
          ...(attach ? { onClickCapture: ignorePress } : {}),
          // A blocked child with no handler of its own is kept off by `pointer-events-none` below, on the slot itself.
          'aria-disabled': true,
          'aria-busy': busy || children.props['aria-busy'] || rest['aria-busy'],
          tabIndex: disabled ? -1 : (children.props.tabIndex ?? rest.tabIndex),
        })
      : children
  ) : (
    <>
      {busy ? <Spinner size={size} label={null} /> : icon}
      {children}
      {trailing ? <span className="transition-transform duration-(--dur-hover) ease-out group-hover/btn:translate-x-0.5">{trailing}</span> : null}
    </>
  );
  return (
    <Comp
      {...rest}
      ref={ref}
      type={asChild ? undefined : (rest.type ?? 'button')}
      // Busy is not disabled: a disabled control loses focus, so a Retry that turns busy from a refetch would send the
      // keyboard back to the top of the page. It stays in the tab order and drops the press, a submit's included.
      disabled={disabled}
      aria-disabled={blocked || rest['aria-disabled'] || undefined}
      aria-busy={busy || rest['aria-busy'] || undefined}
      onClick={attach ? ignorePress : onClick}
      onClickCapture={attach ? ignorePress : onClickCapture}
      className={cn(
        // The frame is `.btn` (src/styles/base.css): the same on every button, so it is not repeated in each class list.
        'group/btn press hit btn',
        // An `asChild` child a server render blocks has no native `disabled`: this class keeps a mouse off it there,
        // and it is derived from props alone, so hydration sees the same class list.
        blocked && asChild && !hasHandler && 'pointer-events-none',
        // A busy button is working, not unavailable: it keeps its colour, its shadow and its place, and the spinner is
        // the answer. Only a button nobody may press greys out.
        !busy && 'disabled:opacity-45 disabled:shadow-none aria-disabled:opacity-45 aria-disabled:shadow-none',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
    >
      {content}
    </Comp>
  );
});

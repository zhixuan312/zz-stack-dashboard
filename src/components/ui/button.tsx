import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Button — the single source of truth for actions. `buttonVariants` is exported
 * so an `<a>` (link-as-button) gets the exact same look:
 *   <a className={buttonVariants({ variant: 'primary' })}>…</a>
 */
export const buttonVariants = cva(
  // base: layout, type, motion, focus — shared by every variant
  'focus-ring relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r)] font-medium transition-[background,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // `text-on-accent`, NOT `text-white`. In dark the accent fill is a LIGHT
        // indigo, and white on it measures 3.05:1 — unreadable, and invisible to
        // anyone reviewing in light. The token flips with the theme.
        primary: 'bg-accent text-on-accent hover:bg-accent-deep',
        secondary:
          'border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-surface-2',
        // The full-width dark CTA that ends a stage ("Continue to Spec", "Mark
        // complete"). Distinct from `primary` on purpose: accent is for actions
        // inside a stage, ink is for leaving it.
        // `bg-ink` inverts with the theme, so the label has to be the page
        // ground rather than a fixed white.
        solid: 'bg-ink text-bg hover:bg-ink/90 disabled:bg-ink/30 disabled:opacity-100',
        subtle: 'bg-surface-2 text-ink hover:bg-bg-sunk',
        ghost: 'text-ink-soft hover:bg-surface-2 hover:text-ink',
        danger: 'bg-danger-fill text-on-danger hover:brightness-95',
        link: 'h-auto rounded-none p-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-[15px] [&_svg]:size-[18px]',
        icon: 'size-9 [&_svg]:size-[18px]',
      },
      fullWidth: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', size: ['sm', 'md', 'lg'], class: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, leftIcon, rightIcon, loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      // `loading` was carried by a spinner glyph and nothing else: the glyph is `aria-hidden`
      // (correctly — it is decoration), so a screen reader heard only that the button had
      // become disabled, with no indication that work was under way rather than the action
      // being unavailable. Every stage in the app puts a caller in that state for seconds at
      // a time.
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : leftIcon ? (
        <span className="-ml-0.5 inline-flex" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
      {rightIcon && !loading ? (
        <span className="-mr-0.5 inline-flex" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

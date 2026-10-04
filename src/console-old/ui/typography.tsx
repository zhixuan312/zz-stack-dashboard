import { type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Typography primitives. Compose these instead of raw
 * `<h1 className="text-2xl font-semibold">`; the hierarchy is the `.t-*` scale
 * in globals.css. Each accepts an `as` override for the right semantic element.
 */
type TypeProps = {
  children?: ReactNode;
  className?: string;
  as?: ElementType;
  // forward arbitrary element props (htmlFor on Label, id on hints, etc.)
  [prop: string]: unknown;
};

function make(defaultEl: ElementType, base: string) {
  return function Typo({ children, className, as, ...rest }: TypeProps) {
    const El = as ?? defaultEl;
    return (
      <El className={cn(base, className)} {...rest}>
        {children}
      </El>
    );
  };
}

/** Page-level title. One per screen. */
export const Display = make('h1', 't-display');
/** Card / major section title. */
export const Title = make('h2', 't-title');
/** Subsection heading. */
export const Heading = make('h3', 't-heading');
/** Uppercase kicker that sits above a title. */
export const Eyebrow = make('p', 't-eyebrow');
/** Default body copy (ink-soft). */
export const Text = make('p', 't-body');
/** Body copy in full ink (for emphasis paragraphs). */
export const TextStrong = make('p', 't-body-strong');
/** Smaller body copy. */
export const TextSm = make('p', 't-sm');
/** Form / control label. */
export const Label = make('label', 't-label');
/** Smallest supporting text (timestamps, hints). */
export const Micro = make('span', 't-micro');

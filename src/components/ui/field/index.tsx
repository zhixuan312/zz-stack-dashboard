'use client';

import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

/** The props a Field hands its control, so the label, hint and error are wired without the page doing it. */
export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};

/**
 * A question and the control that answers it: the label above, the control, and a hint or an error under it. Field
 * owns the accessibility wiring (the label's `for`, the description, invalid and required) and hands it to the control
 * through a render prop, so no page writes an id by hand.
 */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  action,
  children,
  className,
}: {
  label: ReactNode;
  /** One line under the control: the format, the limit, what happens next. Replaced by the error when there is one. */
  hint?: ReactNode;
  /** What is wrong and how to fix it. Announced when it appears. */
  error?: ReactNode;
  required?: boolean;
  /** Mark the field "Optional" instead of marking every required one. Use one convention per form. */
  optional?: boolean;
  /** A small action on the label's line: "Generate", "Use default". */
  action?: ReactNode;
  children: (props: FieldControlProps) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = error ? errorId : hint ? hintId : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex min-h-5 items-baseline gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required ? <span aria-hidden className="ml-0.5 text-critical-ink">*</span> : null}
        </label>
        {optional ? <span className="text-xs text-ink-3">Optional</span> : null}
        {action ? <span className="ml-auto text-xs">{action}</span> : null}
      </div>
      {children({ id, 'aria-describedby': described, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs leading-snug text-critical-ink">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-snug text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

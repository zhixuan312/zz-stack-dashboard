import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlFrame } from '@/components/ui/input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  /** Grow with the text up to this many rows, then scroll inside. */
  maxRows?: number;
};

/** Several lines of text: a note, a description, a webhook payload. It grows with its content up to a limit. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, rows = 3, maxRows = 10, className, style, ...rest },
  ref,
) {
  return (
    <div className={cn('flex w-full min-w-0', controlFrame)}>
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cn(
          'w-full min-w-0 resize-y bg-transparent px-3 py-2 text-sm leading-normal outline-none [field-sizing:content] placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed',
          className,
        )}
        style={{ minHeight: `calc(${rows} * 1.55em + 16px)`, maxHeight: `calc(${maxRows} * 1.55em + 16px)`, ...style }}
        {...rest}
      />
    </div>
  );
});

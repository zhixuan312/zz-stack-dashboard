'use client';

import { Select as S } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CONTROL_SIZE, controlFrame, type ControlSize } from '@/components/ui/input';

export type SelectOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean };

/**
 * One choice from a list too long for a Segmented control (more than five options, or labels that need a line of
 * their own). The trigger looks like an Input; the list opens over the page with the current choice checked.
 */
export const Select = forwardRef<HTMLButtonElement, {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  /** An icon before the value. */
  leading?: ReactNode;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
}>(function Select({ value, defaultValue, onValueChange, options, placeholder = 'Choose…', size = 'md', invalid, disabled, leading, className, required, name, 'aria-required': ariaRequired, ...aria }, ref) {
  // aria-required is dropped: Radix's trigger takes `required` instead.
  void ariaRequired;
  return (
    <S.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} required={required} name={name}>
      <S.Trigger
        ref={ref}
        aria-invalid={invalid || aria['aria-invalid'] || undefined}
        id={aria.id}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        className={cn(
          'group/sel flex w-full min-w-0 items-center text-left outline-none focus-visible:outline-none',
          controlFrame,
          'focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/22 data-[state=open]:border-accent',
          'aria-[invalid=true]:border-critical disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunk disabled:text-ink-disabled disabled:shadow-none',
          CONTROL_SIZE[size],
          className,
        )}
      >
        {leading ? <span className="flex shrink-0 text-ink-3">{leading}</span> : null}
        <span className="min-w-0 flex-1 truncate data-placeholder:text-ink-3 [&[data-placeholder]]:text-ink-3">
          <S.Value placeholder={<span className="text-ink-3">{placeholder}</span>} />
        </span>
        <S.Icon asChild>
          <ChevronDown className="shrink-0 text-ink-3 transition-transform duration-(--dur-hover) group-data-[state=open]/sel:rotate-180" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className="float-in z-(--layer-popover) max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg bg-surface-raised shadow-overlay"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <SelectItem key={o.value} {...o} />
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
});

function SelectItem({ value, label, description, disabled }: SelectOption) {
  return (
    <S.Item
      value={value}
      disabled={disabled}
      className={cn(
        'relative flex cursor-default flex-col justify-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-ink outline-none select-none',
        'min-h-8 data-highlighted:bg-fill-hover data-disabled:text-ink-disabled',
      )}
    >
      <S.ItemText>{label}</S.ItemText>
      {description ? <span className="text-xs text-ink-3">{description}</span> : null}
      <S.ItemIndicator className="absolute top-1/2 right-2 -translate-y-1/2">
        <Check className="size-4 text-accent" strokeWidth={2.25} />
      </S.ItemIndicator>
    </S.Item>
  );
}

'use client';

import { Search, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, type ChangeEvent } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';

type Props = Omit<InputProps, 'leading' | 'trailing' | 'type' | 'onChange' | 'value'> & {
  value: string;
  onValueChange: (v: string) => void;
  /** A key that focuses the field from anywhere on the page, shown as a hint while it is empty: "/". */
  shortcut?: string;
};

/**
 * Filters what is on screen as the reader types. A search glass in front, a clear button once there is text, and an
 * optional key that focuses it from anywhere. Escape clears it; a second Escape leaves it.
 */
export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput({ value, onValueChange, shortcut, placeholder = 'Search', className, size = 'md', ...rest }, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!);

  useEffect(() => {
    if (!shortcut) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== shortcut || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inner.current?.focus();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [shortcut]);

  return (
    <Input
      ref={inner}
      type="search"
      size={size}
      role="searchbox"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (value) { e.preventDefault(); onValueChange(''); } else inner.current?.blur();
        }
      }}
      leading={<Search strokeWidth={1.75} />}
      trailing={
        value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { onValueChange(''); inner.current?.focus(); }}
            className="-mr-1 grid size-6 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink [&_svg]:!size-3.5"
          >
            <X strokeWidth={2} />
          </button>
        ) : shortcut ? (
          <Kbd className="max-sm:hidden">{shortcut}</Kbd>
        ) : null
      }
      frameClassName={className}
      {...rest}
    />
  );
});

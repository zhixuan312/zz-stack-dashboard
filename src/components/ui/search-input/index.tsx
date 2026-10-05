'use client';

import { Search, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';

type Props = Omit<InputProps, 'leading' | 'trailing' | 'type' | 'onChange' | 'value'> & {
  value: string;
  onValueChange: (v: string) => void;
  /** A key that focuses the field from anywhere on the page, shown as a hint while it is empty: "/". */
  shortcut?: string;
};

/** How long the typing has to stop before what was typed is sent.
 *
 *  The address IS the state, so sending each keystroke re-rendered the page and re-read the table
 *  once per character: eight characters was eight router writes and eight renders of every row.
 *  Short enough that a person who has stopped typing sees the table answer at once. */
const SETTLE = 200;

/**
 * Filters what is on screen as the reader types. A search glass in front, a clear button once there is text, and an
 * optional key that focuses it from anywhere. Escape clears it; a second Escape leaves it.
 */
export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput({ value, onValueChange, shortcut, placeholder = 'Search', className, size = 'md', ...rest }, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current!);

  /* What the reader has typed, sent once the typing stops.
   *
   * The field keeps its own text rather than echoing `value`, and remembers what it last SENT — not
   * what is in the box — so a value arriving from anywhere else (a filtered link, Clear filters, the
   * back button) is adopted, while the echo of our own write is not. Clearing is immediate: a person
   * who presses Escape or Clear is not still typing, and waiting 200ms to empty a box they just
   * emptied by hand reads as a dropped keystroke. */
  const [text, setText] = useState(value);
  const sent = useRef(value);
  useEffect(() => {
    if (value !== sent.current) { sent.current = value; setText(value); }
  }, [value]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = useCallback((next: string, now = false) => {
    sent.current = next;
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = now ? null : setTimeout(() => onValueChange(next), SETTLE);
    if (now) onValueChange(next);
  }, [onValueChange]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
      value={text}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => send(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (text) { e.preventDefault(); send('', true); } else inner.current?.blur();
        }
      }}
      leading={<Search strokeWidth={1.75} />}
      trailing={
        text ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { send('', true); inner.current?.focus(); }}
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

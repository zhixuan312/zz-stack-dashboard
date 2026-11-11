'use client';

import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { rank } from '../../../lib/rank';
import { CONTROL_SIZE, controlFrame, type ControlSize } from '../input/index';
import { Popover, PopoverAnchor, PopoverContent } from '../popover/index';
import { Spinner } from '../spinner/index';

/** One record a person chooses: the value saved, the text that is shown and searched, and what helps tell it apart. */
export type ComboboxOption = {
  value: string;
  /** The text in the list and in the field; what a typed query matches first. */
  label: string;
  /** One fact under the label, searched too: a team, a role, an address. */
  description?: string;
  /** Words a search matches that are never shown: an email, a ticket's number. */
  keywords?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  /** An icon before the field. */
  leading?: ReactNode;
  id?: string;
  /** Posts the chosen value through a hidden input, so `formData.get(name)` reads it. */
  name?: string;
  className?: string;
  /** The options are still arriving: the list says so instead of saying nothing matches. */
  loading?: boolean;
  /** Offer the typed text itself as the value, as a last row: "Use “ABC-123”". */
  allowCustom?: boolean;
  /** The shape a custom value must have; without it any non-empty text is offered. */
  customPattern?: RegExp;
  required?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};

/** Whether the row at `i` can be chosen: an option that is not disabled, or the trailing custom row. */
const pickable = (i: number, options: ComboboxOption[], custom: string | null) =>
  i >= 0 && (i < options.length ? !options[i]!.disabled : i === options.length && custom !== null);

/**
 * One choice from a list of records: more than about fifteen of them, or loaded from a server, or with a description
 * each. A person types to find one and the list narrows as they type; a short fixed list is a Select.
 *
 * The field is the trigger: it looks like an Input, opens the list on click, the arrow keys or Enter, and keeps focus
 * while the list is open (the active option is announced through `aria-activedescendant`). Built from the kit's
 * Popover and Input, with `rank` (src/lib/rank.ts) as the one filter the Command palette also uses.
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Search…',
  size = 'md',
  invalid,
  disabled,
  leading,
  id,
  name,
  className,
  loading = false,
  allowCustom = false,
  customPattern,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const [own, setOwn] = useState(defaultValue);
  const current = value !== undefined ? value : own;
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  // What the person typed. Null is "showing the choice": the label is back after Escape, a blur or a pick, and opening
  // the list does not filter it down to the one option already chosen.
  const [typed, setTyped] = useState<string | null>(null);
  // The highlighted row belongs to one query: typing starts again at the top without an effect, as the palette does.
  const [cursor, setCursor] = useState({ key: '', i: 0 });
  const input = useRef<HTMLInputElement | null>(null);
  const setInput = (node: HTMLInputElement | null) => {
    input.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const query = typed ?? '';
  const matches = useMemo(() => rank(options, query), [options, query]);
  const text = query.trim();
  // The custom row is offered only for text no option already is, and only in the shape the caller accepts.
  const custom = allowCustom && !loading && text !== '' && (!customPattern || customPattern.test(text))
    && !options.some((o) => o.value === text || o.label.toLowerCase() === text.toLowerCase())
    ? text
    : null;
  const rows = matches.length + (custom === null ? 0 : 1);
  const key = `${open}|${typed ?? ''}`;
  const wanted = cursor.key === key ? cursor.i : 0;
  const firstOption = matches.findIndex((o) => !o.disabled);
  const at = rows === 0 ? -1 : pickable(wanted, matches, custom) ? wanted : firstOption >= 0 ? firstOption : custom !== null ? matches.length : -1;
  const move = (step: 1 | -1) => {
    for (let next = at + step; next >= 0 && next < rows; next += step) {
      if (pickable(next, matches, custom)) { setCursor({ key, i: next }); return; }
    }
  };
  const openList = (edge?: 'last') => {
    if (disabled) return;
    setOpen(true);
    // Up opens the list on its last row, as the arrow keys do in a Select; Down opens on the first.
    if (edge === 'last') setCursor({ key: `true|${typed ?? ''}`, i: rows - 1 });
    // The label is selected so that typing replaces it, as a search field's own value would be.
    requestAnimationFrame(() => input.current?.select());
  };
  const closeList = () => { setOpen(false); setTyped(null); };
  const choose = (i: number) => {
    if (!pickable(i, matches, custom)) return;
    const next = i === matches.length ? custom! : matches[i]!.value;
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
    closeList();
    input.current?.focus();
  };

  useEffect(() => {
    if (open) document.getElementById(listId)?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at, open, listId]);

  const display = typed ?? selected?.label ?? (current === undefined ? '' : current);

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTyped(null); }}>
      <PopoverAnchor asChild>
        <div
          // The whole frame is the target: a press on its padding or icons focuses the field and opens the list.
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('input, button')) return;
            e.preventDefault();
            input.current?.focus();
            openList();
          }}
          className={cn('relative flex w-full min-w-0 cursor-text items-center', controlFrame, CONTROL_SIZE[size], className)}
        >
          {leading ? <span className="flex shrink-0 items-center text-ink-3">{leading}</span> : null}
          <input
            ref={setInput}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open && at >= 0 ? `${listId}-${at}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || ariaInvalid || undefined}
            aria-required={required || ariaRequired || undefined}
            disabled={disabled}
            value={display}
            placeholder={placeholder}
            onChange={(e) => { setTyped(e.target.value); if (!open) setOpen(true); }}
            onClick={() => { if (!open) openList(); }}
            onKeyDown={(e) => {
              // An input method composing (Chinese, Japanese, Korean) owns these keys until it is done.
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); if (open) move(1); else openList(); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); if (open) move(-1); else openList('last'); return; }
              if (e.key === 'Enter') { e.preventDefault(); if (open && at >= 0) choose(at); else openList(); return; }
              if (e.key === 'Escape') { if (open) { e.preventDefault(); closeList(); } return; }
              if (e.key === 'Tab') { closeList(); return; }
            }}
            onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) closeList(); }}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? 'Hide options' : 'Show options'}
            disabled={disabled}
            // Pressing the chevron must not take focus from the field, or the list would close under the press.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { input.current?.focus(); if (open) closeList(); else openList(); }}
            className="shrink-0 text-ink-3 disabled:cursor-not-allowed"
          >
            <ChevronDown className={cn('transition-transform duration-(--dur-hover)', open && 'rotate-180')} />
          </button>
          {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
        </div>
      </PopoverAnchor>
      {/* A cap, and never more than the room Radix reports on the side it opens on: without the cap the field's position
          decided the height, and low in a dialog the list took all the room above the trigger (about 700px at 1440) and
          covered the dialog's title and every field above it. */}
      <PopoverContent
        id={listId}
        role="listbox"
        aria-label="Options"
        aria-busy={loading || undefined}
        align="start"
        sideOffset={6}
        className="max-h-[min(18rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) overflow-y-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ComboboxList
          options={matches}
          custom={custom}
          selected={selected?.value}
          active={at}
          query={query}
          loading={loading}
          rowId={(i) => `${listId}-${i}`}
          onHover={(i) => setCursor({ key, i })}
          onPick={choose}
        />
      </PopoverContent>
    </Popover>
  );
});

/**
 * The rows of the list without the popover around them: the loading line, "No match for …", the options and the trailing
 * custom row. Exported so a preview can draw the open list inline, as every other card's preview does.
 */
export function ComboboxList({
  options,
  custom = null,
  selected,
  active = -1,
  query = '',
  loading = false,
  rowId = (i) => `combobox-option-${i}`,
  onHover,
  onPick,
}: {
  /** The options to show, already filtered and ranked. */
  options: ComboboxOption[];
  /** The text offered as a value of its own, when the caller allows one. */
  custom?: string | null;
  /** The chosen value, checked in the list. */
  selected?: string;
  /** The highlighted row, over the options and then the custom row; -1 for none. */
  active?: number;
  /** What was typed, for the "No match" line. */
  query?: string;
  loading?: boolean;
  rowId?: (i: number) => string;
  onHover?: (i: number) => void;
  onPick?: (i: number) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-2 text-sm text-ink-3">
        <Spinner size="sm" label={null} />
        Loading options…
      </div>
    );
  }
  return (
    <>
      {options.length === 0 && custom === null ? (
        <p className="px-2 py-6 text-center text-sm text-ink-3">No match for “{query.trim()}”</p>
      ) : null}
      {options.map((o, i) => (
        <ComboboxRow
          key={o.value}
          id={rowId(i)}
          index={i}
          active={i === active}
          selected={o.value === selected}
          label={o.label}
          description={o.description}
          disabled={o.disabled}
          onHover={onHover}
          onPick={onPick}
        />
      ))}
      {custom !== null ? (
        <ComboboxRow
          id={rowId(options.length)}
          index={options.length}
          active={options.length === active}
          label={`Use “${custom}”`}
          description="Not in the list"
          onHover={onHover}
          onPick={onPick}
        />
      ) : null}
    </>
  );
}

function ComboboxRow({
  id,
  index,
  active,
  selected,
  label,
  description,
  disabled,
  onHover,
  onPick,
}: {
  id: string;
  index: number;
  active: boolean;
  selected?: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onHover?: (i: number) => void;
  onPick?: (i: number) => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected ?? false}
      aria-disabled={disabled || undefined}
      data-index={index}
      // A press on a row picks it without taking focus from the field, which would close the list before the pick landed.
      onPointerDown={onPick ? (e) => e.preventDefault() : undefined}
      onPointerMove={onHover ? () => onHover(index) : undefined}
      onClick={onPick ? () => onPick(index) : undefined}
      className={cn(
        'relative flex min-h-8 cursor-default flex-col justify-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-ink select-none pointer-coarse:min-h-11',
        active && 'bg-fill-hover',
        disabled && 'text-ink-disabled',
      )}
    >
      <span className="truncate">{label}</span>
      {description ? <span className={cn('text-xs text-ink-3', disabled && 'text-ink-disabled')}>{description}</span> : null}
      {selected ? <Check className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-accent" strokeWidth={2.25} /> : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The shape `ApproveAction`'s confirm swap also takes: a button that, on click,
 * replaces itself with "<question>? Cancel / <verb>" in the same spot — no dialog
 * primitive, no second surface to dismiss. Its own component because revoking a
 * token and removing a member are table-row actions, and a form around
 * each row would need a Save button for nothing.
 *
 * The swap keeps a keyboard user's place: the question opens on Cancel, where the button was pressed, and Cancel puts
 * focus back on the button. A swapped-out control takes focus with it to the body otherwise (WCAG 2.4.3).
 */
export function InlineDestructive({
  label,
  question,
  confirmLabel = 'Confirm',
  onConfirm,
  pending,
  size = 'sm',
  trigger = 'ghost',
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  size?: 'sm' | 'md';
  /** The first button's look: `ghost` in a table row, `secondary` beside a field. */
  trigger?: 'ghost' | 'secondary';
}) {
  const [confirming, setConfirming] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // Set by the person's own press, so the first render, and a swap nobody pressed, move nobody's focus.
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) return;
    swapped.current = false;
    (confirming ? cancel : opener).current?.focus();
  }, [confirming]);
  const swap = (next: boolean) => { swapped.current = true; setConfirming(next); };

  if (!confirming) {
    return (
      <Button ref={opener} type="button" size={size} variant={trigger} onClick={() => swap(true)}>
        {label}
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-ink-3">{question}</span>
      <Button ref={cancel} type="button" size={size} variant="secondary" onClick={() => swap(false)} disabled={pending}>
        Cancel
      </Button>
      <Button type="button" size={size} variant="danger" onClick={onConfirm} busy={pending}>
        {confirmLabel}
      </Button>
    </span>
  );
}

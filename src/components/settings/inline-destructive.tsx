'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/**
 * The repeated shape behind FormPanel's own `destructive` slot and
 * `ApproveAction`'s confirm swap: a button that, on click, replaces itself
 * with "<question>? Cancel / <verb>" in the same spot — no dialog primitive,
 * no second surface to dismiss (NFR-4). Revoking a token and disconnecting a
 * block are TABLE ROW actions, not a single form's destructive slot, so this
 * is the same interaction pulled out on its own rather than wrapping every
 * row in a `FormPanel` that would otherwise need a Save button for nothing.
 */
export function InlineDestructive({
  label,
  question,
  confirmLabel = 'Confirm',
  onConfirm,
  pending,
  size = 'sm',
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  size?: 'sm' | 'md';
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" size={size} variant="ghost" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span className="text-xs text-ink-faint">{question}</span>
      <Button type="button" size={size} variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
        Cancel
      </Button>
      <Button type="button" size={size} variant="danger" onClick={onConfirm} loading={pending}>
        {confirmLabel}
      </Button>
    </span>
  );
}

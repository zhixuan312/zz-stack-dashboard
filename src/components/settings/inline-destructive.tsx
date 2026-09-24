'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/**
 * The shape `ApproveAction`'s confirm swap also takes: a button that, on click,
 * replaces itself with "<question>? Cancel / <verb>" in the same spot — no dialog
 * primitive, no second surface to dismiss. Its own component because revoking a
 * token and removing a member are table-row actions, and a `FormPanel` around
 * each row would need a Save button for nothing.
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
    <span className="flex flex-wrap items-center justify-end gap-2">
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

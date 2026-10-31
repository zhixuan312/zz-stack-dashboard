'use client';

import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSurface } from '../../base/surface/index';
import { cn } from '../../../lib/cn';

/**
 * A value to take elsewhere: an ID, an endpoint, a secret. Read-only, in mono, with a Copy button that turns into a
 * check for 1.6s. A secret is masked until Reveal; Copy still copies the real value, so revealing is never required.
 * A copy the browser refuses is said, and the value is selected (a masked secret shown first) to copy by hand.
 */
export function CopyField({
  value,
  label,
  secret,
  className,
  'data-preview-state': previewState,
}: {
  value: string;
  /** The accessible name: "API key", "Request ID". */
  label: string;
  /** Mask the value and offer Reveal. */
  secret?: boolean;
  className?: string;
  /** A state drawn still in the Atlas, held rather than timed: `copied` keeps the check, `revealed` shows the secret. */
  'data-preview-state'?: 'copied' | 'revealed';
}) {
  const [copied, setCopied] = useState(previewState === 'copied');
  const [refused, setRefused] = useState(false);
  const code = useRef<HTMLElement>(null);
  const [revealed, setShown] = useState(!secret || previewState === 'revealed');
  // An embed never reveals a secret: the conversation is not a safe place for it, so it stays masked and Copy remains.
  const embed = useSurface().kind === 'embed';
  const shown = revealed && !(secret && embed);
  useEffect(() => {
    if (!copied || previewState) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied, previewState]);
  // Selected once it is drawn as itself: a selected mask would be copied as the mask.
  const selectable = !secret || (shown && !embed);
  useEffect(() => {
    if (refused && selectable && code.current) window.getSelection()?.selectAllChildren(code.current);
  }, [refused, selectable]);
  // A masked secret keeps a word prefix of at most two parts (zzm_live_, sk_test_), so live and test still read apart,
  // but never a part of the random value that happens to follow an underscore in it; it always shows eight dots, so the
  // mask says nothing about the length, and the last four only of a value long enough that four say nothing about it.
  const display = shown ? value : (/^(?:[a-z]{1,8}_){1,2}/.exec(value)?.[0] ?? '') + '•'.repeat(8) + (value.length >= 16 ? value.slice(-4) : '');
  return (
    // The name is the group's, not the value's: `<code>` does not take an accessible name, so the label on it was read
    // by nothing. The group is what a screen reader announces on the way in, and the value is read as its content.
    <div role="group" aria-label={label} className={cn('flex h-(--control-md) min-w-0 items-center rounded-md border border-line-strong bg-surface-sunk pl-3 shadow-control', className)}>
      {/* The title is what is shown, whole: for a masked secret that is the mask, never the secret. */}
      <code ref={code} title={display} className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{display}</code>
      {secret && !embed ? (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label}` : `Reveal ${label}`}
          className="press hit grid size-8 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={async () => {
          // Only a write that resolved turns the button into a check. `navigator.clipboard` is absent outside a secure
          // context, and `writeText` rejects with NotAllowedError when the frame is sandboxed or the document is not
          // focused; claiming the copy either way told a person their new key was on the clipboard when it was not, on
          // the one value the product says it shows only once.
          try {
            if (!navigator.clipboard) throw new Error('no clipboard');
            await navigator.clipboard.writeText(value);
            setRefused(false);
            setCopied(true);
          } catch {
            // The button keeps saying "Copy": nothing was copied, so nothing says it was, and the line below says why.
            if (secret && !embed) setShown(true);
            setRefused(true);
          }
        }}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
        className={cn(
          'press hit mr-0.5 grid size-8 shrink-0 place-items-center rounded-sm transition-[color,background-color,border-color,transform] duration-(--dur-hover)',
          copied ? 'text-positive-ink' : 'text-ink-3 hover:bg-fill-hover hover:text-ink',
        )}
      >
        {copied ? <Check className="size-4" strokeWidth={2.25} /> : <Copy className="size-4" />}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? `${label} copied` : refused ? `Not copied: your browser did not let the page copy it. ${secret && embed ? 'A secret is not shown here.' : 'It is selected: copy it yourself.'}` : ''}</span>
    </div>
  );
}

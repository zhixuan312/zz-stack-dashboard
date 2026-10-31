'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

/**
 * Access's own Copy, for the setup's commands and a just-issued token: a check for two seconds once the clipboard took
 * the text, and a toast saying how to copy it by hand when it did not. The two seconds are one timer, cleared when the
 * button goes, so a dialog drawn again for a new token starts on Copy rather than on the last one's check.
 *
 * `label` starts "Copy …" and turns to "Copied …" with the button's word, so the name holds what is drawn, and the
 * copy is announced as Meridian's CopyField announces it: a token is shown once, and silence reads as nothing copied.
 */
export function CopyButton({ text, label, byHand }: { text: string; label: string; byHand: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: `Could not copy: ${byHand}` });
    }
  }
  const done = label.replace(/^Copy\b/, 'Copied');
  return (
    <>
      <Button type="button" size="sm" variant="secondary" aria-label={copied ? done : label} icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <span aria-live="polite" className="sr-only">{copied ? `${done}.` : ''}</span>
    </>
  );
}

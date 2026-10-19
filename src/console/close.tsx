'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';
import type { CloseInput, CloseResult } from '@/lib/work-shapes';

/** What the person says of the work. Never an outcome: the platform derives that from these facts and answers it. */
type Choice = 'accepted' | 'delivered' | 'abandoned';

const CHOICES: { value: Choice; label: string; description: string }[] = [
  { value: 'accepted', label: 'Accepted', description: 'Finished, and the person it was for signed it off.' },
  { value: 'delivered', label: 'Delivered', description: 'Finished, and nobody signed it off. Say why.' },
  { value: 'abandoned', label: 'Abandoned', description: 'Stopped before it finished.' },
];

/**
 * The `CloseInput` each choice is, as the spec maps them: accepted and delivered are both finished, delivered with the
 * person's reason nobody signed off; abandoned is abandoned. A close with no flow names the document a finished close
 * lands on; a flow's own closing document is the platform's to choose, as is the furthest one an abandoned close stops at.
 */
function closeInput(choice: Choice, reason: string, landsOn: string | null): CloseInput {
  if (choice === 'abandoned') return { disposition: 'abandoned' };
  return {
    disposition: 'finished',
    ...(choice === 'delivered' ? { no_signoff_reason: reason.trim() } : {}),
    ...(landsOn ? { document: landsOn } : {}),
  };
}

type Refusal = { conflict: boolean; message: string };

/**
 * Close an initiative, the one write on its page, through the console's close route. The person says what happened;
 * the dialog shows the outcome and the closer the gateway answered, never one it worked out. A refusal is said in the
 * dialog with what the person typed kept, and a close somebody else made first says so, since the first decision stands.
 *
 * `closed` hides the trigger once the page reads the initiative closed, while an open dialog stays to show the answer.
 * `freeform` is an initiative with no flow, whose finished close names one of `documents` to land on. `variant` is the
 * trigger's weight: the page's filled action, or the secondary one beside a next step that is.
 */
export function CloseInitiative({ team, slug, closed, freeform, documents, variant = 'primary' }: { team: string; slug: string; closed: boolean; freeform: boolean; documents: string[]; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState('');
  const [landsOn, setLandsOn] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [done, setDone] = useState<CloseResult | null>(null);
  const close = useConsoleMutation<CloseResult, CloseInput>(`/initiatives/${encodeURIComponent(team)}/${encodeURIComponent(slug)}/close`);
  const landing = freeform && choice !== null && choice !== 'abandoned';
  const ready = choice !== null && (choice !== 'delivered' || reason.trim() !== '') && (!landing || landsOn !== null);

  function dismiss(next: boolean) {
    setOpen(next);
    if (next) return;
    setRefusal(null);
    if (done) { setDone(null); setChoice(null); setReason(''); setLandsOn(null); }
  }

  async function submit() {
    if (!ready || !choice) return;
    setRefusal(null);
    try {
      setDone(await close.mutateAsync(closeInput(choice, reason, landing ? landsOn : null)));
    } catch (err) {
      setRefusal(err instanceof ApiError
        ? { conflict: err.status === 409, message: err.message }
        : { conflict: false, message: 'The close was not recorded; try again.' });
    }
  }

  if (closed && !open) return null;
  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <Button variant={variant} aria-haspopup="dialog" onClick={() => setOpen(true)}>Close initiative</Button>
      <DialogContent
        size="sm"
        title={done ? `${slug} is closed` : `Close ${slug}`}
        description={done ? 'The platform recorded the close.' : 'Say what happened to the work. The platform records the outcome from it, and the first close stands.'}
        footer={done ? (
          <Button variant="primary" onClick={() => dismiss(false)}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => dismiss(false)}>Cancel</Button>
            <Button variant="primary" busy={close.isPending} disabled={!ready || refusal?.conflict} onClick={() => void submit()}>Record the close</Button>
          </>
        )}
      >
        {done ? (
          <p className="t-small text-ink" data-close-result>
            Closed as <strong className="font-medium">{done.outcome}</strong> by <span className="[overflow-wrap:anywhere]">{done.closedBy}</span>
            {done.document ? <>, on <span className="font-mono [overflow-wrap:anywhere]">{done.document}</span></> : null}.
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <RadioGroup aria-label="What happened" options={CHOICES} value={choice ?? ''} onValueChange={(v) => setChoice(v as Choice)} />
            {choice === 'delivered' ? (
              <Field label="Why nobody signed it off" required hint="Kept with the close, for whoever reads it next.">
                {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
              </Field>
            ) : null}
            {landing ? (
              <Field label="The document it closes on" required hint="It has no flow, so the close names the document that finished it.">
                {(p) => <Select {...p} value={landsOn ?? undefined} onValueChange={setLandsOn} options={documents.map((d) => ({ value: d, label: d }))} placeholder="Choose a document" />}
              </Field>
            ) : null}
            {refusal ? (
              <p role="alert" className="t-small text-critical-ink">
                {refusal.conflict ? <>Somebody closed it first. </> : null}{refusal.message}
              </p>
            ) : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

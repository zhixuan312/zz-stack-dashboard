'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import type { DocumentDetail, Me } from '@/lib/api-shapes';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Whether `me` is offered Approve on `doc`. Hiding it is courtesy, not enforcement: the gateway re-derives scope on
 * every request and refuses anyone who is not a member of the document's team.
 */
export function canApprove(doc: DocumentDetail, me: Me | undefined): boolean {
  if (doc.gated !== true || doc.approved_by || !me) return false;
  return me.superadmin || me.teams.some((t) => t.slug === doc.team);
}

/**
 * Approve one gated document. Inline confirmation, never a modal: Approve swaps for "Approve this document? Cancel /
 * Confirm" in the same place. The receipt is the stamped approver, which the mutation's refetch shows without a
 * reload; a refusal leaves the document as it was and says the gateway's own sentence.
 */
export function ApproveAction({ doc, me }: { doc: DocumentDetail; me: Me }) {
  const [confirming, setConfirming] = useState(false);
  // `?team=` always: the route refuses `?scope=platform`, so the team comes from the document itself.
  const mutation = useConsoleMutation<{ ok: true; result: string }, { initiative: string; path: string }>(`/documents/approve?team=${encodeURIComponent(doc.team)}`);
  if (!canApprove(doc, me)) return null;

  async function approve() {
    try {
      await mutation.mutateAsync({ initiative: doc.initiative, path: doc.path });
      toast({ tone: 'positive', title: `Approved ${doc.path}`, description: 'The next stage of the flow may start.' });
    } catch (err) {
      toast({ tone: 'critical', title: 'Not approved', description: err instanceof ApiError ? err.message : 'Could not reach the platform; try again.' });
    }
    setConfirming(false);
  }

  if (!confirming) return <Button variant="primary" icon={<CheckCircle2 />} onClick={() => setConfirming(true)}>Approve</Button>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Approve this document?</span>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={mutation.isPending}>Cancel</Button>
      <Button variant="primary" onClick={() => void approve()} busy={mutation.isPending}>Confirm</Button>
    </span>
  );
}

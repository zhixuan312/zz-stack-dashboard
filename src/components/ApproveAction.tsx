'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsoleMutation } from '@/lib/mutate';
import { ApiError, type DocumentDetail, type Me } from '@/lib/api';

/**
 * Whether `me` may see the Approve control on `doc`.
 *
 * Exported (not just used inline below) because the PAGE also needs it: the
 * `actions` slot on `DocumentShell` renders a bordered row whenever it is
 * handed a truthy `ReactNode`, and `<ApproveAction>` is always a truthy
 * element even on the render where it decides to return `null` — so the page
 * has to know in advance whether to pass the slot at all. Calling the same
 * function from both places, rather than writing the condition twice, is
 * what keeps them from drifting apart.
 *
 * HIDING THIS IS COURTESY, NOT ENFORCEMENT. The gateway's own
 * `/api/console/documents/approve` route re-derives scope from the caller's
 * session on every request and refuses anyone who is not a member of the
 * document's team (see `console-write.ts`/`scope.ts` in the gateway) — a
 * forged request against a hidden button gets exactly the same 403 a visible
 * one would have. This check exists so the button is not offered to someone
 * who cannot use it, not because the server trusts it.
 */
export function canApprove(doc: DocumentDetail, me: Me | undefined): boolean {
  // Only worth asking when the flow is actually waiting on somebody and
  // nobody has answered yet. `gated` has three states, not two — `false` is
  // "no approval is coming" and `null` is "the flow says nothing about this
  // file" (a source) — and only `true` with no `approved_by` is a document
  // genuinely sitting open. See the approvers row in the document page for
  // the same three-state reasoning applied to what is DISPLAYED.
  if (doc.gated !== true || doc.approved_by) return false;
  if (!me) return false;
  return me.superadmin || me.teams.some((t) => t.slug === doc.team);
}

/**
 * The Approve control for one document — the `actions` slot of `DocumentShell`.
 *
 * INLINE CONFIRMATION, NEVER A MODAL: clicking Approve swaps the button for a
 * plain "Approve this document? Cancel / Confirm" row in the same slot. There
 * is no dialog primitive to hold state for, and no second surface to dismiss
 * — the receipt is the stamped `approved_by`/`approved_at` that appears in
 * the approvers row once this succeeds, which the mutation's cache
 * invalidation (see `mutate.ts`) is what makes visible without a reload.
 *
 * NO OPTIMISTIC UPDATE: the button does not assume success. A rejected
 * approval leaves `doc` exactly as it was and surfaces the server's own
 * sentence through `showToast`, because a document silently marked approved
 * that then reverts is a worse experience than a moment of "Confirm" doing
 * nothing while the request is in flight.
 */
export function ApproveAction({ doc, me }: { doc: DocumentDetail; me: Me }) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useConsoleMutation<{ ok: true; result: string }, { initiative: string; path: string }>(
    // `?team=` always — even in platform mode, where the caller's activeTeam
    // may not be this document's team at all. The route refuses
    // `?scope=platform` outright (approving stamps ONE team's document, and
    // there is no fleet-wide reading of that), so the team has to come from
    // the document itself rather than from `useConsoleMode`.
    `/documents/approve?team=${encodeURIComponent(doc.team)}`,
  );

  if (!canApprove(doc, me)) return null;

  async function approve() {
    try {
      // No `setConfirming(false)` on success: `mutateAsync` only resolves once
      // the invalidated queries have refetched (see `useConsoleMutation`), so
      // by the time control returns here `doc.approved_by` is already set on
      // the next render and `canApprove` has flipped to false — the page stops
      // passing this component an `actions` slot at all, and it unmounts.
      // There is nothing left for `confirming` to reset.
      await mutation.mutateAsync({ initiative: doc.initiative, path: doc.path });
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Could not approve — try again.',
      });
    }
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 />} onClick={() => setConfirming(true)}>
        Approve
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-ink-faint">Approve this document?</span>
      <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={mutation.isPending}>
        Cancel
      </Button>
      <Button size="sm" variant="primary" onClick={() => void approve()} loading={mutation.isPending}>
        Confirm
      </Button>
    </span>
  );
}

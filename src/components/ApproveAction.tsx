'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsoleMutation } from '@/lib/mutate';
import { ApiError } from '@/lib/api';
import { type DocumentDetail, type Me } from '@/lib/api-shapes';

/**
 * Whether `me` may see the Approve control on `doc`.
 *
 * Exported because the page also needs it: the `actions` slot on `DocumentShell` renders a
 * bordered row whenever it is handed a truthy `ReactNode`, and `<ApproveAction>` is truthy even
 * on the render where it returns `null`, so the page has to know in advance whether to pass the
 * slot at all. Calling the same function from both places keeps them from drifting apart.
 *
 * Hiding this is courtesy, not enforcement. The gateway's own
 * `/api/console/documents/approve` route re-derives scope from the caller's session on every
 * request and refuses anyone who is not a member of the document's team, so a forged request
 * against a hidden button gets exactly the same 403 a visible one would.
 */
export function canApprove(doc: DocumentDetail, me: Me | undefined): boolean {
  // Only worth asking when the flow is actually waiting on somebody and nobody has answered yet.
  // `gated` has three states: `false` is "no approval is coming", `null` is "the flow says nothing
  // about this file" (a source), and only `true` with no `approved_by` is a document sitting open.
  if (doc.gated !== true || doc.approved_by) return false;
  if (!me) return false;
  return me.superadmin || me.teams.some((t) => t.slug === doc.team);
}

/**
 * The Approve control for one document — the `actions` slot of `DocumentShell`.
 *
 * Inline confirmation, never a modal: clicking Approve swaps the button for a plain "Approve this
 * document? Cancel / Confirm" row in the same slot. The receipt is the stamped
 * `approved_by`/`approved_at` that appears in the approvers row, which the mutation's cache
 * invalidation makes visible without a reload.
 *
 * DELIBERATE: one success toast, although the approvers row already carries the information. What
 * it carries is occasion — every gate in every flow, on every initiative, converges on this one
 * button — and it is the only `showToast` call in the console that sets `illustration`.
 *
 * No optimistic update: a rejected approval leaves `doc` exactly as it was and surfaces the
 * server's own sentence through `showToast`.
 */
export function ApproveAction({ doc, me }: { doc: DocumentDetail; me: Me }) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useConsoleMutation<{ ok: true; result: string }, { initiative: string; path: string }>(
    // `?team=` always — even in platform mode, where the caller's activeTeam may not be this
    // document's team at all. The route refuses `?scope=platform` outright, so the team has to
    // come from the document itself rather than from `useConsoleMode`.
    `/documents/approve?team=${encodeURIComponent(doc.team)}`,
  );

  if (!canApprove(doc, me)) return null;

  async function approve() {
    try {
      // No `setConfirming(false)` on success: `mutateAsync` resolves only once the invalidated
      // queries have refetched, so by the time control returns `doc.approved_by` is already set on
      // the next render, `canApprove` has flipped to false, and this component unmounts.
      await mutation.mutateAsync({ initiative: doc.initiative, path: doc.path });
      showToast({
        type: 'success',
        message: `Approved ${doc.path}.`,
        illustration: { src: '/assets/brand/state-approved.png', width: 40, height: 48 },
      });
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

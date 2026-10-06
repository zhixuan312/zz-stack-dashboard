'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RotateCw } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import type { DocumentDetail, DocumentShown, Me } from '@/lib/api-shapes';
import { consoleMutate, useConsoleMutation } from '@/lib/mutate';

/**
 * Whether `me` is offered Approve on `doc`. Hiding it is courtesy, not enforcement: the gateway re-derives scope on
 * every request and zz-core refuses anyone who may not sign.
 *
 * A browser session only, and only on a document of the team that session acts for (`me.activeTeam`). Approve signs
 * the snapshot this page recorded as shown, and zz-core takes that record from a console session alone
 * (`x-zz-via: session`) and acts in the session's team (`x-zz-session-team`), whatever team the page is reading — so
 * anywhere else the record would be refused on open and Approve with it. A superadmin is no exception: zz-core reads
 * a team's store only for its members.
 */
export function canApprove(doc: DocumentDetail, me: Me | undefined): boolean {
  if (doc.gated !== true || doc.approved_by || !me || me.via !== 'session') return false;
  return me.activeTeam === doc.team && me.teams.some((t) => t.slug === doc.team);
}

/** What the page holds about its own presentation of the snapshot it displays. */
export type Shown =
  /** Approve is not on offer, so nothing is recorded. */
  | { state: 'off' }
  | { state: 'recording'; content_revision: string }
  | { state: 'recorded'; content_revision: string; review_context: string }
  /** The document moved before the record landed (409): the page shows an older snapshot than the store holds. */
  | { state: 'stale'; content_revision: string; message: string }
  | { state: 'failed'; content_revision: string; message: string };

/**
 * Records that this page showed `doc` — `POST /documents/shown` — once per displayed snapshot, while Approve is on
 * offer, and holds the review context the gateway answers. The first record of a document mints the console's
 * context; every later snapshot of it is recorded under that same context, so its coverage stays one reader's.
 *
 * Called by the page with the document it has rendered: an effect runs after the commit that put the body on screen.
 * `again` records the same snapshot a second time — the page's reload, when the reload found nothing newer.
 *
 * DELIBERATE: `consoleMutate`, not `useConsoleMutation`. That hook invalidates every console read on success, and
 * the read it would refetch first is the document this call just recorded.
 */
export function useRecordShown(doc: DocumentDetail | undefined, offered: boolean): { shown: Shown; again: () => void } {
  const [results, setResults] = useState<Record<string, Shown>>({});
  const [round, setRound] = useState(0);
  // Keys already sent: React runs an effect twice in development, and a refetch hands over an equal document anew.
  const asked = useRef(new Set<string>());
  // The context held per document address, for the next snapshot of the same document.
  const contexts = useRef(new Map<string, string>());
  const address = doc ? `${doc.team}/${doc.initiative}/${doc.path}` : null;
  const revision = doc?.content_revision ?? null;
  const key = offered && address && revision ? `${address}@${revision}#${round}` : null;

  useEffect(() => {
    if (!doc || !key || !address || !revision || asked.current.has(key)) return;
    asked.current.add(key);
    const held = contexts.current.get(address);
    consoleMutate<DocumentShown>(`/documents/shown?team=${encodeURIComponent(doc.team)}`, {
      initiative: doc.initiative, path: doc.path, content_revision: revision, ...(held ? { review_context: held } : {}),
    }).then(
      (a) => {
        contexts.current.set(address, a.review_context);
        setResults((r) => ({ ...r, [key]: { state: 'recorded', content_revision: revision, review_context: a.review_context } }));
      },
      (err: unknown) => {
        const message = err instanceof ApiError ? err.message : 'Could not reach the platform; try again.';
        const state = err instanceof ApiError && err.status === 409 ? 'stale' : 'failed';
        setResults((r) => ({ ...r, [key]: { state, content_revision: revision, message } }));
      },
    );
  }, [doc, key, address, revision]);

  const shown: Shown = !key || !revision ? { state: 'off' } : results[key] ?? { state: 'recording', content_revision: revision };
  return { shown, again: () => setRound((n) => n + 1) };
}

/**
 * The page is older than the store: the document changed after it was shown, or the record of showing it did not
 * land. Stays until the reader reloads, because a toast would leave before the reason to reload was read.
 */
export function OutOfDate({ message, failed, onReload }: { message: string; failed: boolean; onReload: () => void }) {
  return (
    <Banner
      tone={failed ? 'critical' : 'warning'}
      title={failed ? 'Not recorded as shown' : 'This page is out of date'}
      action={<Button size="sm" icon={<RotateCw />} onClick={onReload}>Reload</Button>}
    >
      {message}
    </Banner>
  );
}

/**
 * Approve one gated document. Inline confirmation, never a modal: Approve swaps for "Approve this document? Cancel /
 * Confirm" in the same place. It signs exactly the snapshot the page recorded as shown, under the context that record
 * answered, and is held until that record lands. The receipt is the stamped approver, which the mutation's refetch
 * shows without a reload; a page that is out of date (409) is handed to `onStale`, which the page shows with a way to
 * reload; any other refusal says the gateway's own sentence in a toast.
 */
export function ApproveAction({ doc, me, shown, onStale }: { doc: DocumentDetail; me: Me; shown: Shown; onStale: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  // `?team=` always: the route refuses `?scope=platform`, so the team comes from the document itself.
  const mutation = useConsoleMutation<{ ok: true; result: string }, { initiative: string; path: string; expected_revision: string; review_context: string }>(
    `/documents/approve?team=${encodeURIComponent(doc.team)}`);
  if (!canApprove(doc, me)) return null;

  async function approve() {
    if (shown.state !== 'recorded') return;
    try {
      await mutation.mutateAsync({ initiative: doc.initiative, path: doc.path, expected_revision: shown.content_revision, review_context: shown.review_context });
      toast({ tone: 'positive', title: `Approved ${doc.path}`, description: 'The next stage of the flow may start.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) onStale(err.message);
      else toast({ tone: 'critical', title: 'Not approved', description: err instanceof ApiError ? err.message : 'Could not reach the platform; try again.' });
    }
    setConfirming(false);
  }

  if (!confirming) {
    return (
      <Button variant="primary" icon={<CheckCircle2 />} onClick={() => setConfirming(true)} disabled={shown.state !== 'recorded'}>
        Approve
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Approve this document?</span>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={mutation.isPending}>Cancel</Button>
      <Button variant="primary" onClick={() => void approve()} busy={mutation.isPending}>Confirm</Button>
    </span>
  );
}

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

/**
 * The team `me` would have to act for to be offered Approve on `doc`, when that is the only thing standing in the way:
 * a member of the document's team whose session acts for another of their teams. Null otherwise.
 */
export function switchToApprove(doc: DocumentDetail, me: Me | undefined): string | null {
  if (doc.gated !== true || doc.approved_by || !me || me.via !== 'session' || me.activeTeam === doc.team) return null;
  return me.teams.some((t) => t.slug === doc.team) ? doc.team : null;
}

/** What the page holds about its own presentation of the snapshot it displays. */
export type Shown =
  /** Approve is not on offer, so nothing is recorded. */
  | { state: 'off' }
  | { state: 'recording'; content_revision: string }
  | { state: 'recorded'; content_revision: string; review_context: string }
  /** A refetch brought a newer snapshot than the one this visit recorded. It is on screen, and not recorded as shown
   *  until the reader reloads: Approve never signs text that replaced what the reader pressed Approve on. */
  | { state: 'changed'; content_revision: string }
  /** The document moved before the record landed, or before Approve did (409): the store holds a newer snapshot. */
  | { state: 'stale'; content_revision: string; message: string }
  | { state: 'failed'; content_revision: string; message: string };

/**
 * Records that this page showed `doc` — `POST /documents/shown` — while Approve is on offer, and holds the review
 * context the gateway answers. The first snapshot a visit displays is recorded on its own; any later one only when the
 * reader reloads (`again`), because a newer snapshot can also arrive by a background refetch, and that one replaced
 * what the reader was reading without their asking. The first record mints the console's context; every later
 * snapshot is recorded under that same context, so its coverage stays one reader's within one visit of the page — a
 * new visit records again and is handed a new one.
 *
 * Called by the page with the document it has rendered: an effect runs after the commit that put the body on screen.
 * `again(revision)` accepts the snapshot a reload brought and records it, the same one a second time included.
 * `outdated(message)` marks the recorded snapshot out of date: Approve's 409.
 *
 * DELIBERATE: `consoleMutate`, not `useConsoleMutation`. That hook invalidates every console read on success, and
 * the read it would refetch first is the document this call just recorded.
 */
export function useRecordShown(doc: DocumentDetail | undefined, offered: boolean): {
  shown: Shown; again: (revision: string) => void; outdated: (message: string) => void;
} {
  const [results, setResults] = useState<Record<string, Shown>>({});
  // The snapshot of each document address the reader has accepted: set by the first record, and by a reload.
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [round, setRound] = useState(0);
  // Keys already sent: React runs an effect twice in development, and a refetch hands over an equal document anew.
  const asked = useRef(new Set<string>());
  // The context held per document address, for the next snapshot of the same document.
  const contexts = useRef(new Map<string, string>());
  const address = doc ? `${doc.team}/${doc.initiative}/${doc.path}` : null;
  const revision = doc?.content_revision ?? null;
  const changed = !!(address && revision && accepted[address] && accepted[address] !== revision);
  const key = offered && address && revision && !changed ? `${address}@${revision}#${round}` : null;

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
    // Accepted once it is asked for, so a refetch landing before the answer is measured against this snapshot.
    setAccepted((a) => (a[address] ? a : { ...a, [address]: revision }));
  }, [doc, key, address, revision]);

  const shown: Shown = !offered || !revision ? { state: 'off' }
    : changed ? { state: 'changed', content_revision: revision }
    : results[key!] ?? { state: 'recording', content_revision: revision };
  return {
    shown,
    again: (next) => {
      if (address) setAccepted((a) => ({ ...a, [address]: next }));
      setRound((n) => n + 1);
    },
    outdated: (message) => {
      if (key && revision) setResults((r) => ({ ...r, [key]: { state: 'stale', content_revision: revision, message } }));
    },
  };
}

/**
 * Why Approve is held: the page is older than the store, the document changed while it was being read, or the record
 * of showing it did not land. Stays until the reader reloads, because a toast would leave before the reason to reload
 * was read. Draws nothing while the page and the store agree.
 */
export function OutOfDate({ shown, onReload }: { shown: Shown; onReload: () => void }) {
  if (shown.state !== 'stale' && shown.state !== 'changed' && shown.state !== 'failed') return null;
  const reload = <Button size="sm" icon={<RotateCw />} onClick={onReload}>Reload</Button>;
  if (shown.state === 'failed') {
    return (
      <Banner tone="critical" title="Approve is unavailable" action={reload}>
        The console could not record that it showed you this version, so it cannot approve it. {shown.message}
      </Banner>
    );
  }
  if (shown.state === 'changed') {
    return (
      <Banner tone="warning" title="This document changed while you were reading it" action={reload}>
        The text on screen is what it says now. Reload to approve this version.
      </Banner>
    );
  }
  return <Banner tone="warning" title="This page is out of date" action={reload}>{shown.message}</Banner>;
}

/**
 * Approve one gated document. Inline confirmation, never a modal: Approve swaps for "Approve this document? Confirm /
 * Cancel" in the same place, Cancel on the edge Approve sat on. It signs exactly the snapshot the page recorded as
 * shown, under the context that record answered, and is held until that record lands. The receipt is the stamped
 * approver, which the mutation's refetch shows without a reload; a page that is out of date (409) is handed to
 * `onStale`, which holds Approve and shows the page's banner; any other refusal says the gateway's own sentence in a
 * toast. A member acting for another of their teams is told which team to switch to.
 */
export function ApproveAction({ doc, me, shown, onStale }: { doc: DocumentDetail; me: Me; shown: Shown; onStale: (message: string) => void }) {
  // The record the reader pressed Approve on, by identity: every record is a new object, so a newer snapshot or the
  // same one recorded again by a reload closes the confirmation, and Confirm can only sign the record it opened on.
  const [confirmingFor, setConfirmingFor] = useState<Shown | null>(null);
  // `?team=` always: the route refuses `?scope=platform`, so the team comes from the document itself.
  const mutation = useConsoleMutation<{ ok: true; result: string }, { initiative: string; path: string; expected_revision: string; review_context: string }>(
    `/documents/approve?team=${encodeURIComponent(doc.team)}`);
  const team = switchToApprove(doc, me);
  if (team) return <span className="text-sm text-ink-2">Switch to {team} to approve.</span>;
  if (!canApprove(doc, me)) return null;

  async function approve(signing: Shown) {
    if (signing.state !== 'recorded') return;
    try {
      await mutation.mutateAsync({ initiative: doc.initiative, path: doc.path, expected_revision: signing.content_revision, review_context: signing.review_context });
      toast({ tone: 'positive', title: `Approved ${doc.path}`, description: 'The next stage of the flow may start.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) onStale(err.message);
      else toast({ tone: 'critical', title: 'Not approved', description: err instanceof ApiError ? err.message : 'Could not reach the platform; try again.' });
    }
    setConfirmingFor(null);
  }

  if (shown.state !== 'recorded' || confirmingFor !== shown) {
    return (
      <>
        <Button
          variant="primary" icon={<CheckCircle2 />} onClick={() => setConfirmingFor(shown)}
          disabled={shown.state !== 'recorded'} busy={shown.state === 'recording'}
          aria-describedby={shown.state === 'recording' ? 'approve-recording' : undefined}
        >
          Approve
        </Button>
        {shown.state === 'recording' ? <span id="approve-recording" className="sr-only">Recording that this version was shown to you.</span> : null}
      </>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Approve this document?</span>
      {/* DELIBERATE: a click that is the second of a double-click is not a confirmation. The first opened this
          confirmation where Approve was; Cancel sits on that edge, and this refuses what still reaches Confirm. */}
      <Button variant="primary" onClick={(e) => { if (e.detail < 2) void approve(shown); }} busy={mutation.isPending}>Confirm</Button>
      <Button variant="ghost" onClick={() => setConfirmingFor(null)} disabled={mutation.isPending}>Cancel</Button>
    </span>
  );
}

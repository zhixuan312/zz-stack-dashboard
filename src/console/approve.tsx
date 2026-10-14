'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RotateCw } from 'lucide-react';
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
 * Approve one gated document. Inline confirmation, never a modal: Approve swaps for "Approve this document as your own
 * decision? Confirm / Cancel" in the same place, Cancel on the edge Approve sat on. The question says "your own" because
 * the console records the approval's decision basis as explicit. It signs exactly the snapshot the page recorded as
 * shown, under the context that record answered, and is held until that record lands. The receipt is the stamped
 * approver, which the mutation's refetch shows without a reload; a page that is out of date (409) is handed to
 * `onStale`, which holds Approve and shows the page's banner; any other refusal says the gateway's own sentence in a
 * toast. A member acting for another of their teams is told which team to switch to.
 */
export function ApproveAction({ doc, me, shown, onStale, onReload }: { doc: DocumentDetail; me: Me; shown: Shown; onStale: (message: string) => void; onReload: () => void }) {
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

  // THE RECORD IS NOT USABLE, SO SAY SO HERE — and here rather than in a banner above the page.
  //
  // This was a `<Banner>` rendered above the `<Query>`, in the page's own flow. It appears when the `documents/shown`
  // call fails, which is *after* the first paint, so **everything below it moved down once**: measured on the two
  // fixture documents whose record is refused (`moving`, `unrecordable`) at **CLS 0.116 and 0.143** against a 0.1 bar,
  // with the `Row` named as the shifted element — while the control, whose record succeeds and whose banner therefore
  // never renders, measured 0.035. The shifting element was the `Row` because the `Row` is the first thing beneath it.
  //
  // **The actions row is the one place above the content whose height does not depend on a late read**, so a control
  // swapped for a control of the same size moves nothing. And it hides the failure from nobody: `offered` requires
  // `canApprove`, so `useRecordShown` only ever records for a reader who *can* approve — the same reader who has this
  // control in front of them.
  //
  // The cost, stated: the sentence each state carries is now the control's own name and description rather than a
  // paragraph on the page, so a sighted reader meets it on hover or through a screen reader rather than at a glance.
  if (shown.state === 'failed' || shown.state === 'stale' || shown.state === 'changed') {
    const why =
      shown.state === 'failed'
        ? `Approve is unavailable: the console could not record that it showed you this version, so it cannot approve it. ${shown.message}`
        : shown.state === 'changed'
          ? 'This document changed while you were reading it. The text on screen is what it says now. Reload to approve this version.'
          : `This page is out of date. ${shown.message}`;
    return (
      <>
        {/* `aria-describedby`, not `aria-label`: the control's name must keep containing its visible word — "Reload" —
            or a person driving it by voice cannot say what they see (WCAG 2.5.3). The sentence is the description. */}
        <Button size="sm" variant="secondary" icon={<RotateCw />} onClick={onReload} title={why} aria-describedby="approve-unavailable">
          {shown.state === 'failed' ? 'Approve unavailable · Reload' : 'Reload'}
        </Button>
        <span id="approve-unavailable" className="sr-only">{why}</span>
      </>
    );
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
      <span className="text-sm text-ink-2">Approve this document as your own decision?</span>
      {/* DELIBERATE: a click that is the second of a double-click is not a confirmation. The first opened this
          confirmation where Approve was; Cancel sits on that edge, and this refuses what still reaches Confirm. */}
      <Button variant="primary" onClick={(e) => { if (e.detail < 2) void approve(shown); }} busy={mutation.isPending}>Confirm</Button>
      <Button variant="ghost" onClick={() => setConfirmingFor(null)} disabled={mutation.isPending}>Cancel</Button>
    </span>
  );
}

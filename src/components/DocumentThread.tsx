'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Textarea, Time } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, consoleFetch } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * The discussion thread on one document (← AC-6, AC-9) — `zz.discussion_message` read
 * through `/api/console/documents/thread`, never zz-core: see the gateway's own
 * `discussion.ts` header for why a thread is a table this app reads directly rather than
 * a flow-side act. This file owns the fetch-then-stream lifecycle, the seq cursor that
 * makes a dropped connection recoverable, and the composer. The document page only wires
 * the two pieces into `DocumentShell`'s slots — the scrolling list into `body`, the
 * composer into `footer` — because those are two different places in the DOM (one
 * scrolls, one is pinned) that nonetheless share one thread's state.
 */

export interface ThreadMessage {
  seq: number;
  author: { name: string; email: string };
  body: string;
  created_at: string;
}

interface ThreadEnvelope {
  messages: ThreadMessage[];
}

/** How long to wait before a self-driven reconnect — see `useDocumentThread`'s `connect`. */
const RECONNECT_DELAY_MS = 3000;

/**
 * Merge a batch of messages into what the thread already holds, keyed by `seq`.
 *
 * A dropped `EventSource` is recovered by closing it and opening a fresh one with
 * `after=<lastSeq>` (see `useDocumentThread` below) — but the moment between "the old
 * connection died" and "the new one is live" can be filled by the SAME message twice:
 * once queued by the dying connection, once replayed by the new one's `after` cursor.
 * Deduplicating on `seq` — the database's own guarantee (see the gateway's
 * `discussion.ts`), never array position or object identity — is what keeps a flaky
 * connection from doubling a line in the thread. Sorted ascending afterward because a
 * batch this function is handed (a POST's own reply, a stream replay) is not guaranteed
 * to already be in order relative to what is already held.
 */
export function mergeThreadMessages(
  existing: readonly ThreadMessage[],
  incoming: readonly ThreadMessage[],
): ThreadMessage[] {
  const bySeq = new Map<number, ThreadMessage>();
  for (const m of existing) bySeq.set(m.seq, m);
  for (const m of incoming) bySeq.set(m.seq, m);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Whether a composer draft is worth sending. The route would happily store a blank or
 * all-whitespace body as a real message — nothing server-side stops it — so this is the
 * one check that has to happen before ever calling it, and it is exported so the
 * composer's "no empty post" behaviour can be driven directly in a test without
 * simulating a real submit.
 */
export function canPostThreadMessage(body: string): boolean {
  return body.trim().length > 0;
}

/**
 * Whether there is anything for `/documents/revise` to revise from. Exported for the same
 * reason `canPostThreadMessage` is — a direct, driveable check rather than a prop the
 * control's own render logic hides.
 */
export function canReviseFromThread(messages: readonly ThreadMessage[]): boolean {
  return messages.length > 0;
}

/**
 * `/documents/thread`, through `consoleFetch` — never `useConsole`. That hook appends
 * `?scope=platform` for a superadmin in platform mode (see api.ts's `withScope`), and
 * every route in the gateway's `discussion.ts` refuses `scope=platform` outright: a
 * thread is always one team's conversation, never a fleet-wide read. `?team=` is sent
 * explicitly instead, exactly as `ApproveAction` already does for a document's approve
 * route for the same reason.
 */
function threadPath(initiative: string, path: string, team: string): string {
  const q = new URLSearchParams({ initiative, path, team });
  return `/documents/thread?${q.toString()}`;
}

/** The stream is opened by the browser's own `EventSource`, not `consoleFetch`, so it
 *  needs the full `/api/console` prefix `consoleFetch` otherwise adds on its callers'
 *  behalf. `EventSource` sends the session cookie itself for a same-origin URL — there is
 *  no way to attach a header to it, and none is needed. */
function streamPath(initiative: string, path: string, team: string, after: number): string {
  const q = new URLSearchParams({ initiative, path, team, after: String(after) });
  return `/api/console/documents/thread/stream?${q.toString()}`;
}

interface UseDocumentThreadArgs {
  team: string;
  initiative: string;
  path: string;
  /**
   * Only true while the discussion tab is the one showing. The effect below tears the
   * stream (and the read) down when this goes false rather than holding it open for as
   * long as the page is: the server keeps one `EventEmitter` listener per open stream
   * (see `discussion.ts`'s own header on why that headroom is generous but not
   * unlimited), and there is no reason to occupy one for a tab nobody is looking at.
   */
  active: boolean;
}

interface DocumentThreadState {
  messages: ThreadMessage[];
  loading: boolean;
  loadError: string | null;
  draft: string;
  setDraft: (v: string) => void;
  posting: boolean;
  submit: () => void;
}

/**
 * Fetches the thread, then opens its live stream, and carries the composer's draft and
 * submit — the state both `DocumentShell` slots need (the message list in `body`, the
 * composer in `footer`), which is why this is one hook the page calls once rather than
 * two components each holding a separate copy that could drift apart.
 */
export function useDocumentThread({ team, initiative, path, active }: UseDocumentThreadArgs): DocumentThreadState {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const mutation = useConsoleMutation<ThreadEnvelope, { initiative: string; path: string; body: string }>(
    (vars) => ({ path: `/documents/thread?team=${encodeURIComponent(team)}`, body: vars }),
  );

  useEffect(() => {
    // Nothing to read or stream while the tab is off screen — see `active`'s own comment
    // above. `DocumentThreadMessages` isn't even mounted while the Document tab is
    // showing (the page only renders it for the discussion tab), so there is nobody to
    // reset state FOR here; the bootstrap below sets `loading` back to true before
    // touching the network the next time this effect runs with `active` true, which is
    // what keeps a re-opened tab from flashing last session's stale messages.
    if (!active) return;

    let cancelled = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A plain closure variable, not a ref: the bootstrap fetch, `onmessage`, and every
    // `connect()` call a reconnect makes all live inside this ONE effect run, so there is
    // no second copy of "the last seq we've seen" for them to disagree about.
    let lastSeq = 0;

    function connect() {
      if (cancelled) return;
      es = new EventSource(streamPath(initiative, path, team, lastSeq));
      es.onmessage = (ev) => {
        let msg: ThreadMessage;
        try {
          msg = JSON.parse(ev.data) as ThreadMessage;
        } catch {
          // A payload that doesn't parse is dropped, not thrown: the database read the
          // next reconnect performs is the source of truth regardless of one bad event.
          return;
        }
        lastSeq = Math.max(lastSeq, msg.seq);
        setMessages((prev) => mergeThreadMessages(prev, [msg]));
      };
      es.onerror = () => {
        es?.close();
        // RECONNECT OURSELVES rather than trust the browser's own retry: a native retry
        // reopens the EXACT url `EventSource` was constructed with, and that url's
        // `after` goes stale the moment any message arrives. Recreating the connection
        // lets every attempt carry `lastSeq`'s CURRENT value, which is the whole reason
        // the gateway's replay cursor exists. This is also what makes local development
        // quiet: there is no gateway behind `/api/console` there (see api.ts's own
        // header), so every attempt fails and is silently retried a moment later — no
        // toast, no logged error, nothing thrown on a dev page load.
        if (!cancelled) timer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await consoleFetch<ThreadEnvelope>(threadPath(initiative, path, team));
        if (cancelled) return;
        setMessages(data.messages);
        lastSeq = data.messages.at(-1)?.seq ?? 0;
        setLoading(false);
        connect();
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        // Named, not generic — see consoleFetch's own header on why the gateway's
        // sentence is worth keeping rather than replacing with "request failed".
        setLoadError(err instanceof ApiError ? err.message : 'Could not load the discussion — try again.');
      }
    })();

    // Closes the stream on unmount AND on every dependency change below — the same
    // cleanup path, because switching documents and leaving the tab both mean this
    // connection no longer belongs to anything on screen.
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [active, team, initiative, path]);

  function submit() {
    if (!canPostThreadMessage(draft) || mutation.isPending) return;
    const body = draft;
    mutation.mutate({ initiative, path, body }, {
      onSuccess: (data) => {
        // The stream delivers this same message back too — the gateway publishes to its
        // bus after every successful insert (see `discussion.ts`) — and
        // `mergeThreadMessages` is what keeps that from showing up twice.
        setMessages((prev) => mergeThreadMessages(prev, data.messages));
        setDraft('');
      },
      onError: (err) => {
        // The draft is left exactly as typed: a rejected post must not also cost
        // somebody what they wrote, so there is no `setDraft('')` on this path.
        showToast({
          type: 'error',
          message: err instanceof ApiError ? err.message : 'Could not post — try again.',
        });
      },
    });
  }

  return { messages, loading, loadError, draft, setDraft, posting: mutation.isPending, submit };
}

/**
 * The scrolling message list — `DocumentShell`'s `body` slot on the discussion tab.
 * Renders plain flow content and never its own `overflow-y-auto`: the shell's own body
 * div is the scroll container (see `DocumentShell`'s `bodyRef` comment — "the shell owns
 * scrolling"), and a second scrolling div here would fight it for the scrollbar.
 */
export function DocumentThreadMessages({ messages, loading, loadError }: {
  messages: ThreadMessage[];
  loading: boolean;
  loadError: string | null;
}) {
  if (loadError) {
    return <p role="alert" className="text-sm text-[var(--rose-deep)]">{loadError}</p>;
  }
  if (loading) {
    return <p className="text-sm text-ink-faint">Loading the discussion…</p>;
  }
  if (messages.length === 0) {
    return <p className="text-sm text-ink-faint">Nothing here yet — say something below.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m) => (
        <li key={m.seq} className="rounded-[var(--r)] border border-line bg-surface px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            {/* THE EMAIL WHEN THERE IS NO NAME. `zz.principal.display_name` defaults to the
                empty string and is only ever filled from what the directory returned at
                sign-in, so anyone added by `add_person` — or created before that claim was
                sent — has none. Rendering it bare put messages on UAT under a blank author,
                which reads as a bug in the thread rather than a missing field. The local
                part is what the rail already shows for the signed-in person. */}
            <span className="text-xs font-medium text-ink">
              {m.author.name.trim() || m.author.email.split('@')[0]}
            </span>
            <Time value={m.created_at} />
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Revise from this discussion" (← AC-7, AC-8) — the discussion tab's other control,
 * sitting above the composer in the same `footer` slot. There is no editor anywhere in
 * this console (see `console-write.ts`'s own header on the stakeholder's own model for
 * this: "the PLATFORM authors the next version from that discussion") — this button is
 * the entire interface for it. It sends nothing but `{ initiative, path }`; the document
 * body the platform writes is generated server-side from the thread this page is already
 * showing, never typed here.
 *
 * INLINE CONFIRMATION, NEVER A MODAL — same pattern as `ApproveAction`, and for the same
 * reason: the confirmation names the actual consequence ("write a new draft… and clear
 * the current approval") rather than just repeating the button's own label, because
 * clearing a standing approval is the one part of this act a person would want to see
 * spelled out before confirming it.
 *
 * DISABLED FOR AN EMPTY THREAD via `canReviseFromThread`, not by hiding the button
 * outright — unlike `ApproveAction`'s `canApprove`, whether this control is USEFUL right
 * now (nothing said yet) is not the same question as whether it EXISTS on this document,
 * so the control stays visible and simply cannot be pressed, the same way `Send` in the
 * composer below disables rather than disappears for a blank draft.
 *
 * NO SUCCESS TOAST: the receipt is the document itself changing — the version badge in
 * the shell header increments and the approvers row clears once the mutation's own
 * invalidation (`useConsoleMutation`) refetches, exactly as `ApproveAction` relies on for
 * its own receipt.
 */
export function DocumentThreadRevise({ team, initiative, path, disabled }: {
  team: string;
  initiative: string;
  path: string;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useConsoleMutation<{ ok: true; version: number | null }, { initiative: string; path: string }>(
    // `?team=` always, same as `ApproveAction`'s own mutation — the route refuses
    // `?scope=platform` outright, and the team a revision belongs to is the document's,
    // not necessarily whatever a superadmin's platform-mode view happens to be showing.
    `/documents/revise?team=${encodeURIComponent(team)}`,
  );

  async function revise() {
    try {
      // `confirming` is reset on success here — unlike `ApproveAction`, this control does
      // not unmount once the act succeeds (the thread is still there to revise from
      // again), so there is a next render to reset it for.
      await mutation.mutateAsync({ initiative, path });
      setConfirming(false);
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Could not revise — try again.',
      });
    }
  }

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Sparkles />}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Revise from this discussion
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-faint">
        The platform will write a new draft from this discussion and clear the current approval.
      </span>
      <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={mutation.isPending}>
        Cancel
      </Button>
      <Button size="sm" variant="primary" onClick={() => void revise()} loading={mutation.isPending}>
        Confirm
      </Button>
    </span>
  );
}

/**
 * The composer — `DocumentShell`'s `footer` slot on the discussion tab. `footer` is
 * deliberately NOT scoped to the first tab the way `actions`/`approvers` are (see
 * `DocumentShell`'s own comment on `footer`), so it is the PAGE that only passes this
 * slot while the discussion tab is active, rather than this component hiding itself —
 * the same division of responsibility `ApproveAction`/`canApprove` already use for
 * `actions`.
 */
export function DocumentThreadComposer({ draft, onDraftChange, onSubmit, posting }: {
  draft: string;
  onDraftChange: (v: string) => void;
  onSubmit: () => void;
  posting: boolean;
}) {
  return (
    <form
      className="flex shrink-0 items-end gap-2 border-t border-line px-5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        // Guarded again here, not only by the button's `disabled` below — Enter never
        // reaches this handler from the multi-line `Textarea` (it inserts a newline
        // instead of submitting), but a form can still be submitted by other means, and
        // an empty post is never worth a round trip to the server that would refuse it.
        if (canPostThreadMessage(draft) && !posting) onSubmit();
      }}
    >
      <Textarea
        aria-label="Say something about this document"
        placeholder="Say something about this document…"
        rows={2}
        className="flex-1"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
      />
      <Button type="submit" size="sm" variant="primary" loading={posting} disabled={!canPostThreadMessage(draft)}>
        Send
      </Button>
    </form>
  );
}

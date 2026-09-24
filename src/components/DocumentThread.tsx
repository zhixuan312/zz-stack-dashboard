'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button, Textarea, Time } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, consoleFetch } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * The discussion thread on one document: `zz.discussion_message` read through
 * `/api/console/documents/thread`, never zz-core; see the gateway's `discussion.ts` header. This
 * file owns the fetch-then-stream lifecycle, the seq cursor that makes a dropped connection
 * recoverable, and the composer.
 * COUPLED: the document page wires the message list into `DocumentShell`'s `body` slot and the
 * composer into `footer` — two places in the DOM sharing one thread's state.
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
 * A dropped `EventSource` is recovered by opening a fresh one with `after=<lastSeq>`, and the
 * moment between the old connection dying and the new one going live can carry the same message
 * twice: once queued by the dying connection, once replayed by the new cursor. Deduplication is on
 * `seq` — the database's own guarantee — never array position or object identity. Sorted ascending
 * afterwards, because an incoming batch is not guaranteed to be in order relative to what is held.
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
 * Whether a composer draft is worth sending. The route would store a blank or all-whitespace body
 * as a real message, so this is the one check that has to happen before calling it. Exported so
 * the composer's "no empty post" behaviour can be driven directly in a test.
 */
export function canPostThreadMessage(body: string): boolean {
  return body.trim().length > 0;
}

/**
 * Whether there is anything for `/documents/revise` to revise from. Exported for the same reason
 * `canPostThreadMessage` is: a driveable check rather than a prop the render logic hides.
 */
export function canReviseFromThread(messages: readonly ThreadMessage[]): boolean {
  return messages.length > 0;
}

/**
 * `/documents/thread`, through `consoleFetch` — never `useConsole`. That hook appends
 * `?scope=platform` for a superadmin in platform mode, and every route in the gateway's
 * `discussion.ts` refuses `scope=platform` outright: a thread is always one team's conversation.
 * `?team=` is sent explicitly instead, as `ApproveAction` does for a document's approve route.
 */
function threadPath(initiative: string, path: string, team: string): string {
  const q = new URLSearchParams({ initiative, path, team });
  return `/documents/thread?${q.toString()}`;
}

/** The stream is opened by the browser's own `EventSource`, not `consoleFetch`, so it needs the
 *  full `/api/console` prefix `consoleFetch` otherwise adds. `EventSource` sends the session cookie
 *  itself for a same-origin URL; no header can be attached to it and none is needed. */
function streamPath(initiative: string, path: string, team: string, after: number): string {
  const q = new URLSearchParams({ initiative, path, team, after: String(after) });
  return `/api/console/documents/thread/stream?${q.toString()}`;
}

interface UseDocumentThreadArgs {
  team: string;
  initiative: string;
  path: string;
  /**
   * Only true while the discussion tab is the one showing. The effect below tears the stream and
   * the read down when this goes false rather than holding it open for as long as the page is:
   * the server keeps one `EventEmitter` listener per open stream.
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
 * Fetches the thread, then opens its live stream, and carries the composer's draft and submit —
 * the state both `DocumentShell` slots need, so the page calls one hook once rather than two
 * components each holding a copy that could drift apart.
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
    // Nothing to read or stream while the tab is off screen. `DocumentThreadMessages` is not
    // mounted while the Document tab is showing, so there is no state to reset here; the bootstrap
    // below sets `loading` back to true before touching the network, which keeps a re-opened tab
    // from flashing last session's stale messages.
    if (!active) return;

    let cancelled = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A plain closure variable, not a ref: the bootstrap fetch, `onmessage` and every `connect()`
    // a reconnect makes all live inside this one effect run, so there is no second copy of the
    // last seq seen.
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
        // DELIBERATE: reconnect ourselves rather than trust the browser's own retry. A native
        // retry reopens the exact url `EventSource` was constructed with, and that url's `after`
        // goes stale the moment any message arrives; recreating the connection lets every attempt
        // carry `lastSeq`'s current value. It also keeps local development quiet: there is no
        // gateway behind `/api/console` there, so every attempt fails and is retried silently.
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

    // Closes the stream on unmount and on every dependency change below — switching documents and
    // leaving the tab both mean this connection no longer belongs to anything on screen.
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
        // The stream delivers this same message back too — the gateway publishes to its bus after
        // every successful insert — and `mergeThreadMessages` keeps it from showing up twice.
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
 * The message list — `DocumentShell`'s `body` slot on the discussion tab. Plain flow
 * content: the card is as tall as the thread and the page scrolls.
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
            {/* The email when there is no name. `zz.principal.display_name` defaults to the
                empty string and is only ever filled from what the directory returned at
                sign-in, so anyone added by `person_add` has none. The local part is what the
                rail already shows for the signed-in person. */}
            <span className="text-xs font-medium text-ink">
              {m.author.name.trim() || m.author.email.split('@')[0]}
            </span>
            <Time value={m.created_at} />
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Revise from this discussion": the discussion tab's other control, above the
 * composer in the same `footer` slot. There is no editor anywhere in this console: the platform
 * authors the next version from the discussion. This sends nothing but `{ initiative, path }`, and
 * the document body is generated server-side from the thread this page is already showing.
 *
 * Inline confirmation, never a modal — the same pattern as `ApproveAction`. The confirmation names
 * the consequence ("write a new draft… and clear the current approval") rather than repeating the
 * button's own label, because clearing a standing approval is the part a person wants spelled out.
 *
 * DELIBERATE: disabled for an empty thread via `canReviseFromThread` rather than hidden. Unlike
 * `ApproveAction`'s `canApprove`, whether this control is useful right now is not the same
 * question as whether it exists on this document.
 *
 * No success toast: the receipt is the document itself changing — the version badge increments and
 * the approvers row clears once `useConsoleMutation`'s own invalidation refetches.
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
    // `?scope=platform`, and the team a revision belongs to is the document's, not whatever a
    // superadmin's platform-mode view happens to be showing.
    `/documents/revise?team=${encodeURIComponent(team)}`,
  );

  async function revise() {
    try {
      // `confirming` is reset on success here — unlike `ApproveAction`, this control does not
      // unmount once the act succeeds, so there is a next render to reset it for.
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
 * The composer — `DocumentShell`'s `footer` slot on the discussion tab.
 * COUPLED: `footer` is not scoped to the first tab the way `actions`/`approvers` are, so it is the
 * page that passes this slot only while the discussion tab is active, rather than this component
 * hiding itself.
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
        // Guarded again here, not only by the button's `disabled` below: Enter never reaches this
        // handler from the multi-line `Textarea`, but a form can still be submitted by other
        // means, and an empty post is never worth a round trip the server would refuse.
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

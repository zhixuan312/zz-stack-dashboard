'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from 'ai';
import { ArrowUp, Eraser, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { app } from '../../../app.config';
import { AgentMark } from '../../ui/agent-mark/index';
import { Banner } from '../../ui/banner/index';
import { Button } from '../../ui/button/index';
import { IconButton } from '../../ui/icon-button/index';
import { Proposal, type ProposalChange, type ProposalState } from '../proposal/index';
import { Spinner } from '../../ui/spinner/index';
import { Textarea } from '../../ui/textarea/index';
import type { PageContext } from '../../../lib/assistant/prompt';
import { sharedContextOn } from '../../base/surface/index';
import { AssistantText } from './text';
import { REASONS, clearThread, closeOpenApprovals, loadThread, recent, saveThread } from './thread';

/** The suffix the root layout's title template puts after every route's own title. */
const TITLE_SUFFIX = ` · ${app.name}`;

/**
 * Reads the page from the scroll region: the page's own title, its address with the query that sets its filters, the
 * shared context its view published (decision 0011), and its visible text.
 *
 * The title comes from `document.title`, never the masthead `h1`. On a detail page that `h1` is the Detail head — the
 * record's name with its status badge run into it — so a question asked there was labelled "REC-1042high risk · 0.64".
 * The route's declared title is the clean one ("Record REC-1042"). The masthead is the fallback for a route that
 * declares none, where `document.title` is only the product name.
 */
function readPage(path: string): PageContext {
  const context = sharedContextOn(path) ?? '';
  const region = document.querySelector<HTMLElement>('[data-scroll-region]');
  const h1 = region?.querySelector('h1')?.textContent?.trim() ?? '';
  const declared = document.title.endsWith(TITLE_SUFFIX)
    ? document.title.slice(0, -TITLE_SUFFIX.length).trim()
    : document.title.trim();
  return { path: `${path}${location.search}`, title: declared && declared !== app.name ? declared : h1, context, text: region?.innerText ?? '' };
}

type Preview = { title: string; tone: 'neutral' | 'critical'; changes: ProposalChange[] };
/** The slice of an AI SDK tool part the panel reads. */
type ToolPart = { type: string; toolCallId: string; state: string; errorText?: string; approval?: { id: string; approved?: boolean; reason?: string } };

/** The page a question was asked on, as the column sends it with the message. */
const pageOf = (m: UIMessage) => (m.metadata as { page?: { title?: string } } | undefined)?.page?.title;
const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
const isMutation = (p: { type: string }) => p.type.startsWith('tool-') && !p.type.startsWith('tool-query_');

/** The card's state for a tool part's state, and the reason a closed one carries. */
function stateOf(part: ToolPart): { state: ProposalState; note?: string } | null {
  switch (part.state) {
    case 'approval-requested': return { state: 'pending' };
    case 'approval-responded': return part.approval?.approved ? { state: 'applying' } : { state: 'dismissed' };
    case 'output-available': return { state: 'applied' };
    case 'output-error': return { state: 'failed', note: part.errorText };
    case 'output-denied': return part.approval?.reason ? { state: 'expired', note: part.approval.reason } : { state: 'dismissed' };
    default: return null;
  }
}

/** A mutation tool part drawn as a Proposal from the server's preview; nothing when there is no preview or state to draw. */
function ProposalOf({ message, part, onDecide }: { message: UIMessage; part: ToolPart; onDecide: (approvalId: string, approved: boolean) => void }) {
  const preview = message.parts.find((p) => p.type === 'data-proposal' && (p as { id?: string }).id === part.toolCallId) as { data: Preview } | undefined;
  const shown = stateOf(part);
  if (!preview || !shown) return null;
  const id = part.approval?.id;
  return (
    <Proposal
      agent="Assistant"
      title={preview.data.title}
      tone={preview.data.tone}
      changes={preview.data.changes}
      state={shown.state}
      note={shown.note}
      onApprove={id ? () => onDecide(id, true) : undefined}
      onDismiss={id ? () => onDecide(id, false) : undefined}
      className="w-full"
    />
  );
}

/**
 * The panel, drawn from its messages alone: a third column of the shell from 1024px, a sheet over the page below it.
 * Both come from CSS; nothing here measures the window.
 */
export function AssistantPanel({
  messages,
  busy = false,
  onSend,
  onClose,
  onDecide,
  onClear,
  error,
  onRetry,
  inline,
  className,
}: {
  messages: UIMessage[];
  busy?: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  /** Answers a waiting change: approve it or dismiss it, by the approval's id. */
  onDecide: (approvalId: string, approved: boolean) => void;
  /** Empties the thread; offered only while there is one. */
  onClear?: () => void;
  /** Said in an alert under the thread, with Retry. */
  error?: string;
  onRetry?: () => void;
  /** Draw in the flow instead of fixed to the viewport edge: for previews. */
  inline?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const thread = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const text = draft.trim();
  const send = () => {
    if (!text || busy) return;
    onSend(text);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const last = messages[messages.length - 1];
  const answering = last?.role === 'assistant' && last.parts.some((p) => p.type === 'text' && p.text);
  return (
    <>
    {/* Below 1024px the panel is a sheet over the page: a scrim dims the page and closes the panel when pressed. */}
    {inline ? null : <div aria-hidden onClick={onClose} className="scrim-in fixed inset-0 z-(--layer-overlay) bg-scrim lg:hidden" />}
    <aside
      data-assistant
      aria-label="Assistant"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-line bg-frame backdrop-blur-xl backdrop-saturate-150',
        inline
          ? 'w-(--assistant-width) max-w-full'
          : 'fixed inset-y-0 right-0 z-(--layer-overlay) w-(--assistant-width) max-w-[calc(100vw-48px)] bg-ground shadow-overlay lg:relative lg:z-auto lg:shrink-0 lg:bg-frame lg:shadow-none',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <AgentMark size="md" />
        <h2 className="t-card min-w-0 flex-1 truncate">Assistant</h2>
        <IconButton label="Clear conversation" icon={<Eraser />} tooltip disabled={messages.length === 0} onClick={onClear} />
        <IconButton label="Close assistant" icon={<X />} onClick={onClose} className="-mr-2" />
      </div>
      <div ref={thread} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 ? (
          <p className="t-small m-auto max-w-[32ch] text-center text-ink-3">Ask about this page: what a figure means, or why it moved.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} data-role={m.role} className={cn('flex min-w-0 flex-col gap-1', m.role === 'user' && 'items-end')}>
              {m.role === 'assistant' ? <span className="t-caption">Assistant</span> : null}
              {m.role === 'user' && pageOf(m) ? <span className="t-caption">On {pageOf(m)}</span> : null}
              {m.role === 'user' ? (
                <p className="t-small max-w-full whitespace-pre-wrap rounded-lg bg-fill-hover px-3 py-2 text-ink [overflow-wrap:anywhere]">{textOf(m)}</p>
              ) : (
                m.parts.map((p, i) =>
                  p.type === 'text' ? (
                    // Markdown, not the model's text with its characters showing: every model this template has been
                    // pointed at answers in markdown, and a plain paragraph renders `**bold**`, `- ` bullets and
                    // `|---|` table rules literally. See `AssistantText`. The person's OWN message stays plain text,
                    // above: what they typed is what they meant to type.
                    p.text ? <AssistantText key={i} text={p.text} /> : null
                  ) : isMutation(p) ? (
                    <ProposalOf key={i} message={m} part={p as unknown as ToolPart} onDecide={onDecide} />
                  ) : null,
                )
              )}
            </div>
          ))
        )}
        {/* Between Send and the first words a model can take seconds; the thread says it is working, so the press is answered. */}
        {busy && !answering ? (
          <p className="t-small flex items-center gap-2 text-ink-3">
            <Spinner size="sm" label="Working on an answer" />
            Working on an answer
          </p>
        ) : null}
      </div>
      {error ? (
        <div className="shrink-0 px-3 pb-3">
          <Banner tone="critical" title={error} action={onRetry ? <Button size="sm" onClick={onRetry}>Retry</Button> : undefined} />
        </div>
      ) : null}
      <form
        className="flex shrink-0 items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          aria-label="Message"
          placeholder="Ask about this page"
          rows={1}
          maxRows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          className="resize-none"
        />
        <Button type="submit" variant="primary" icon={<ArrowUp />} aria-label="Send" disabled={!text || busy} className="w-(--control-md) px-0" />
      </form>
    </aside>
    </>
  );
}

/**
 * The assistant's state: the conversation and whether the panel is open. It lives in the shell, so it survives
 * navigation. The panel itself is not in the page while closed.
 */
export function AssistantColumn({ open, onClose, ask, onAsked }: { open: boolean; onClose: () => void; ask?: { id: number; text: string } | null; onAsked?: () => void }) {
  const path = usePathname();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/assistant',
        // The route takes the last 100 messages, as the thread keeps them, and the page the person is on now.
        // The page is read when the message is sent, from the address, so it is always the one on screen.
        prepareSendMessagesRequest: ({ messages }) => ({ body: { messages: recent(messages), page: readPage(location.pathname) } }),
      }),
    [],
  );
  const router = useRouter();
  const { messages, setMessages, sendMessage, regenerate, addToolApprovalResponse, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  // The thread loads once the page is on screen, never during render, and saves only after that.
  const [loaded, setLoaded] = useState(false);
  // A change that applied is on the page's data now: refresh once per tool part, never for one that applied before a reload.
  const refreshed = useRef(new Set<string>());
  useEffect(() => {
    const thread = loadThread(localStorage);
    for (const m of thread) for (const p of m.parts) if (isMutation(p)) refreshed.current.add((p as unknown as ToolPart).toolCallId);
    setMessages(thread);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the thread is an external store read once on mount; the server render never sees localStorage.
    setLoaded(true);
  }, [setMessages]);
  useEffect(() => {
    if (loaded) saveThread(localStorage, messages);
  }, [loaded, messages]);
  useEffect(() => {
    for (const m of messages) for (const p of m.parts) {
      const part = p as unknown as ToolPart;
      if (isMutation(p) && part.state === 'output-available' && !refreshed.current.has(part.toolCallId)) {
        refreshed.current.add(part.toolCallId);
        router.refresh();
      }
    }
  }, [messages, router]);
  // A question a card handed over (Ask): sent as the person's own, once the thread is loaded and no reply is streaming,
  // so it carries the page and its view context like a typed one.
  const sentAsk = useRef<number | null>(null);
  useEffect(() => {
    if (!ask || !loaded || sentAsk.current === ask.id || status === 'submitted' || status === 'streaming') return;
    sentAsk.current = ask.id;
    setMessages(closeOpenApprovals(messages, REASONS.movedOn));
    void sendMessage({ text: ask.text, metadata: { page: { path, title: readPage(path).title } } });
    onAsked?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a question arrives or the panel becomes able to send it.
  }, [ask, loaded, status]);
  if (!open) return null;
  return (
    <AssistantPanel
      messages={messages}
      busy={status === 'submitted' || status === 'streaming'}
      onSend={(text) => {
        setMessages(closeOpenApprovals(messages, REASONS.movedOn));
        sendMessage({ text, metadata: { page: { path, title: readPage(path).title } } });
      }}
      onDecide={(id, approved) => addToolApprovalResponse({ id, approved })}
      onClose={onClose}
      onClear={() => {
        setMessages([]);
        clearThread(localStorage);
      }}
      error={error?.message}
      onRetry={() => regenerate()}
    />
  );
}

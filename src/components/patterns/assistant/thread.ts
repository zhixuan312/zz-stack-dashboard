import type { UIMessage } from 'ai';
import { slug } from '../../../app.config';

/** One thread per browser for the whole console; it goes nowhere but the assistant route. */
export const THREAD_KEY = `${slug}.assistant`;
const KEEP = 100;

/** Why a change that was never answered is closed. */
export const REASONS = {
  reload: 'The page was reloaded before anyone approved it.',
  movedOn: 'You moved on before approving it.',
  interrupted: 'The page was reloaded before the change finished. Check the page to see whether it applied.',
} as const;

/** Every tool part in one of `states` becomes denied with the reason; nothing else changes. */
function close(messages: UIMessage[], states: string[], reason: string): UIMessage[] {
  const open = (p: unknown) => states.includes((p as { state?: string }).state ?? '');
  return messages.map((m) =>
    m.parts.some(open)
      ? {
          ...m,
          parts: m.parts.map((p) => {
            const part = p as unknown as { approval?: { id: string } };
            return open(p) ? ({ ...p, state: 'output-denied', approval: { id: part.approval?.id, approved: false, reason } } as unknown as typeof p) : p;
          }),
        }
      : m,
  );
}

/** Every tool part still waiting for an answer becomes denied with the reason; nothing else changes. */
export function closeOpenApprovals(messages: UIMessage[], reason: string): UIMessage[] {
  return close(messages, ['approval-requested'], reason);
}

/** The last 100 messages: what is stored, and what the panel sends. */
export function recent(messages: UIMessage[]): UIMessage[] {
  return messages.slice(-KEEP);
}

/**
 * The stored thread, with waiting changes closed as expired, and an approved change whose result never arrived closed
 * too, so it never runs again on the next message; empty when missing, broken or from another version.
 */
export function loadThread(storage: Storage): UIMessage[] {
  try {
    const raw = storage.getItem(THREAD_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as { v?: number; messages?: unknown };
    if (stored.v !== 1 || !Array.isArray(stored.messages)) return [];
    const messages = closeOpenApprovals(recent(stored.messages as UIMessage[]), REASONS.reload);
    return close(messages, ['approval-responded'], REASONS.interrupted);
  } catch {
    return [];
  }
}

/** Keeps the last 100 messages; an empty thread removes the key; over the quota it keeps the newer half and tries once more. */
export function saveThread(storage: Storage, messages: UIMessage[]): void {
  try {
    if (messages.length === 0) return storage.removeItem(THREAD_KEY);
    const kept = recent(messages);
    try {
      storage.setItem(THREAD_KEY, JSON.stringify({ v: 1, messages: kept }));
    } catch {
      storage.setItem(THREAD_KEY, JSON.stringify({ v: 1, messages: kept.slice(Math.floor(kept.length / 2)) }));
    }
  } catch {
    // Storage is unavailable or still full: the thread stays in memory for this visit.
  }
}

export function clearThread(storage: Storage): void {
  try {
    storage.removeItem(THREAD_KEY);
  } catch {
    // Nothing stored that could be removed.
  }
}

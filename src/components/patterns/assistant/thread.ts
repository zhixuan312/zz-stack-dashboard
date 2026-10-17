import type { UIMessage } from 'ai';
import { slug } from '../../../app.config';

/**
 * One thread per browser for the whole console, kept for the person and tenant it was started for (its scope); it goes
 * nowhere but the assistant route.
 */
export const THREAD_KEY = `${slug}.assistant`;
/**
 * The scope the console last loaded for in this browser: the person signed in now, since a page loads for whoever is.
 * A tab left open for another scope writes nothing while it is not this one.
 */
const CURRENT_KEY = `${THREAD_KEY}.scope`;
const current = (storage: Storage, scope: string) => storage.setItem(CURRENT_KEY, scope);
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

/** The stored thread as it was written: its scope and its messages; null when missing, broken or from another version. */
function stored(storage: Storage): { scope: string; messages: UIMessage[] } | null {
  const raw = storage.getItem(THREAD_KEY);
  if (!raw) return null;
  try {
    const thread = JSON.parse(raw) as { v?: number; scope?: unknown; messages?: unknown };
    return thread.v === 2 && typeof thread.scope === 'string' && Array.isArray(thread.messages) ? { scope: thread.scope, messages: thread.messages as UIMessage[] } : null;
  } catch {
    return null;
  }
}

/**
 * The stored thread of `scope`, with waiting changes closed as expired, and an approved change whose result never
 * arrived closed too, so it never runs again on the next message; empty when missing, broken or from another version.
 * A thread of another scope (another person, or the same person acting for another tenant) is removed, never shown.
 */
export function loadThread(storage: Storage, scope: string): UIMessage[] {
  try {
    current(storage, scope);
    const thread = stored(storage);
    if (!thread || thread.scope !== scope) {
      storage.removeItem(THREAD_KEY);
      return [];
    }
    const messages = closeOpenApprovals(recent(thread.messages), REASONS.reload);
    return close(messages, ['approval-responded'], REASONS.interrupted);
  } catch {
    return [];
  }
}

/** Removes the stored thread unless it is of `scope`, the one the console has loaded for. */
export function dropThread(storage: Storage, scope: string): void {
  try {
    current(storage, scope);
    if (stored(storage)?.scope !== scope) storage.removeItem(THREAD_KEY);
  } catch {
    // Storage is unavailable: nothing is stored that could be removed.
  }
}

/** Removes the stored thread if it is of `scope`: the one a refused request named, never another tab's of another scope. */
export function forgetThread(storage: Storage, scope: string): void {
  try {
    if (stored(storage)?.scope === scope) storage.removeItem(THREAD_KEY);
  } catch {
    // Storage is unavailable: nothing is stored that could be removed.
  }
}

/**
 * Keeps the last 100 messages of `scope`; an empty thread removes the key; over the quota it keeps the newer half and
 * tries once more. Nothing is written while the console has since loaded for another scope: another tab's person is
 * signed in now, and a tab left open for the earlier one, whenever its reply lands, neither replaces nor removes what
 * that person stored. It learns it is stale when the route refuses its next question.
 */
export function saveThread(storage: Storage, scope: string, messages: UIMessage[]): void {
  try {
    const now = storage.getItem(CURRENT_KEY);
    if (now !== null && now !== scope) return;
    if (messages.length === 0) return storage.removeItem(THREAD_KEY);
    const kept = recent(messages);
    try {
      storage.setItem(THREAD_KEY, JSON.stringify({ v: 2, scope, messages: kept }));
    } catch {
      storage.setItem(THREAD_KEY, JSON.stringify({ v: 2, scope, messages: kept.slice(Math.floor(kept.length / 2)) }));
    }
  } catch {
    // Storage is unavailable or still full: the thread stays in memory for this visit.
  }
}

/** Removes the stored thread, whoever's it is: signing out leaves none in the browser. */
export function clearThread(storage: Storage): void {
  try {
    storage.removeItem(THREAD_KEY);
    storage.removeItem(CURRENT_KEY);
  } catch {
    // Nothing stored that could be removed.
  }
}

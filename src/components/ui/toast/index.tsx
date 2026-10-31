'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';
import { keepHyphenated } from '../../base/text-roles/index';

export type ToastTone = 'positive' | 'critical' | 'neutral';
type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  /** Called once when the toast leaves, whichever way: its time ran out, Undo or Dismiss was pressed, or newer toasts pushed it out. */
  onClose?: () => void;
};
let listeners: ((t: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];
let seq = 0;
const emit = () => listeners.forEach((l) => l(items));

/** How long a toast with an action stays: the window an Undo has. A change held for an Undo commits when it ends. */
export const UNDO_MS = 8000;

/** Each shown toast's time left, and its timer while it runs. */
const clocks = new Map<number, { left: number; since: number; timer?: ReturnType<typeof setTimeout> }>();
/** Every clock waits while the pointer is over the stack or focus is in it, so an Undo is there for whoever reaches it. */
const holding = { pointer: false, focus: false };
const waiting = () => holding.pointer || holding.focus;
const run = (id: number) => {
  const c = clocks.get(id);
  if (!c) return;
  c.since = Date.now();
  c.timer = setTimeout(() => dismiss(id), c.left);
};
const hold = (why: keyof typeof holding, on: boolean) => {
  const was = waiting();
  holding[why] = on;
  if (!was && waiting()) for (const c of clocks.values()) { clearTimeout(c.timer); c.left -= Date.now() - c.since; }
  else if (was && !waiting()) for (const id of clocks.keys()) run(id);
};

/**
 * Confirm, in one line, something that just happened. It leaves on its own after five seconds; an Undo keeps it eight.
 * Neither counts while the pointer or focus is on the stack, so an Undo is still there for whoever is reaching it.
 */
export function toast(t: Omit<ToastItem, 'id'>) {
  const id = ++seq;
  const all = [...items, { ...t, id }];
  items = all.slice(-3);
  clocks.set(id, { left: t.action ? UNDO_MS : 5000, since: Date.now() });
  if (!waiting()) run(id);
  emit();
  for (const out of all.slice(0, -3)) close(out);
}
function close(t: ToastItem) {
  clearTimeout(clocks.get(t.id)?.timer);
  clocks.delete(t.id);
  t.onClose?.();
}
function dismiss(id: number) {
  const t = items.find((x) => x.id === id);
  if (!t) return;
  items = items.filter((x) => x.id !== id);
  // A toast that leaves under the pointer or with focus in it (Undo was pressed) sends no leave or blur.
  if (!items.length) holding.pointer = holding.focus = false;
  emit();
  close(t);
}

const ICON = { positive: CheckCircle2, critical: XCircle, neutral: Info };
const TONE = { positive: 'text-positive', critical: 'text-critical', neutral: 'text-ink-3' };

/** One toast, as drawn. The Toaster stacks these; a preview draws them statically. */
export function ToastView({
  tone = 'neutral',
  title,
  description,
  action,
  onDismiss,
  className,
}: {
  tone?: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}) {
  const Icon = ICON[tone];
  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={cn('pointer-events-auto flex w-full items-start gap-3 rounded-lg bg-surface-raised p-3.5 shadow-overlay', className)}
    >
      <Icon className={cn('mt-px size-4 shrink-0', TONE[tone])} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{keepHyphenated(title)}</p>
        {description ? <p className="mt-0.5 text-xs text-ink-2">{keepHyphenated(description)}</p> : null}
      </div>
      {action ? (
        <button type="button" className="press hit shrink-0 rounded-xs text-sm font-medium text-accent-ink hover:text-ink" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="press hit -mt-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Mounted once, in the providers: the stack in the bottom-right corner (top, full width, on phones). The stack is no
 * live region: each toast's own role announces it, once.
 */
export function Toaster() {
  // What is already raised: a toast sent before the Toaster mounted (the first thing a page does after hydration) used to
  // wait for the next emit and was never shown.
  const [list, setList] = useState<ToastItem[]>(() => items);
  const stack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listeners.push(setList);
    return () => void (listeners = listeners.filter((l) => l !== setList));
  }, []);
  // The focused toast left with its button, which sends no blur: focus is no longer in the stack.
  useEffect(() => { if (!stack.current?.contains(document.activeElement)) hold('focus', false); }, [list]);
  return (
    <div
      ref={stack}
      onPointerEnter={() => hold('pointer', true)}
      onPointerLeave={() => hold('pointer', false)}
      onFocus={() => hold('focus', true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hold('focus', false); }}
      className="pointer-events-none fixed inset-x-4 top-[max(16px,env(safe-area-inset-top))] z-(--layer-toast) flex flex-col gap-2 sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-[min(380px,calc(100vw-32px))]">
      {list.map((t) => (
        <ToastView
          key={t.id}
          tone={t.tone}
          title={t.title}
          description={t.description}
          action={t.action ? { label: t.action.label, onClick: () => { t.action!.onClick(); dismiss(t.id); } } : undefined}
          onDismiss={() => dismiss(t.id)}
          className="[animation:m-toast_var(--dur-enter)_var(--ease-out)]"
        />
      ))}
    </div>
  );
}

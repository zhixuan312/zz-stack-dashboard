'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type ToastTone = 'positive' | 'critical' | 'neutral';
type ToastItem = { id: number; tone: ToastTone; title: string; description?: string; action?: { label: string; onClick: () => void } };
let listeners: ((t: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];
let seq = 0;
const emit = () => listeners.forEach((l) => l(items));

/** Confirm, in one line, something that just happened. It leaves on its own after five seconds; an Undo keeps it eight. */
export function toast(t: Omit<ToastItem, 'id'>) {
  const id = ++seq;
  items = [...items, { ...t, id }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), t.action ? 8000 : 5000);
}
function dismiss(id: number) {
  items = items.filter((x) => x.id !== id);
  emit();
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
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-ink-2">{description}</p> : null}
      </div>
      {action ? (
        <button type="button" className="press shrink-0 rounded-xs text-sm font-medium text-accent-ink hover:underline" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className="press -mt-0.5 -mr-1 grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-fill-hover hover:text-ink">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Mounted once, in the providers: the stack in the bottom-right corner (bottom, full width, on phones). */
export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.push(setList);
    return () => void (listeners = listeners.filter((l) => l !== setList));
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 top-[max(16px,env(safe-area-inset-top))] z-(--layer-toast) flex flex-col gap-2 sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-[min(380px,calc(100vw-32px))]">
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

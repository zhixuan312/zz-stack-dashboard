import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/**
 * One section of Settings, laid out as Meridian's FormSection is: the title and what it is for on the left, its cards
 * on the right, one column on a narrow page. It is not FormSection itself because that wraps its card in a form with
 * one save bar, and these sections hold tables and forms of their own.
 */
export function SettingsSection({ title, description, children }: {
  title: ReactNode;
  /** What this section changes, for whom, in one or two sentences. */
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="@container">
      <div className="grid gap-x-10 gap-y-5 @3xl:grid-cols-[15rem_minmax(0,1fr)]">
        <header className="min-w-0 @3xl:pt-1">
          <h2 className="t-card">{title}</h2>
          {description ? <p className="t-small mt-2 text-pretty text-ink-2">{description}</p> : null}
        </header>
        <div className="flex min-w-0 flex-col gap-(--stack-gap)">{children}</div>
      </div>
    </section>
  );
}

/**
 * A card in a settings section. A table at its top keeps the card's edge as its only top line: the header row's own
 * top border would double it, and its sunk ground would cross the card's rounded corners.
 */
export function SettingsCard({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cn('overflow-hidden [&_thead_th]:border-t-0', className)}>{children}</Card>;
}

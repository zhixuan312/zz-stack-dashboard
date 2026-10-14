'use client';

import type { FormEvent, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Banner } from '../../ui/banner/index';
import { Button } from '../../ui/button/index';
import { useUnsavedChanges } from '../../base/shell/index';

/** The title column and the card column, shared by the form and the layout-only variant. */
const GRID = 'grid gap-x-10 gap-y-5 @3xl:grid-cols-[15rem_minmax(0,var(--field-width))]';

/**
 * A titled group of settings that saves on its own. Its title and one sentence sit on the left, the fields in a card on
 * the right (stacked on narrow widths). With `onSave`, editing shows a save bar that stays in view until the change is
 * saved or discarded; without it, every control applies at once and the section says so. `tone="critical"` is the
 * danger zone.
 *
 * `as="div"` is the same layout with no `<form>` around it, for a section that cannot have one: a card holding a table
 * that runs edge to edge (access tokens, people, members), or a form of its own, since forms cannot nest. It has no
 * save bar — nothing submits — so its children save themselves. `flush` drops the body's padding for that table.
 */
export function FormSection({
  title,
  description,
  children,
  dirty = false,
  saving = false,
  error,
  readOnly,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
  tone = 'default',
  as = 'form',
  flush = false,
  footnote,
  className,
}: {
  title: ReactNode;
  /** What these settings change, for whom, in one or two sentences. */
  description?: ReactNode;
  children: ReactNode;
  /** The values differ from what is saved: show the save bar, and ask before the person leaves the page. */
  dirty?: boolean;
  saving?: boolean;
  /** Why the last save failed, and what to do. Shown above the fields. */
  error?: ReactNode;
  /** The reader may see but not change these: say who can, instead of disabling silently. */
  readOnly?: ReactNode;
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void;
  saveLabel?: string;
  tone?: 'default' | 'critical';
  /** `div` renders no `<form>`, for a card that holds a table or a form of its own. See the doc comment. */
  as?: 'form' | 'div';
  /** No padding around the body: for a table that runs edge to edge. */
  flush?: boolean;
  /** A quiet line under the fields: "Changes apply at once". */
  footnote?: ReactNode;
  className?: string;
}) {
  // Inside the shell, leaving while this is dirty asks first; the save bar is the answer to that question.
  useUnsavedChanges(dirty);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && !saving) void onSave?.();
  };
  const body = cn(
    'm-0 flex min-w-0 flex-col border-0',
    // The same rule Card and CardBody apply to a table as the first child, in the shape this body is built from: the
    // Table component wraps its table in a div, so the table is one level down, and `data-flush` is how the card above
    // knows to clip its own rounded corner.
    flush
      ? 'has-[>div:first-child>table]:overflow-hidden [&>div:first-child>table>thead>tr>th]:border-t-0'
      : 'gap-5 p-(--card-pad)',
  );
  const inner = (
    <>
      {error ? <Banner tone="critical" title="Not saved">{error}</Banner> : null}
      {readOnly ? (
        <p className="flex items-center gap-2 rounded-md bg-surface-sunk px-3 py-2 text-xs text-ink-2"><Lock className="size-3.5 shrink-0 text-ink-3" />{readOnly}</p>
      ) : null}
      {children}
    </>
  );
  // The two columns, in the shape both variants share. Built once and placed inside whichever element wraps it, rather
  // than a wrapper component chosen per render: a component defined here would be a new type on every render, and React
  // would remount the fields inside it, dropping focus on each keystroke.
  const cols = (
    <>
    <header className="min-w-0 @3xl:pt-1">
      <h2 className={cn('t-card', tone === 'critical' && 'text-critical-ink')}>{title}</h2>
      {description ? <p className="t-small mt-2 text-pretty text-ink-2">{description}</p> : null}
    </header>
    <div className="min-w-0">
      <div className={cn('relative rounded-lg border bg-surface shadow-card', tone === 'critical' ? 'border-critical/30' : 'border-line', flush && 'has-[>[data-flush]:first-child]:overflow-hidden')}>
        {as === 'form' ? (
          // Read-only is not unavailable: its values are what the reader came for, so they stay legible in ink-2.
          <fieldset data-flush={flush ? '' : undefined} disabled={Boolean(readOnly) || saving} className={cn(body, readOnly && '[&_button:disabled]:text-ink-2 [&_input:disabled]:text-ink-2 [&_textarea:disabled]:text-ink-2')}>{inner}</fieldset>
        ) : (
          <div data-flush={flush ? '' : undefined} className={body}>{inner}</div>
        )}
        {onSave && as === 'form' ? (
          <div
            aria-hidden={!dirty}
            className={cn(
              'sticky bottom-4 z-10 grid transition-[grid-template-rows,opacity] duration-(--dur-enter) ease-out',
              dirty ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 rounded-b-lg border-t border-line bg-surface-raised/90 px-(--card-pad) py-3 backdrop-blur-md">
                <p className="flex items-center gap-2 text-sm text-ink-2"><span aria-hidden className="size-1.5 rounded-full bg-accent" />Unsaved changes</p>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving} tabIndex={dirty ? 0 : -1}>Discard</Button>
                  <Button type="submit" variant="primary" size="sm" busy={saving} tabIndex={dirty ? 0 : -1}>{saveLabel}</Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {footnote ? <p className="t-caption mt-2.5">{footnote}</p> : null}
    </div>
    </>
  );
  return (
    <section className={cn('@container', className)}>
      {as === 'form' ? <form onSubmit={submit} className={GRID}>{cols}</form> : <div className={GRID}>{cols}</div>}
    </section>
  );
}

/** A row inside a section for a control that is not a text field: label and description on the left, the control on the right. */
export function SettingRow({ label, description, children, className }: { label: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-line pt-5 first:border-0 first:pt-0', className)}>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="t-caption mt-1 text-pretty">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

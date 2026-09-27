import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardTitle } from '@/components/ui';

/**
 * DocumentShell — the shared stage-document shell: a constant header (title + version badge)
 * and an optional approvers row, over the document itself, plus an optional action row.
 * Content-agnostic — the body, approvers, and actions are passed in.
 *
 * One view, so there is no tab state left here. There were two until the Discussion tab came
 * out with the thread it read: a document is read, and nothing beside it swaps.
 */
export function DocumentShell({
  title,
  version,
  approvers,
  body,
  actions,
}: {
  title: ReactNode;
  version?: number;
  /** Who has approved the document. */
  approvers?: ReactNode;
  body: ReactNode;
  /** Buttons for the right-aligned action row (Approve / Revoke); the shell draws the row. */
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {/* Wraps on a narrow card: the title takes the row. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* CardTitle, not a bespoke <p>, so a document header carries the same face and
                weight as every other card header. */}
            <CardTitle className="break-words">{title}</CardTitle>
            {version != null ? <Badge variant="sage" size="sm">v{version}</Badge> : null}
          </div>
        </div>
        {approvers}
        {/* The body is its content's height and the page scrolls. Its padding and tint are
            owned here rather than by the consumer. */}
        <div className="min-w-0 bg-surface-2/40 px-5 py-5">
          {body}
        </div>
        {actions ? (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {actions}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

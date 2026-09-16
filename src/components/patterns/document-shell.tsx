import type { ReactNode } from 'react';
import { Badge, Card, CardContent, CardTitle, TabBar } from '@/components/ui';

/**
 * DocumentShell — the shared stage-document shell: a constant header (title + version badge +
 * a segmented tab bar) and an optional approvers row, over a body that swaps by tab, plus an
 * optional footer (approve action / composer). Content-agnostic — the body, approvers, and
 * footer are passed in.
 */
export interface DocumentShellTab {
  id: string;
  label: string;
}

export function DocumentShell({
  title,
  version,
  tabs,
  activeTab,
  onTabChange,
  approvers,
  body,
  actions,
  footer,
}: {
  title: ReactNode;
  version?: number;
  tabs: readonly DocumentShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Who has approved the DOCUMENT. Rendered only on the document tab — see `actions`. */
  approvers?: ReactNode;
  body: ReactNode;
  /** Buttons for the standard right-aligned action row (Approve / Revoke). The shell draws
   *  the row so consumers stop re-spelling `justify-end … border-t … px-5 py-3`.
   *
   *  Like `approvers`, this is DOCUMENT-level chrome and renders only on the document tab
   *  (`tabs[0]`). The body swaps per tab but these two used to sit above/below it and never
   *  did, so Spec's Audit tab showed an approvers row and an Approve button over a list of
   *  audit findings — nothing on that tab is approvable. Scoping it here means a consumer
   *  cannot leak it onto a findings or discussion tab. `footer` is NOT scoped: the apply bar
   *  and the composer legitimately belong to those tabs. */
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  // Document-level chrome shows on the document view only. Every tab set in the app puts
  // that view first.
  const onDocumentTab = activeTab === tabs[0]?.id;

  return (
    <Card>
      <CardContent className="p-0">
        {/* WRAPS on a narrow card: the title takes the row and the tabs drop beneath it. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* CardTitle, not a bespoke <p> — every other card header in the app uses it, and
                hand-rolling one here made document headers a different face and weight. */}
            <CardTitle className="break-words">{title}</CardTitle>
            {version != null ? <Badge variant="sage" size="sm">v{version}</Badge> : null}
          </div>
          <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        </div>
        {onDocumentTab ? approvers : null}
        {/* THE BODY IS ITS CONTENT'S HEIGHT and the page scrolls. Its padding and tint are
            owned here: consumers had drifted across five spellings of the same surface,
            which is exactly what a governed shell exists to prevent. */}
        <div className="min-w-0 bg-surface-2/40 px-5 py-5">
          {body}
        </div>
        {actions && onDocumentTab ? (
          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            {actions}
          </div>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}

'use client';

import { cn } from '@/lib/cn';

/**
 * TabBar — the segmented switcher that sits at the right of a panel header. Shared so the
 * toggle looks identical wherever it appears, whether or not the panel is a document:
 * `DocumentShell` uses it for Spec ⋅ Audit / Plan ⋅ Discussion, and Explore uses it for
 * Brain-dump ⋅ Tasks, which are plain Content-Shell panels rather than documents.
 *
 * Omit `onTabChange` for a read-only bar (the caller drives the active tab elsewhere).
 */
interface TabBarTab {
  id: string;
  label: string;
}

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  tabs: readonly TabBarTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}) {
  if (tabs.length === 0) return null;
  return (
    <div
      role="tablist"
      // DELIBERATE: `w-fit` — a segmented control is the size of its segments. Without it
      // a block-level child of a flex column stretches to the full page width.
      className={cn('flex w-fit max-w-full flex-wrap items-center rounded-[var(--r)] border border-line bg-surface-2 p-0.5', className)}
    >
      {tabs.map((t) =>
        onTabChange ? (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-[var(--r-sm)] px-3 py-1 text-xs font-medium transition-colors',
              activeTab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ) : (
          // Still a `tab`, just not operable: a `role="tablist"` whose children are plain
          // spans is a tablist with no tabs, and which tab is current is then left to the
          // background colour alone.
          <span
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            aria-disabled="true"
            className={cn(
              'shrink-0 whitespace-nowrap rounded-[var(--r-sm)] px-3 py-1 text-xs font-medium',
              activeTab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint',
            )}
          >
            {t.label}
          </span>
        ),
      )}
    </div>
  );
}

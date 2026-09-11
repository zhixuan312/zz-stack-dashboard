import { PageFrame } from '@/components/ui';
import { SkeletonPage } from '@/components/ui/skeleton';

/**
 * The route-level busy state, shared by every page in the group.
 *
 * Without a `loading.tsx`, Next holds the OLD screen on the router transition
 * while the next route's data resolves. The reader clicks a nav item, the
 * highlight moves, and the content underneath stays on the previous page for as
 * long as the query takes — which reads as a dead link, not as loading.
 *
 * The frame is real (the header and rail are already there); only the body is a
 * skeleton, so the shell does not flash. Per-route overrides go in a
 * `loading.tsx` beside that route's `page.tsx` when its shape differs enough to
 * cause a jump — the Records table, say, is one tall panel rather than a
 * metric row over two.
 */
export default function DashLoading() {
  return (
    <PageFrame title="…" width="full" fill>
      <SkeletonPage />
    </PageFrame>
  );
}

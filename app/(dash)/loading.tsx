import { PageFrame } from '@/components/ui';
import { SkeletonPage } from '@/components/ui/skeleton';

/**
 * The route-level busy state, shared by every page in the group.
 *
 * Without a `loading.tsx`, Next holds the previous screen on a router transition
 * while the next route's data resolves: the nav highlight moves and the content
 * under it does not.
 *
 * The frame is real (the header and rail are already there); only the body is a
 * skeleton, so the shell does not flash. A route whose shape differs enough to
 * cause a jump gets its own `loading.tsx` beside its `page.tsx`.
 */
export default function DashLoading() {
  return (
    <PageFrame title="…">
      <SkeletonPage />
    </PageFrame>
  );
}

import { LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';

/**
 * The shell's own fallback, which names no page.
 *
 * Every route has its own `loading.tsx` with its page's title, because each page asks the gate at request time and the
 * title is what says a navigation has arrived. This boundary sits above all of them, and every route's prerendered shell
 * holds it pending ahead of the route's own content for as long as the parse takes, so it may be painted on any route:
 * it carries no title, or a direct load of `/teams` could open on another page's name.
 */
export default function DashLoading() {
  return (
    <LoadingPage name="page">
      <TableSkeleton rows={8} filters={false} />
    </LoadingPage>
  );
}

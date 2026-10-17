import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** The rows a page of the feed holds, so the skeleton is the feed's height. COUPLED: `PAGE_SIZE` in the context. */
const ROWS = 10;

/**
 * Audit on its way, in the shape of its default address: the two tabs' strip, then the card of acts of administration,
 * a mark and a line for each act, with the pager under them. It names nothing, so it stands for the page under
 * `refusal: 'absent'` as well as anywhere else.
 */
export function AuditSkeleton() {
  return (
    <>
      <div className="flex h-10 items-center gap-6 border-b border-line">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Card>
        <div className="flex flex-col gap-2 px-(--card-pad) pt-(--card-pad)">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <CardBody>
          <div className="flex flex-col gap-4">
            {Array.from({ length: ROWS }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-12 shrink-0" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

'use client';

import { Pagination, type usePaged } from '@/components/ui/pagination';

/** The pager under a paged list inside a settings card (Meridian's `usePaged`), shown only when there is more than one page. */
export function PageControl({ paged, pagination, noun = 'rows' }: Pick<ReturnType<typeof usePaged>, 'paged' | 'pagination'> & { noun?: string }) {
  if (!paged) return null;
  return (
    <div className="border-t border-line px-(--card-pad) py-2.5">
      <Pagination {...pagination} noun={noun} pageSizes={[10, 20, 50]} />
    </div>
  );
}

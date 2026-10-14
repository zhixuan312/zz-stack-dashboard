import type { PageWidth } from '@/components/base/shell';
import { LoadingPage } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Settings on its way: each section's head column beside its card, at the page's own width.
 *
 * Settings is the one page whose width is not the canvas's. It is read at `form`, the measure its own head column and
 * field-width card add up to. A skeleton at `data` filled 2560px and the page then arrived at 1253px centred: the whole
 * layout jumped sideways at the moment the content appeared, which is the one thing a loading state exists to prevent.
 * `--form-width` is `calc()` over those parts, so this stands exactly where the page will.
 */
const width: PageWidth = 'form';

export default function SettingsLoading() {
  return (
    <LoadingPage name="settings" title="Settings" width={width}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="@container">
          <div className="grid gap-x-10 gap-y-5 @3xl:grid-cols-[15rem_minmax(0,var(--field-width))]">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      ))}
    </LoadingPage>
  );
}

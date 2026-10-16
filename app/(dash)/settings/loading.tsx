import type { PageWidth } from '@/components/base/shell';
import { LoadingPage } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Settings on its way: each section's head column beside its card, at the page's own width and in the page's own stack.
 *
 * Settings is the one page whose width is not the canvas's. It is read at `form`, the measure its own head column and
 * field-width card add up to. A skeleton at `data` filled 2560px and the page then arrived at 1253px centred: the whole
 * layout jumped sideways at the moment the content appeared, which is the one thing a loading state exists to prevent.
 * `--form-width` is `calc()` over those parts, so this stands exactly where the page will.
 *
 * The page spaces its sections by `gap-14`, wider than the frame's own stack gap, so this holds that same wrapper:
 * spaced like the frame instead, every section below the first moves down when the page arrives.
 */
const width: PageWidth = 'form';

/**
 * One placeholder section per section the page draws. The page drops the later ones for a person who administers
 * nothing and for a console with no assistant, so a member's own page is shorter than this frame. A card's height is
 * whatever its fields come to, which nothing here can know: one height, so nothing below the frame jumps twice.
 */
const SECTIONS = 7;

export default function SettingsLoading() {
  return (
    <LoadingPage name="settings" title="Settings" width={width}>
      <div className="flex flex-col gap-14">
        {Array.from({ length: SECTIONS }, (_, i) => (
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
      </div>
    </LoadingPage>
  );
}

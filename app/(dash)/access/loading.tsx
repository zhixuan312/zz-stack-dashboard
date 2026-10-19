import { app, workspaces } from '@/app.config';
import type { PageWidth } from '@/components/base/shell';
import { Skeleton } from '@/components/ui/skeleton';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Access on its way: each section's head column beside its card, at the page's own width and in the page's own stack.
 *
 * Access is read at `form`, the measure its head column and field-width card add up to, so this stands exactly where
 * the page will: a skeleton at `data` would fill the canvas and the page then arrive narrower and centred. The page
 * spaces its sections by `gap-14`, wider than the frame's own stack gap, so this holds that same wrapper.
 *
 * Its heading is drawn here for a person whose rail offers Access (`OfferedLoading`), so a press in the rail lands on
 * it at once rather than with the page's own masthead.
 */
const width: PageWidth = 'form';

/**
 * One placeholder section per section the page can stack, for the tallest page: a person who administers the team
 * they act for, on a console with an assistant. Anybody else's page is shorter, and nothing below its last section
 * moves. COUPLED: `AccessSkeleton` in `src/views/pages/access.tsx`, the same frame once the gate has answered.
 */
const SECTIONS = 8;

/** The page's own line under its title. COUPLED: `app/(dash)/access/page.tsx`. */
const DESCRIPTION = 'What lets you and your agents in: your tokens, the applications and browsers signed in as you, your passkeys and the team you act for.';

export default function AccessLoading() {
  return (
    <OfferedLoading href="/access" kicker={<>{app.name} · {workspaces.main.label}</>} description={DESCRIPTION} width={width}>
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
    </OfferedLoading>
  );
}

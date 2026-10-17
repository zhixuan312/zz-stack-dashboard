import type { ReactNode } from 'react';
import { PageFrame, Row, Stack, type PageWidth } from '../../base/shell/index';
import { Card } from '../../ui/card/index';
import { Skeleton } from '../../ui/skeleton/index';

/**
 * The frame every console route's loading state shares: one masthead skeleton, then the page's own body, announced once
 * as busy under the page's name. Each route's `loading.tsx` composes its body from these rows, in the shape of its page.
 * The title is the page's own heading, so the shell is acknowledged the moment this state commits; a detail page whose
 * title depends on the record leaves it out and keeps a skeleton. `sentence` says the page is headed by a sentence
 * about its figures: the title is then the page's name, kept in the heading and not drawn, and the frame holds the
 * sentence's block with its placeholder, so the heading is the same height here as on the page that replaces it.
 * `width` follows the page it stands in for: a skeleton at another width would move the content when the page arrives.
 *
 * The rest of the masthead is held the same way, for a page that knows it: `kicker` is the page's own (it needs no
 * data), `lead` keeps the room of a long sentence under the title (`LeadRoom`), `description` is the room of a line of
 * the page's own that is not one (One customer's line of figures), `meta` is the page's freshness and `actions` stands
 * where the page's controls will, as wide as they are. A masthead that keeps every one of them is as tall here as on
 * the page, so the body starts where it will stay.
 */
export function LoadingPage({ name, title, sentence, width, kicker, lead, description, meta, actions, children }: {
  name: string;
  title?: string;
  sentence?: boolean;
  width?: PageWidth;
  /** The page's kicker, when it reads no data. A skeleton otherwise. */
  kicker?: ReactNode;
  /** The sentence under the title is a long one, a line of figures and who the page is for: its room is kept (`LeadRoom`). */
  lead?: boolean;
  /** What stands where the page's line under the title will, in its room, for a line the page keeps a room of its own for. */
  description?: ReactNode;
  /** The page's freshness, when it reads no data. */
  meta?: ReactNode;
  /** What stands where the page's actions will: the same width, so the masthead's last row wraps as the page's does. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  // A page headed by a sentence gives the frame its name and no title, which is how the frame is asked for the placeholder.
  const heading = sentence && title ? { name: title } : { title: title ?? <Skeleton className="mt-3 h-10 w-64 rounded-md" /> };
  return (
    <PageFrame
      width={width}
      kicker={kicker ?? <Skeleton className="h-2.5 w-32" />}
      {...heading}
      description={description ?? (lead ? <LeadRoom /> : <Skeleton className="mt-2 h-3.5 w-96 max-w-full" />)}
      meta={meta}
      actions={actions}
    >
      <Busy name={name}>{children}</Busy>
    </PageFrame>
  );
}

/**
 * The room a long sentence under a page's title takes: a line of the page's figures and who the page is for, up to
 * about 220 characters (Home's, 212 in the sample). The room is kept whether the sentence fills it or not, so the
 * placeholder, the page's own fallback and the sentence are one height, and the body under the masthead does not
 * move when one takes another's place. The page draws its sentence inside it, and its fallback is it, empty.
 *
 * The steps are in ems of the lead's own size, read against the sentence's own column, which is at most 60 characters
 * wide (636px in Geist at 16px): three lines from 34em, four from 25em, five from 21em and six under that. They were
 * worked out from the face's advance widths, breaking lines as a browser does: the sample's longest sentence takes
 * three lines at 636px and 560px, four from 400px to 528px, five from 336px to 380px (a 390px phone is 358px) and six
 * at 320px.
 *
 * The room is its own block formatting context (`flow-root`): the bars' vertical margins stay inside it. As a plain
 * block, the first bar's top margin passed through the room and the paragraph around it and was added to the masthead's
 * row, which made the loading state 7px taller than the page that replaced it.
 */
const LEAD_ROOM = 'flow-root min-h-[6lh] @min-[21em]:min-h-[5lh] @min-[25em]:min-h-[4lh] @min-[34em]:min-h-[3lh]';

export function LeadRoom({ children }: { children?: ReactNode }) {
  return (
    <span data-lead-room className="@container block">
      <span className={LEAD_ROOM}>
        {children ?? (
          <>
            {/* The sentence on its way: a bar a line, each bar and its margins one line of the lead. */}
            <Skeleton className="my-[0.3lh] h-[0.4lh] w-full" />
            <Skeleton className="my-[0.3lh] h-[0.4lh] w-full" />
            <Skeleton className="my-[0.3lh] h-[0.4lh] w-3/5" />
          </>
        )}
      </span>
    </span>
  );
}

/**
 * A page's body while it streams, announced once as busy under the page's name. `loading.tsx` shows it under the
 * masthead skeleton; a page whose masthead is already real uses it as its own Suspense fallback.
 */
export function Busy({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${name}`} className="contents">
      <Stack>{children}</Stack>
    </div>
  );
}

/** A row of metric tiles: three unless the page has another number. */
export function TilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Row split="tiles">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3 p-(--card-pad)">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="mt-auto h-8 w-full" />
        </Card>
      ))}
    </Row>
  );
}

/** A card with a title and a chart-sized block. */
export function ChartSkeleton({ height = 'h-40' }: { height?: string }) {
  return (
    <Card className="gap-4 p-(--card-pad)">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-64 max-w-full" />
      <Skeleton className={`${height} w-full rounded-md`} />
    </Card>
  );
}

/** A card holding a data table: a filter bar over `rows` rows. */
export function TableSkeleton({ rows = 8, filters = true }: { rows?: number; filters?: boolean }) {
  return (
    <Card className="gap-4 p-(--card-pad)">
      {filters ? (
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-64 max-w-full rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      ) : null}
      <Skeleton className="h-3 w-full" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-4" />)}
    </Card>
  );
}

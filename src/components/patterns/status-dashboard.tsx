import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { MetricRow, MetricCard, type MetricCardProps } from '@/components/ui/metric-card';

export interface StatusDashboardProps {
  /** Optional metrics row across the top — omitted / empty renders no row. */
  metrics?: MetricCardProps[];
  /** The 2/3 main work surface (or full-width when there's no `aside`). */
  primary: ReactNode;
  /** The 1/3 rail. When present the body becomes a 2/3 + 1/3 split. */
  aside?: ReactNode;
  /**
   * Rail alignment on the cross axis. `stretch` (default) makes the rail match the
   * primary's height — the dashboard look. `start` top-aligns the rail against the
   * primary — the settings look (a form beside a shorter guidance rail).
   */
  align?: 'stretch' | 'start';
  /** Who owns the scroll in the 2/3 column. `inner` (default) when a SINGLE item fills it
   *  and scrolls itself — a table body, a document body, a list. `outer` when the panel
   *  STACKS several cards and the column must scroll past them. */
  scroll?: 'inner' | 'outer';
  className?: string;
}

/** The same pane, from `lg` up. Spelled out literally, NOT built at runtime: Tailwind
 *  scans source text, so a computed class string generates no CSS — the identical trap
 *  that made the `@utility` version silently do nothing. */
const SCROLL_PANE_LG =
  'lg:min-h-0 lg:overflow-y-auto lg:-mx-3 lg:-mt-3 lg:-mb-6 lg:px-3 lg:pt-3 lg:pb-6';

export function StatusDashboard({ metrics, primary, aside, align = 'stretch', scroll = 'inner', className }: StatusDashboardProps) {
  // `flex-1` as well as `h-full`: a page may render this as a flex ITEM below some other
  // bar, and `h-full` there means 100% of the PARENT — the full height, as if the bar took
  // none. The dashboard then overflows by the bar's height, and because PageFrame stops the
  // page scrolling, the overflow is simply clipped and the column's scroll-pane never gets a
  // correct bound. `flex-1` claims the REMAINING space instead. (In a column, flex-basis:0
  // wins over height:100%, so the two don't fight; when the parent isn't a flex container,
  // flex-1 is inert and h-full still applies.)
  // Below `lg` the two panels stack and the per-column scroll panes do NOT apply, so the
  // shell itself must scroll. Relying on the PAGE scrolling there does not work: PageFrame
  // `fill` sets overflow-hidden at EVERY width, so under `lg` (including a zoomed browser,
  // where the CSS viewport shrinks) there would be no scroller at all and content would be
  // clipped outright. From `lg` up this goes back to visible so the columns own their scroll
  // and the cards' hover bloom isn't trimmed at the shell edge.
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-1 flex-col gap-4',
        'overflow-y-auto overflow-x-hidden lg:overflow-visible',
        className,
      )}
    >
      {metrics && metrics.length > 0 ? (
        <MetricRow className="shrink-0">
          {metrics.map((m, i) => (
            <MetricCard key={i} {...m} />
          ))}
        </MetricRow>
      ) : null}

      {aside ? (
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3',
            // The row must be bounded too, not just the grid box. With the default
            // `auto` row the track sizes to the TALLEST column, so a long panel makes the
            // row overflow the container and the columns' scroll-pane has nothing to
            // scroll inside — the panel just runs past the bottom of the shell.
            'lg:grid-rows-[minmax(0,1fr)]',
            // `start` top-aligns the rail — but a column can only scroll when it is
            // height-bounded, so a panel that owns its scroll must stretch regardless.
            align === 'start' && scroll !== 'outer' ? 'lg:items-start' : 'lg:items-stretch',
          )}
        >
          {/* In the dashboard (`stretch`) look the two panels are height-bounded, so each
              scrolls INTERNALLY on desktop (`lg:overflow-y-auto`) — the left work surface and
              the right rail scroll independently instead of overflowing or scrolling the page.
              On mobile (stacked) and in the `start`/settings look the page scrolls instead. */}
          {/* WHO SCROLLS depends on what is in the panel:
              - `inner` (default): ONE item fills the 2/3 column and scrolls inside itself —
                a table body, a document body, a list. The column must NOT scroll, or the
                item and the column both would.
              - `outer`: the panel STACKS several cards (a chart above a table, two forms
                side by side), so the column scrolls past them.
              A scroll container clips on every side, so in `outer` a card's hover bloom is
              trimmed at the column edge. Do NOT "fix" that with `-m-* p-*`: the negative
              margin pulls the scroller outside its grid cell and scrolled content bleeds
              over the metrics row. */}
          <div
            className={cn(
              // `gap-4` to match the rail column. Without it, two stacked panels
              // in this column share an edge and read as one merged block with a
              // stray rule through it — the Overview's chart and its bar list
              // were welded together, and the Health page's danger banner was
              // glued to the top of the list below it. The rail column has
              // always had the gap; only this one was missing it, which is why
              // the asymmetry survived so long: every page that used a rail
              // looked fine on the right-hand side.
              'flex min-h-0 flex-col gap-4 lg:col-span-2',
              // Independent of `align`: that governs the rail's cross-axis alignment, this
              // governs who scrolls. Coupling them leaves every `align="start"` page with no
              // scroller at all once PageFrame stops scrolling the page.
              // `SCROLL_PANE_LG` owns the overflow AND the clearance that keeps the cards'
              // hover bloom from being clipped by this scroller.
              scroll === 'outer' && SCROLL_PANE_LG,
              // Panels must keep their content height and let this column
              // scroll. Without it they are flex items that CAN be squashed:
              // `min-height: auto` resolves to 0 for a scroll container, and
              // `Card` is `overflow-hidden`, so a stack of cards silently
              // compressed and clipped its own content instead of overflowing.
              '[&>*]:shrink-0',
            )}
          >
            {primary}
          </div>
          <div
            className={cn(
              'flex min-h-0 flex-col gap-4',
              // Filling the leftover height is OPT-IN, via `data-rail-fill` on
              // the panel that should stretch.
              //
              // It used to be the default for the last child, on the reasoning
              // that a rail which stops short looks like it failed to load.
              // That holds for a panel with a LIST in it — the list wants the
              // room. It is actively wrong for a short facts panel: four rows
              // of label/value stretched to 500px is a large empty white box
              // with a border around it, which reads as a rendering bug, not as
              // a full-height rail. Empty space on the page ground reads as
              // deliberate; an empty bordered box never does.
              //
              // `grow` (flex-grow:1, basis auto) NOT `flex-1` (basis 0): basis 0
              // would let a tall panel be squashed instead of making the column
              // scroll.
              '[&>*[data-rail-fill]]:grow',
              // Same crush as the primary column — rail panels were being
              // squeezed to as little as 0px with their content clipped.
              // `shrink-0` and `grow` are independent, so the last child still
              // stretches into spare room.
              '[&>*]:shrink-0',
              // The rail scrolls and clips too — same governed pane.
              SCROLL_PANE_LG,
            )}
          >
            {aside}
          </div>
        </div>
      ) : (
        // `flex … flex-col`, not just `min-h-0 flex-1`.
        //
        // The two-column branch above gives the primary column
        // `flex min-h-0 flex-col`, so a panel inside it can claim the height
        // with `flex-1` and hand a bound to whatever scrolls inside. This
        // branch did not: `flex-1` on the child was inert because the parent
        // was not a flex container, so a full-height DataTable grew to its
        // content height — 35,616px on the Runs page — and was CLIPPED by the
        // Card's `overflow-hidden` instead of scrolling. The page looked
        // truncated with no scrollbar, and only on rail-less pages, which is
        // why Routes (which has a rail) scrolled fine and Runs did not.
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-4',
            // ...AND it must own a scroller, exactly as the two-column branch does.
            //
            // This branch honoured `flex-1` but ignored `scroll` altogether, so a
            // rail-less page that STACKS cards had no scroll region anywhere: the
            // wrapper above goes `lg:overflow-visible` on the reasoning that the
            // columns scroll themselves, and this column never did. PageFrame `fill`
            // then clipped the overflow and the page simply ended mid-card, with no
            // scrollbar to say so — visible only at `lg` and up, which is where it
            // was least likely to be caught in a narrow test window.
            //
            // The comment above already records this failure for the case where a
            // single tall child fills the column. Stacking is the other half of it,
            // and removing a page's rail note is all it takes to move a working page
            // from that branch into this one.
            scroll === 'outer' && SCROLL_PANE_LG,
            // Same crush as the two-column primary: a Card is `overflow-hidden`, so a
            // shrinkable flex item silently compresses and clips itself rather than
            // making this column scroll.
            '[&>*]:shrink-0',
          )}
        >
          {primary}
        </div>
      )}
    </div>
  );
}

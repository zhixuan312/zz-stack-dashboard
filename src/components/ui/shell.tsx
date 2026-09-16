import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Title, Text } from '@/components/ui/typography';
import { Breadcrumb, type Crumb } from '@/components/ui/breadcrumb';
import { SidebarDrawer } from '@/components/ui/sidebar-drawer';
import { GUTTER, GUTTER_X, WIDTH, type PageWidth } from '@/components/ui/layout';

/**
 * App shell — the locked dashboard frame.
 *
 *   AppShell            full-viewport, never scrolls as a whole
 *   ├─ sidebar          fixed rail, own scroll
 *   └─ content column   flex-col, overflow-hidden — does NOT scroll
 *        ShellHeader    static row  — permanent header
 *        ShellSubNav    static row  — optional second nav (some screens)
 *        ShellBody      flex-1, overflow-y-auto — the ONLY scroll region
 *
 * The header/sub-nav are STATIC flex rows OUTSIDE the scroll region, and only
 * `ShellBody` scrolls. This is deliberate: a `position: sticky` header inside a
 * sub-scroller recomputes its offset on the main thread, so a fast fling can
 * out-run it for a frame before it snaps back (visible "header jitter"). With
 * the header physically outside the scrolling element, it cannot move at all —
 * jank-free by construction, not by compositor luck.
 *
 * The shell owns no navigation of its own: `sidebar` is whatever the app layout
 * renders into the rail.
 */
export function AppShell({
  sidebar,
  topRight,
  children,
  className,
}: {
  sidebar: ReactNode;
  /** Global utilities pinned to the top-right corner, sitting in the page-header
   *  band above the scroll body. */
  topRight?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // `fixed inset-0` pins the whole frame to the viewport so the PAGE never
  // scrolls. The content column is a non-scrolling flex stack; ShellBody (a
  // flex child reached through the `display:contents` page chain) is the scroller.
  return (
    <div className={cn('app-bg fixed inset-0 isolate flex overflow-hidden', className)}>
      {/* The static rail, desktop only. Below `lg` the same node is rendered by
          `SidebarDrawer` as an overlay — see the header below. A 232px rail on a
          390px screen leaves 158px of content. */}
      <div className="hidden h-full shrink-0 overflow-y-auto overscroll-contain lg:block">
        {sidebar}
      </div>
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {topRight ? (
          // Pinned to the top-right corner, vertically centered in the h-16 header
          // band. z-30 keeps it above the page's own ShellHeader (z-20) so these
          // controls are always reachable.
          <div className="pointer-events-none absolute right-0 top-0 z-30 flex h-16 items-center pr-5 md:pr-8">
            <div className="pointer-events-auto flex items-center gap-1">{topRight}</div>
          </div>
        ) : null}
        {/* The drawer trigger sits in the header band, positioned by the shell
            rather than passed down: `PageFrame` is rendered by each page, so a
            prop would have to be forwarded by every route, and a context would
            need a client provider around the whole tree. Below `lg` the
            head-note is hidden and the band is a single 64px line, so a fixed
            band here lines up with the title reliably. `ShellHeader` reserves
            the matching left padding. */}
        <div className="pointer-events-none absolute left-4 top-0 z-40 flex h-16 items-center md:left-6 lg:hidden">
          <div className="pointer-events-auto">
            <SidebarDrawer>{sidebar}</SidebarDrawer>
          </div>
        </div>
        <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Permanent header bar — a static row above the scroll region (never moves).
 *  `relative z-20` keeps header dropdowns above the scrolling body, which is a
 *  later flex sibling.
 *
 *  ITS CONTENT SITS IN THE SAME COLUMN AS THE PAGE'S: the same gutter and the same
 *  centred max-width, so the title starts exactly where the first card does at any
 *  window width. A band that runs edge to edge while the content below it centres
 *  puts the title 400px left of everything it names on a wide monitor. */
function ShellHeader({ children, width }: { children: ReactNode; width: PageWidth }) {
  return (
    <header
      className={cn(
        'relative z-20 flex min-h-16 shrink-0 border-b border-line bg-surface py-3',
        // `pl-16` below `lg` reserves the drawer trigger's slot (AppShell paints it there);
        // from `lg` the rail is static and the band takes the content gutter.
        // Spelled out rather than composed from `GUTTER_X`: two padding-left rules at
        // overlapping breakpoints resolve by stylesheet order, which nobody can see from here.
        'pl-16 pr-4 md:pl-[4.5rem] md:pr-6 lg:px-6 xl:px-8',
      )}
    >
      <div className={cn('mx-auto flex w-full min-w-0 items-center gap-4', WIDTH[width])}>{children}</div>
    </header>
  );
}

/** Optional secondary nav — a static row directly under the header, in the same column. */
function ShellSubNav({ children, width }: { children: ReactNode; width: PageWidth }) {
  return (
    <div className={cn('relative z-10 flex min-h-12 shrink-0 border-b border-line bg-surface-2 py-2', GUTTER_X)}>
      <div className={cn('mx-auto flex w-full min-w-0 flex-wrap items-center gap-1', WIDTH[width])}>{children}</div>
    </div>
  );
}

/**
 * THE scroll region — the only element on a page that scrolls, and only vertically.
 * The scrollbar sits at the window's edge rather than the content's, so the
 * whole width of the window scrolls the page, not only the column.
 *
 * THE GUTTER IS ON THE SCROLLER AND THE WIDTH ON THE COLUMN INSIDE IT — the same split the
 * header and sub-nav use. Put both on one element and `max-width` swallows the padding, so
 * past ~1850px the cards start 32px right of the title above them.
 */
function ShellBody({ children, width }: { children: ReactNode; width: PageWidth }) {
  return (
    <div data-scroll-region className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain', GUTTER)}>
      <div className={cn('mx-auto w-full', WIDTH[width])}>{children}</div>
    </div>
  );
}

/**
 * The standard screen wrapper: a LOCKED header (serif title + actions) + an
 * optional locked sub-nav + a padded scroll body. Render this as the page root
 * inside the AppShell — every screen gets the permanent header for free.
 *
 *   <PageFrame title="Runs" description="…" actions={<Button…/>}>…</PageFrame>
 *
 * For a fully custom header, pass `header` instead of `title`; for a custom
 * sub-nav pass `subnav`. Pass `breadcrumb` to add the left-zone wayfinding trail
 * above the title.
 *
 * ── THE HEAD ZONE ──────────────────────────────────────────────────────
 * The header is a two-zone band read left→right:
 *
 *   LEFT    breadcrumb + title + `description`   identity, then what the page is FOR
 *   RIGHT   `actions`                            what you can do here
 *
 * THE DESCRIPTION IS A SUBTITLE, under the title. It used to be its own middle
 * zone, right-aligned against the actions — and a right-aligned paragraph is
 * only tidy while it fits on one line. Most of these run to two, and then the
 * note was ragged down its left edge, floating in the middle of the band with
 * no edge shared with anything. Under the title it is what it has always been:
 * the second line of the masthead.
 *
 * It stays out of the BODY, which is the other thing it could be. A description
 * stranded at the top of the scroll region reads as the first paragraph of the
 * content — it scrolls away, it competes with the first panel's own title, and
 * it pushes every panel down by a line.
 *
 * It hides below `lg`, where the band is tight and the title alone is the
 * wayfinding that matters; `PageFrame` re-emits it into the body there.
 */
export function PageFrame({
  title,
  breadcrumb,
  description,
  actions,
  header,
  subnav,
  children,
  width = 'data',
}: {
  title?: ReactNode;
  breadcrumb?: Crumb[];
  description?: ReactNode;
  actions?: ReactNode;
  header?: ReactNode;
  subnav?: ReactNode;
  children: ReactNode;
  /** `data` for dashboards, lists and detail pages; `reading` for prose and forms. */
  width?: PageWidth;
}) {
  return (
    <>
      <ShellHeader width={width}>
        {header ?? (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
              <Title className="min-w-0 truncate">{title}</Title>
              {description ? (
                <p className="hidden max-w-[92ch] text-[13px] leading-[1.5] text-ink-soft lg:block">
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
          </>
        )}
      </ShellHeader>
      {subnav ? <ShellSubNav width={width}>{subnav}</ShellSubNav> : null}
      <ShellBody width={width}>
        {/* The description lives in the header on `lg` and up; below that the
            head-note is hidden, so it is re-emitted here or the page loses it
            entirely on a narrow screen. */}
        {description ? <Text className="mb-4 max-w-[68ch] lg:hidden">{description}</Text> : null}
        {children}
      </ShellBody>
    </>
  );
}

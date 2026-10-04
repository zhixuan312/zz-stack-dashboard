'use client';

import { Children, createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * The shell and the layout contract, in one file. src/components/base/shell/README.md is the prose for it.
 *
 *   AppShell             fixed to the viewport: the document never scrolls; the ground and its light show through
 *   ├─ rail              a translucent wash with a hairline edge, its own scroll; a drawer below 1024px
 *   ├─ main
 *      └─ PageFrame      the one scroller on the page, vertical only
 *         ├─ top bar     sticky glass: the drawer trigger, the compact title once the masthead leaves, global tools
 *         ├─ masthead    kicker, title, one sentence, meta and actions; scrolls away with the content
 *         └─ Stack       rows, one gap apart
 *            └─ Row      one card, or cards split 1/2, 2/3, 1/3, or a row of tiles
 *
 * Four rules: one scroller; cards are their content's height; four splits; two widths (data, the whole canvas, for every
 * console page; reading, 832px and centred, for one long document).
 */

const ShellCtx = createContext<{ openNav: () => void; tools: ReactNode }>({ openNav: () => {}, tools: null });

export function AppShell({
  rail,
  tools,
  children,
}: {
  rail: ReactNode;
  /** Global tools in the top bar: search, alerts. */
  tools?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  // The drawer remembers the page it opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (o: boolean) => setOpenOn(o ? path : null);
  return (
    <ShellCtx.Provider value={{ openNav: () => setOpen(true), tools }}>
      <div className="fixed inset-0 isolate flex overflow-hidden">
        {/* The first stop for a keyboard: past the rail and the top bar, straight to the page's masthead (PageFrame). */}
        <a
          href="#content"
          className="pointer-events-none fixed top-3 left-3 z-(--layer-tooltip) -translate-y-16 rounded-md bg-surface-raised px-3 py-2 text-sm font-medium text-ink opacity-0 shadow-overlay focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100"
        >
          Skip to content
        </a>
        <aside aria-label="Primary" className="hidden h-full w-(--rail-width) shrink-0 border-r border-line bg-frame backdrop-blur-xl backdrop-saturate-150 lg:flex">
          {rail}
        </aside>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            {/* No backdrop filter on the scrim: filtering the whole screen is the costliest paint on a phone, and opening the drawer waited for it. */}
            <Dialog.Overlay className="scrim-in fixed inset-0 z-(--layer-rail) bg-scrim lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className="sheet-in fixed inset-y-0 left-0 z-(--layer-rail) flex w-(--rail-width) max-w-[86vw] border-r border-line bg-ground shadow-overlay lg:hidden"
            >
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              {rail}
              <Dialog.Close
                aria-label="Close navigation"
                className="absolute top-4 -right-12 grid size-9 place-items-center rounded-full bg-surface-raised text-ink-2 shadow-overlay"
              >
                <X className="size-4" />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <main className="relative flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </ShellCtx.Provider>
  );
}

/** Opens the navigation drawer below 1024px; hidden above. */
export function NavTrigger({ className }: { className?: string }) {
  const { openNav } = useContext(ShellCtx);
  return (
    <button
      type="button"
      onClick={openNav}
      aria-label="Open navigation"
      className={cn('press hit -ml-1.5 grid size-9 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-fill-hover hover:text-ink lg:hidden', className)}
    >
      <Menu className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}

export const WIDTH = { data: 'max-w-(--data-width)', reading: 'max-w-(--reading-width)' } as const;
export type PageWidth = keyof typeof WIDTH;

/**
 * A page: one scroll region holding a glass top bar, the masthead and the rows. The masthead (kicker, title, one
 * sentence, actions) scrolls away with the content; once the title leaves view, a compact title fades into the top
 * bar, which also carries the global tools. Every band shares the gutter and the width, so the title starts exactly
 * where the first card does.
 */
export function PageFrame({
  title,
  description,
  kicker,
  meta,
  actions,
  toolbar,
  width = 'data',
  children,
}: {
  title: ReactNode;
  /** One sentence under the title: what this page answers. */
  description?: ReactNode;
  /** Mono caps above the title: where this page sits ("ZZ Meridian · Production", or the parent record). */
  kicker?: ReactNode;
  /** Quiet status beside the actions: the freshness stamp. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** A band under the masthead: tabs or filters that govern the whole page. */
  toolbar?: ReactNode;
  width?: PageWidth;
  children: ReactNode;
}) {
  const { tools } = useContext(ShellCtx);
  const head = useRef<HTMLHeadingElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = head.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div data-scroll-region className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
      <div
        data-stuck={stuck || undefined}
        className="sticky top-0 z-(--layer-sticky) border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-(--dur-enter) data-stuck:border-line data-stuck:bg-ground/72 data-stuck:backdrop-blur-xl data-stuck:backdrop-saturate-150"
      >
        {/* The top bar keeps the canvas width on every page, so the tools never move; only the content narrows. */}
        <div className={cn('mx-auto flex h-14 w-full items-center gap-3 px-(--gutter)', WIDTH.data)}>
          <NavTrigger />
          <p aria-hidden className={cn('min-w-0 truncate text-sm font-semibold transition-[opacity,transform] duration-(--dur-enter) ease-out', stuck ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0')}>
            {title}
          </p>
          <div className="ml-auto flex items-center gap-1.5">{tools}</div>
        </div>
      </div>
      <header id="content" tabIndex={-1} className={cn('mx-auto w-full px-(--gutter) pt-4 pb-8 outline-none lg:pt-6 lg:pb-10', WIDTH[width])}>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
          <div className="min-w-0 flex-1 basis-[28rem]">
            {kicker ? <p className="t-kicker mb-4">{kicker}</p> : null}
            <h1 ref={head} className="t-page">{title}</h1>
            {description ? <p className="t-lead mt-3 max-w-[60ch]">{description}</p> : null}
          </div>
          {meta || actions ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {meta ? <div className="mr-1.5">{meta}</div> : null}
              {actions}
            </div>
          ) : null}
        </div>
        {toolbar ? <div className="mt-8">{toolbar}</div> : null}
      </header>
      <div data-page-width={width} className={cn('mx-auto w-full px-(--gutter) pb-16', WIDTH[width])}>{children}</div>
    </div>
  );
}

/** A page body: rows, top to bottom, one gap apart, arriving in reading order. */
export function Stack({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('arrive flex min-w-0 flex-col gap-(--stack-gap)', className)} {...rest} />;
}

const SPLIT = {
  full: '',
  '1/2': 'lg:grid-cols-2',
  '2/3': 'lg:grid-cols-3 lg:[&>*:first-child]:col-span-2',
  '1/3': 'lg:grid-cols-3 lg:[&>*:last-child]:col-span-2',
} as const;
/* A row of tiles counts its columns from its own width, and never leaves a hole: three tiles are three or one. */
const TILES = {
  2: '@min-[34rem]:grid-cols-2',
  3: '@min-[48rem]:grid-cols-3',
  4: '@min-[34rem]:grid-cols-2 @min-[62rem]:grid-cols-4',
} as const;
export type Split = keyof typeof SPLIT | 'tiles';

/** One row of cards. Cards in a row are the same height; every card is a direct child. */
export function Row({ split = 'full', className, ...rest }: HTMLAttributes<HTMLDivElement> & { split?: Split }) {
  if (split === 'tiles') {
    const n = Math.min(Math.max(Children.toArray(rest.children).length, 2), 4) as 2 | 3 | 4;
    return (
      <div className="@container min-w-0">
        <div data-split="tiles" className={cn('grid min-w-0 grid-cols-1 gap-(--stack-gap) *:min-w-0', TILES[n], className)} {...rest} />
      </div>
    );
  }
  return <div data-split={split} className={cn('grid min-w-0 grid-cols-1 gap-(--stack-gap) *:min-w-0', SPLIT[split], className)} {...rest} />;
}

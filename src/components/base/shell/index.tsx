'use client';

import { Children, Suspense, createContext, use, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '../../../lib/cn';
import { usePreferences } from '../providers';
import { ConsoleSurface } from '../surface/index';
import dynamic from 'next/dynamic';

// The assistant loads only where it is shown: a product without it, or a person who switched it off, never downloads it.
// The launcher and the panel are two chunks, and that is the point: the launcher is the only part a page draws while the
// panel is closed, so importing both from the barrel put `useChat`, the AI SDK and a markdown renderer — 448 KB in one
// adopter's build, issue #7 — into every page that carries a button nobody had pressed.
const AssistantColumn = dynamic(() => import('../../patterns/assistant/index').then((m) => m.AssistantColumn));
const AssistantLauncher = dynamic(() => import('../../patterns/assistant/launcher').then((m) => m.AssistantLauncher));

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
 *   └─ assistant         optional, and the person can switch it off: a third column from 1024px, a sheet below; not in the page while closed
 *                        whether it exists arrives as a promise: the layout never waits for it, and its launcher and column resolve it behind their own boundaries
 *
 * Four rules: one scroller; cards are their content's height; four splits; two widths (data, the whole canvas, for every
 * console page; reading, 832px and centred, for one long document).
 */

const ShellCtx = createContext<{ openNav: () => void; tools: ReactNode; assistant: Promise<boolean> }>({ openNav: () => {}, tools: null, assistant: Promise.resolve(false) });

/** The promise of whether the product has an assistant: Settings offers the person's switch only when it resolves true. */
export function useAssistantAvailable(): Promise<boolean> {
  return useContext(ShellCtx).assistant;
}

/**
 * Where the launcher goes, and the room it takes, whether or not there is one. It is in the page from the first byte, the
 * launcher's size and without a control, so the row of tools never shifts when the answer arrives; only `true` puts the
 * launcher in it, and until then, and for `false`, it is hidden from assistive technology and holds nothing focusable.
 */
function AssistantSlot({ children }: { children?: ReactNode }) {
  return (
    <span data-assistant-slot aria-hidden={children ? undefined : true} className="inline-grid size-9 shrink-0 place-items-center">
      {children}
    </span>
  );
}

function ResolvedLauncher({ assistant, open, onClick }: { assistant: Promise<boolean>; open: boolean; onClick: () => void }) {
  const { prefs } = usePreferences();
  return <AssistantSlot>{use(assistant) && prefs.assistant ? <AssistantLauncher open={open} onClick={onClick} /> : null}</AssistantSlot>;
}

/** A question a card handed to the assistant, waiting for the panel to send it. */
type Ask = { id: number; text: string };

/** The panel, once there is an assistant, the person wants it, and it has been asked for. Nothing occupies its place before that. */
function ResolvedColumn({ assistant, open, used, onClose, ask, onAsked }: { assistant: Promise<boolean>; open: boolean; used: boolean; onClose: () => void; ask: Ask | null; onAsked: () => void }) {
  const { prefs } = usePreferences();
  return use(assistant) && prefs.assistant && (open || used) ? <AssistantColumn open={open} onClose={onClose} ask={ask} onAsked={onAsked} /> : null;
}

/**
 * Data arrives once. The first page of a visit rises and grows into place; a page reached by a click in the app, or one
 * the router kept and shows again (Cache Components keeps visited routes mounted and hidden, and showing an element
 * again restarts its animations), is already there and must not replay, or a ready page reads as still loading
 * (issue #19). A change of path marks the main area still before paint; the mark lifts once the longest arrival would
 * have ended, so a change made on the page afterwards, such as a new period, still animates. A change of query alone
 * keeps the path, so it is not a navigation here.
 */
function useStillOnNavigation(path: string) {
  const [still, setStill] = useState(false);
  const shown = useRef(path);
  useLayoutEffect(() => {
    if (shown.current === path) return;
    shown.current = path;
    setStill(true);
    const css = getComputedStyle(document.documentElement);
    // A build may write 820ms as .82s, so read the unit, not only the number.
    const ms = (name: string) => { const v = css.getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000); };
    const t = setTimeout(() => setStill(false), ms('--dur-grow') + ms('--dur-enter'));
    return () => clearTimeout(t);
  }, [path]);
  return still;
}

export function AppShell({
  rail,
  tools,
  assistant,
  children,
}: {
  rail: ReactNode;
  /** Global tools in the top bar: search, alerts. */
  tools?: ReactNode;
  /** Whether this request has an assistant, as a promise the request resolves: adds its launcher to the tools and its panel as the third column, unless the person switched it off. */
  assistant: Promise<boolean>;
  children: ReactNode;
}) {
  const path = usePathname();
  const still = useStillOnNavigation(path);
  // The drawer remembers the page it opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (o: boolean) => setOpenOn(o ? path : null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // The panel's chunk is a third of a megabyte, so it is NOT in a page's first load: the column mounts the first time
  // somebody opens it, and stays mounted from then on, so closing it and reopening keeps the thread. Before this, a
  // page nobody had asked the assistant on paid for `useChat`, the AI SDK and a markdown renderer anyway (issue #7).
  const [assistantUsed, setAssistantUsed] = useState(false);
  const { prefs } = usePreferences();
  // Switching the assistant off closes its panel, so switching it back on does not reopen it.
  const [wasOn, setWasOn] = useState(prefs.assistant);
  if (prefs.assistant !== wasOn) {
    setWasOn(prefs.assistant);
    if (!prefs.assistant) setAssistantOpen(false);
  }
  // Whether Ask on a card can reach an assistant: known once the promise resolves, so the first render shows no Ask.
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    void assistant.then((on) => { if (live) setAvailable(on); });
    return () => { live = false; };
  }, [assistant]);
  const [pendingAsk, setPendingAsk] = useState<Ask | null>(null);
  const ask = useMemo(
    () => (available && prefs.assistant ? (text: string) => { setAssistantUsed(true); setAssistantOpen(true); setPendingAsk({ id: Date.now(), text }); } : undefined),
    [available, prefs.assistant],
  );
  const allTools = (
    <>
      {tools}
      <Suspense fallback={<AssistantSlot />}>
        <ResolvedLauncher assistant={assistant} open={assistantOpen} onClick={() => { setAssistantUsed(true); setAssistantOpen((o) => !o); }} />
      </Suspense>
    </>
  );
  return (
    <ShellCtx.Provider value={{ openNav: () => setOpen(true), tools: allTools, assistant }}>
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
        <main data-still={still || undefined} className="relative flex min-w-0 flex-1 flex-col"><ConsoleSurface ask={ask}>{children}</ConsoleSurface></main>
        <Suspense fallback={null}>
          <ResolvedColumn assistant={assistant} open={assistantOpen} used={assistantUsed} onClose={() => setAssistantOpen(false)} ask={pendingAsk} onAsked={() => setPendingAsk(null)} />
        </Suspense>
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
 * A page: one scroll region holding a glass top bar/**
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
    <div data-scroll-region className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable] scroll-pt-16">
      {/* `scroll-pt-16` (64px) is for the keyboard: a control focused far down the page scrolls into view, and without
          it the browser aligns it to the very top — under the 56px stuck masthead. Focus must land where it can be
          seen, or a person tabbing cannot tell what they are on. */}
      <div
        data-stuck={stuck || undefined}
        className="sticky top-0 z-(--layer-sticky) border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-(--dur-enter) data-stuck:border-line data-stuck:bg-ground/72 data-stuck:backdrop-blur-xl data-stuck:backdrop-saturate-150"
      >
        {/* The top bar keeps the canvas width on every page, so the tools never move; only the content narrows. It is a
            container: the tools fold by the bar's own width, which the assistant's column narrows as much as a phone does. */}
        <div className={cn('@container mx-auto flex h-14 w-full items-center gap-3 px-(--gutter)', WIDTH.data)}>
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

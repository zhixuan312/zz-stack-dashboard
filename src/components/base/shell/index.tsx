'use client';

import { Children, Suspense, createContext, use, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode, type Ref, type RefObject } from 'react';
import { Dialog } from 'radix-ui';
import { Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../../../lib/cn';
import { usePreferences } from '../providers';
import { useNavDrawer } from '../use-nav-drawer';
import { ConsoleSurface } from '../surface/index';
import { Skeleton } from '../../ui/skeleton/index';
import dynamic from 'next/dynamic';

// The assistant loads only where it is shown: a product without it, or a person who switched it off, never downloads it.
// The launcher and the panel are two chunks, and that is the point: the launcher is the only part a page draws while the
// panel is closed, so importing both from the barrel put `useChat`, the AI SDK and a markdown renderer — 448 KB in one
// adopter's build, issue #7 — into every page that carries a button nobody had pressed.
const AssistantColumn = dynamic(() => import('../../patterns/assistant/index').then((m) => m.AssistantColumn));
const AssistantLauncher = dynamic(() => import('../../patterns/assistant/launcher').then((m) => m.AssistantLauncher));
// The question the leave guard asks is the same kind of code: a dialog and two buttons that most pages never show. With it
// in the shell's own file every Atlas page downloaded them (25 to 29 KB of first-load JS, measured), so it is a chunk of
// its own, fetched when something on the page first becomes unsaved and drawn when a person tries to leave.
const loadLeaveQuestion = () => import('./leave-question').then((m) => m.LeaveQuestion);
const LeaveQuestion = dynamic(loadLeaveQuestion);

/**
 * The shell and the layout contract, in one file. src/components/base/shell/README.md is the prose for it.
 *
 *   AppShell             fixed to the viewport: the document never scrolls; the ground and its light show through
 *   ├─ rail              a translucent wash with a hairline edge, its own scroll; a drawer below 1024px
 *   ├─ main
 *      └─ PageFrame      the one scroller on the page, vertical only
 *         ├─ top bar     sticky glass: the drawer trigger, the compact title once the masthead leaves, global tools
 *         ├─ masthead    kicker, title (a name, or a sentence that states the page's figures), one sentence, meta and
 *         │              actions; scrolls away with the content. A name shares its row with the meta and actions; a
 *         │              sentence has a row to itself, and they stand beside the one sentence under it
 *         └─ Stack       rows, one gap apart
 *            └─ Row      one card, or cards split 1/2, 2/3, 1/3, or a row of tiles
 *   └─ assistant         optional, and the person can switch it off: a third column from 1024px, a sheet below; not in the page while closed
 *                        whether it exists arrives as a promise: the layout never waits for it, and its launcher and column resolve it behind their own boundaries
 *
 * Four rules: one scroller; cards are their content's height; four splits; three widths, one per kind of page (data, the
 * whole canvas, for an analytical page; form, a form page's own measure, centred once the canvas is wider than it needs;
 * reading, 832px and centred, for one long document).
 */

const ShellCtx = createContext<{ openNav: () => void; tools: ReactNode; assistant: Promise<boolean> }>({ openNav: () => {}, tools: null, assistant: Promise.resolve(false) });

/**
 * The leave guard. Something on the page that holds unsaved changes says so with `useUnsavedChanges`; while any does, the
 * shell holds a plain click on a link and a navigation that code starts through `useLeave`, and asks first. Outside a
 * shell (a card's preview, an embed, a test that draws a form alone) nothing is registered and `leave(go)` runs `go`.
 */
const LeaveCtx = createContext<{ hold: () => () => void; leave: (go: () => void) => void }>({ hold: () => () => {}, leave: (go) => go() });

/** A component calls this to say it holds unsaved changes while `dirty` is true. Saved, discarded or unmounted, it stops holding at once. */
export function useUnsavedChanges(dirty: boolean) {
  const { hold } = useContext(LeaveCtx);
  // An effect, not a render-time write: a page the router keeps hidden has its effects cleaned up, so it holds nothing while hidden.
  useEffect(() => (dirty ? hold() : undefined), [dirty, hold]);
}

/**
 * Answers `leave(go)`: `go` runs at once when nothing is unsaved, and otherwise only if the person chooses to leave.
 * Code that navigates (a button, a menu, a palette command) goes through it; a link needs nothing, the shell hears it.
 */
export function useLeave(): (go: () => void) => void {
  return useContext(LeaveCtx).leave;
}

/** Whether a click on this link is one the browser would follow in this tab, to a page of this origin other than the one in view. */
function plainFollow(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.hasAttribute('download') || (a.target && a.target !== '_self')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  // A place on the page already in view is the browser's to scroll to.
  if (url.pathname + url.search === location.pathname + location.search) return null;
  return url.pathname + url.search + url.hash;
}

/** The question, and the guard behind it. It sits at the shell's top and reads no address: it only listens. */
function useLeaveGuard() {
  const router = useRouter();
  const held = useRef(0);
  // The person has answered Leave: the move they chose may end in a full page load, and the browser must not ask again.
  const leaving = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const hold = useCallback(() => {
    held.current += 1;
    leaving.current = false;
    // Something is unsaved, so the question may be needed: fetch it now and it is there by the time it is asked.
    void loadLeaveQuestion();
    return () => { held.current -= 1; };
  }, []);
  const leave = useCallback((go: () => void) => {
    if (held.current === 0) go();
    // One question at most: a second navigation while one is open waits behind the dialog, which is modal.
    else setPending((open) => open ?? go);
  }, []);
  useEffect(() => {
    // The capture phase of the document runs before any handler of the link, which in a router's link component is
    // where it navigates; a listener after it would find the navigation done.
    const onClick = (e: MouseEvent) => {
      if (held.current === 0) return;
      const follow = plainFollow(e);
      if (!follow) return;
      e.preventDefault();
      e.stopPropagation();
      leave(() => router.push(follow));
    };
    const onUnload = (e: Event) => { if (held.current > 0 && !leaving.current) e.preventDefault(); };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [leave, router]);
  const value = useMemo(() => ({ hold, leave }), [hold, leave]);
  const question = pending ? <LeaveQuestion onStay={() => setPending(null)} onLeave={() => { setPending(null); leaving.current = true; pending(); }} /> : null;
  return { value, question };
}

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
 * Data arrives once. The first page of a visit rises and grows into place, unless the reader has already waited longer
 * than that arrival lasts: motion after a long wait is no feedback, only a later page, and on a slow phone it held the
 * page's own text back (issue #21). A page reached by a click in the app, or one
 * the router kept and shows again (Cache Components keeps visited routes mounted and hidden, and showing an element
 * again restarts its animations), is already there and must not replay, or a ready page reads as still loading
 * (issue #19). A change of path marks the main area still before paint; the mark lifts once the longest arrival would
 * have ended, so a change made on the page afterwards, such as a new period, still animates. A change of query alone
 * keeps the path, so it is not a navigation here.
 *
 * It reads the address, so it is a part of its own behind its own boundary and draws nothing (see `AppShell`).
 */
function StillOnNavigation({ main }: { main: RefObject<HTMLElement | null> }) {
  const path = usePathname();
  const shown = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = main.current;
    if (shown.current === path || !el) return;
    const first = shown.current === null;
    shown.current = path;
    const css = getComputedStyle(document.documentElement);
    // A build may write 820ms as .82s, so read the unit, not only the number.
    const ms = (name: string) => { const v = css.getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000); };
    const arrival = ms('--dur-grow') + ms('--dur-enter');
    // `performance.now()` counts from the start of the page load, so on the first page it is how long the reader waited.
    if (first && !(performance.now() > arrival)) return;
    el.setAttribute('data-still', '');
    const t = setTimeout(() => el.removeAttribute('data-still'), arrival);
    return () => { clearTimeout(t); el.removeAttribute('data-still'); };
  }, [path, main]);
  return null;
}

/**
 * The navigation drawer below 1024px: the rail, in a dialog that the top bar's button opens. Whether it is open is
 * `useNavDrawer`'s, and that is a read of the address, so the drawer is a part of its own behind its own boundary (see
 * `AppShell`).
 *
 * That boundary can arrive after the page, and the page holds the trigger: on a phone a press could land while there was
 * no drawer to take it, and it was dropped (issue #32). So the shell counts the presses in its own state and passes the
 * count down, and the drawer opens whenever the count it has answered is behind it. A press made before the drawer was
 * there is answered when it arrives, and each press is answered once.
 */
function Drawer({ rail, asked, root }: { rail: ReactNode; asked: number; root: RefObject<HTMLElement | null> }) {
  const nav = useNavDrawer(asked, root);
  return (
    <Dialog.Root open={nav.open} onOpenChange={nav.setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim-in fixed inset-0 z-(--layer-rail) bg-scrim lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          {...nav.content}
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
  );
}

/**
 * The shell itself never reads the address. A route with a parameter the build did not know (a record's own page, which
 * in a product is every record) has no pathname until the request, and a component that asks for one waits for it; when
 * the shell asked, at its top, the whole page waited with it and nothing at all was prerendered for such a route — the
 * build's shell for `/requests/[id]` was an empty file, and an adopter whose layout put a boundary above the shell was
 * served that boundary's fallback and nothing else. So what reads the address is each a part of its own, behind its own
 * boundary, with a fallback that takes the same room: the drawer, the mark that holds a navigated page still, and the
 * rail, whatever a product passes for one.
 */
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
  // How many times the page has asked for the drawer; the drawer answers each one (see `Drawer`).
  const [navAsked, setNavAsked] = useState(0);
  const guard = useLeaveGuard();
  const main = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
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
  // The context's value only changes when something it holds does: a press on the drawer's trigger changes `navAsked` and
  // nothing else, and a new value each time re-rendered every consumer of the context (the top bar, the page's masthead)
  // inside the tap.
  const openNav = useCallback(() => setNavAsked((n) => n + 1), []);
  const shellValue = useMemo(
    () => ({
      openNav,
      assistant,
      tools: (
        <>
          {tools}
          <Suspense fallback={<AssistantSlot />}>
            <ResolvedLauncher assistant={assistant} open={assistantOpen} onClick={() => { setAssistantUsed(true); setAssistantOpen((o) => !o); }} />
          </Suspense>
        </>
      ),
    }),
    [openNav, tools, assistant, assistantOpen],
  );
  return (
    <LeaveCtx.Provider value={guard.value}>
    <ShellCtx.Provider value={shellValue}>
      <div ref={frame} data-drawer-frame className="fixed inset-0 isolate flex overflow-hidden">
        {/* The first stop for a keyboard: past the rail and the top bar, straight to the page's masthead (PageFrame). */}
        <a
          href="#content"
          className="pointer-events-none fixed top-3 left-3 z-(--layer-tooltip) -translate-y-16 rounded-md bg-surface-raised px-3 py-2 text-sm font-medium text-ink opacity-0 shadow-overlay focus-visible:pointer-events-auto focus-visible:translate-y-0 focus-visible:opacity-100"
        >
          Skip to content
        </a>
        <aside aria-label="Primary" className="hidden h-full w-(--rail-width) shrink-0 border-r border-line bg-frame backdrop-blur-xl backdrop-saturate-150 lg:flex">
          <Suspense fallback={null}>{rail}</Suspense>
        </aside>
        <Suspense fallback={null}>
          <Drawer asked={navAsked} rail={rail} root={frame} />
        </Suspense>
        <main ref={main} className="relative flex min-w-0 flex-1 flex-col"><ConsoleSurface ask={ask}>{children}</ConsoleSurface></main>
        {/* After the main area, so the main area is there to mark when this first runs. */}
        <Suspense fallback={null}>
          <StillOnNavigation main={main} />
        </Suspense>
        <Suspense fallback={null}>
          <ResolvedColumn assistant={assistant} open={assistantOpen} used={assistantUsed} onClose={() => setAssistantOpen(false)} ask={pendingAsk} onAsked={() => setPendingAsk(null)} />
        </Suspense>
      </div>
      {guard.question}
    </ShellCtx.Provider>
    </LeaveCtx.Provider>
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

export const WIDTH = { data: 'max-w-(--data-width)', reading: 'max-w-(--reading-width)', form: 'max-w-(--form-width)' } as const;
export type PageWidth = keyof typeof WIDTH;

/**
 * The block a title that is a sentence takes: the section role, balanced, with room for the lines a sentence of some
 * eighty characters wraps to in its column, the sentence standing on the block's last line. The room is kept whether
 * the sentence fills it or not, so the placeholder and the sentence are one block, nothing under the heading moves
 * when one takes the other's place, and the body starts at the same height on every page headed by a sentence.
 *
 * The steps are in ems of the role's own size, which the heading carries for them to be read against: the lines a
 * sentence takes follow its width in characters, not in pixels, and the role's size moves with the viewport while the
 * heading's width moves with the rail and the assistant too. Four lines under 14.5em, three from there (a 390px phone
 * is 14.9em), two from 21.5em (1440px with the rail is 35em, and 22em with the assistant open) and one from 42em
 * (1920px is 49em). The heading must be as wide while its page loads as when it has arrived, or the block keeps
 * different room in the two: `PageFrame` gives it the masthead's whole width, with nothing beside it.
 */
const SENTENCE = 't-section flex min-h-[4lh] flex-col justify-end text-balance @min-[14.5em]:min-h-[3lh] @min-[21.5em]:min-h-[2lh] @min-[42em]:min-h-[1lh]';

/** The sentence on its way: two bars in the block it will take, one where the block is one line. Each bar and its margins are one line of the role. */
function SentencePending() {
  return (
    <span aria-hidden data-title-pending className={SENTENCE}>
      <Skeleton className="my-[0.2em] h-[0.7em] w-11/12 max-w-[24em] rounded-md" />
      <Skeleton className="my-[0.2em] h-[0.7em] w-3/5 max-w-[15em] rounded-md @min-[42em]:hidden" />
    </span>
  );
}

/**
 * A page's heading, the one `h1`. With no `name` it is the title at the page-title size, a name such as "Members".
 *
 * A page whose title is a sentence about its figures passes its `name` beside it. The heading is then the name, read
 * out and not drawn, and the sentence, drawn in the section role; a screen reader's list of headings and whatever
 * finds a page by its heading still have the name. The sentence may be a part that reads data: the heading is in the
 * first HTML with the name and a placeholder the size of the sentence's block, and the sentence takes the
 * placeholder's place. A title that comes to nothing (the page could not work it out) leaves the name to head the
 * page, drawn as a page that passes no name draws its title. A loading state passes the name alone and draws the
 * placeholder.
 */
export function PageTitle({ name, title, ref }: { name?: string; title?: ReactNode; ref?: Ref<HTMLHeadingElement> }) {
  if (name === undefined) return <h1 ref={ref} className="t-page">{title}</h1>;
  return (
    <h1 ref={ref} className="@container text-xl">
      {/* The name stays out of sight while a sentence or its placeholder follows it, and heads the page when the sentence came to nothing. */}
      <span className="t-page sr-only has-[~[data-title]:empty]:not-sr-only">{name}</span>
      <span className="sr-only">: </span>
      {title === undefined ? <SentencePending /> : (
        <Suspense fallback={<SentencePending />}>
          <span data-title className={cn(SENTENCE, 'empty:hidden')}>{title}</span>
        </Suspense>
      )}
    </h1>
  );
}

/**
 * A page: one scroll region holding a glass top bar, the masthead and the rows. The masthead (kicker, title, one
 * sentence, actions) scrolls away with the content; once the title leaves view, a compact title fades into the top
 * bar, which also carries the global tools. Every band shares the gutter and the width, so the title starts exactly
 * where the first card does. A page headed by a sentence passes its `name` too (`PageTitle`), and the top bar shows
 * the name; its kicker and heading take a row of the masthead's whole width, above the description, the meta and the
 * actions. A page headed by its name keeps them all on one row.
 */
export function PageFrame({
  name,
  title,
  description,
  kicker,
  meta,
  actions,
  toolbar,
  width = 'data',
  children,
}: {
  /** The page's name, for a page whose `title` is a sentence: kept in the heading for assistive technology and shown in the top bar. */
  name?: string;
  /** The page's title: its name, or with `name` the sentence that heads it. Left out with `name`, the sentence is still to come. */
  title?: ReactNode;
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
  // The freshness stamp and the page's controls are one cluster, and a phone is where it has to be arranged rather than
  // merely allowed to fit: with the stamp inline, the period select ends the line and the export button is left stranded
  // on a line of its own, which reads as a layout that ran out. The stamp takes the line on its own there, so the two
  // controls stay together.
  const beside = meta || actions ? (
    <div className="flex flex-wrap items-center gap-2.5">
      {meta ? <div className="mr-1.5 max-lg:w-full">{meta}</div> : null}
      {actions}
    </div>
  ) : null;
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
            {name ?? title}
          </p>
          <div className="ml-auto flex items-center gap-1.5">{tools}</div>
        </div>
      </div>
      <header id="content" tabIndex={-1} className={cn('mx-auto w-full px-(--gutter) pt-4 pb-8 outline-none lg:pt-6 lg:pb-10', WIDTH[width])}>
        {name === undefined ? (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
            <div className="min-w-0 flex-1 basis-[28rem]">
              {kicker ? <p className="t-kicker mb-4">{kicker}</p> : null}
              <PageTitle ref={head} title={title} />
              {description ? <p className="t-lead mt-3 max-w-[60ch]">{description}</p> : null}
            </div>
            {beside}
          </div>
        ) : (
          <>
            {/* A sentence's heading has a row to itself, the masthead's whole width. The room its block keeps is read
                from its width, and beside the meta and the actions that width changed when they arrived: a loading
                state has none, so the block kept two lines while the page loaded and three once it had, and
                everything under it dropped. Now its width follows the viewport, the rail and the assistant alone. */}
            <div>
              {kicker ? <p className="t-kicker mb-4">{kicker}</p> : null}
              <PageTitle ref={head} name={name} title={title} />
            </div>
            {/* The description grows, so the meta and the actions end the row on its last line; with no description
                nothing is left to grow in its place, and they stand at the row's start. */}
            {description || beside ? (
              <div className={cn('flex flex-wrap items-end gap-x-8 gap-y-5', description ? 'mt-3' : 'mt-5')}>
                {description ? <div className="min-w-0 flex-1 basis-[28rem]"><p className="t-lead max-w-[60ch]">{description}</p></div> : null}
                {beside}
              </div>
            ) : null}
          </>
        )}
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

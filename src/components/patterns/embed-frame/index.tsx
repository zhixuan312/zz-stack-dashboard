'use client';

import { ArrowUpRight, Maximize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { app } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { AppMark } from '../../base/app-mark/index';
import { Stack } from '../../base/shell/index';
import { useSurface } from '../../base/surface/index';
import { Card } from '../../ui/card/index';
import { Skeleton } from '../../ui/skeleton/index';

/**
 * The head and body of an MCP App view. A guest in someone else's interface: no frame, no rail, no masthead, only the
 * product's mark and the view's title, how fresh it is, and the way out (Expand in the host, or Open in the console).
 * Inline it fits the host's height; fullscreen it holds the same rows as the console page.
 */
export function EmbedFrame({
  title,
  meta,
  consolePath,
  expandable = true,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** The console page this view summarises: where Open and a refused Expand go. */
  consolePath: string;
  /** Offer Expand when the inline view had to leave something out. */
  expandable?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const s = useSurface();
  const inline = s.mode !== 'fullscreen';
  const tools = (
    <div className={cn('flex shrink-0 items-center gap-0.5', !meta && '-ml-2 @[34rem]/embed:ml-0')}>
      {inline && expandable ? (
        <button
          type="button"
          onClick={() => s.expand(consolePath)}
          className="press hit inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap text-ink-2 hover:bg-fill-hover hover:text-ink"
        >
          <Maximize2 className="size-3.5" /> <span className="@max-[320px]/embed:sr-only">Expand</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => s.openLink(consolePath)}
        className="press hit inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap text-ink-2 hover:bg-fill-hover hover:text-ink"
      >
        Open<span className="@max-[440px]/embed:sr-only"> in {app.name}</span><ArrowUpRight className="size-3.5" />
      </button>
    </div>
  );
  return (
    <section className={cn('@container/embed mx-auto w-full', inline ? 'max-w-190 p-1' : 'max-w-none px-(--gutter) py-6', className)}>
      {inline ? (
        <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-3">
          <AppMark size={20} />
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em]">{title}</h1>
          {actions}
          <div className="flex w-full items-center gap-2 pl-7.5 @[34rem]/embed:w-auto @[34rem]/embed:pl-0">
            {meta ? <div className="mr-auto flex min-w-0 @[34rem]/embed:mr-1">{meta}</div> : null}
            {tools}
          </div>
        </header>
      ) : (
        <header className="pb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AppMark size={20} />
            <p className="t-kicker mr-auto">{app.name}</p>
            {meta}
            {actions}
            {tools}
          </div>
          <h1 className="t-page mt-4 text-balance">{title}</h1>
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * An embed while its read runs: the frame drawn at once from what the address already says, and a body of the shape
 * the read will fill, announced once as busy under the view's name. A host frames this document, so a `<Suspense>`
 * with no fallback shows it an empty rectangle — one whose height the host takes as the view's own — and this is the
 * state every embed route falls back to. It takes no meta: how fresh the data is is one of the things being read.
 */
/** The placeholder an embed's body is made of while its read runs: a card with a chart in it, a row of tiles, a table. */
export type EmbedBlock = 'chart' | 'tiles' | 'table';

/** One block, in the shape of the thing it stands for, drawn here rather than imported. */
function Block({ block }: { block: EmbedBlock }) {
  if (block === 'tiles') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="gap-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </Card>
        ))}
      </div>
    );
  }
  return (
    <Card className="gap-4 p-4">
      <Skeleton className="h-4 w-32" />
      {block === 'chart' ? <Skeleton className="h-40 w-full rounded-md" /> : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-4" />)}
    </Card>
  );
}

/**
 * An embed while its read runs: the frame drawn at once from what the address already says, and a body of the shape
 * the read will fill, announced once as busy under the view's name. A host frames this document, so a `<Suspense>`
 * with no fallback shows it an empty rectangle — one whose height the host takes as the view's own — and this is the
 * state every embed route falls back to. It takes no meta: how fresh the data is is one of the things being read.
 *
 * The blocks are drawn here and not taken from `page-loading`, whose skeletons are the console's: that module also
 * holds the console's frame, and an embed that imported it carried the whole console chrome in its first load — the
 * three embeds grew 5.8–7.7% and `/embed/now` went 14 KiB past the budget. A host's frame holds three bars, not a
 * console.
 */
/**
 * An embed whose read threw: the frame stays — a host framed this document and the product is still answering — and the
 * card says what happened and where the view is. There is no Retry: the read is the tool's, and a host asks for it again
 * by asking the tool again; the way to the console is the frame's own link.
 */
export function EmbedFailed({ title, consolePath, name }: { title: string; consolePath: string; name: string }) {
  return (
    <EmbedFrame title={title} consolePath={consolePath} expandable={false}>
      <Card className="arrive gap-3 p-4">
        <p className="text-sm font-medium text-ink">{name} did not load</p>
        <p className="t-caption text-pretty">The data behind this view did not arrive, and nothing was changed. It reads again the next time this view is opened.</p>
      </Card>
    </EmbedFrame>
  );
}

export function EmbedBusy({ title, consolePath, name, blocks }: { title: ReactNode; consolePath: string; name: string; blocks: readonly EmbedBlock[] }) {
  return (
    <EmbedFrame title={title} consolePath={consolePath}>
      <div role="status" aria-busy="true" aria-label={`Loading ${name}`}>
        <Stack className="gap-3">{blocks.map((b, i) => <Block key={i} block={b} />)}</Stack>
      </div>
    </EmbedFrame>
  );
}

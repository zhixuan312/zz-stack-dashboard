'use client';

import { ArrowUpRight, Maximize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { app } from '../../../app.config';
import { cn } from '../../../lib/cn';
import { AppMark } from '../../base/app-mark/index';
import { useSurface } from '../../base/surface/index';

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

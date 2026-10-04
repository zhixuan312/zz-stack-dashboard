import type { ReactNode } from 'react';
import { app } from '@/app.config';
import { AppMark } from '@/components/base/app-mark';

/**
 * A screen outside the shell (sign-in, enrolment, signed out, not found): the lit ground, the mark in the corner, and
 * one sentence at poster size that ends on an accent full stop, the one place the accent is punctuation. `aside` is
 * the panel a person acts in.
 */
export function Standalone({ kicker, sentence, lead, aside, children }: { kicker?: ReactNode; sentence: string; lead?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-hidden">
      <header className="flex h-20 items-center px-(--gutter)">
        <span className="flex items-center gap-2.5 text-md font-semibold tracking-[-0.015em]">
          <AppMark size={28} />
          {app.name}
        </span>
      </header>
      <div className="mx-auto grid w-full max-w-(--stage-width) flex-1 items-center gap-12 px-(--gutter) pt-6 pb-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,26rem)] lg:gap-20">
        <div className="min-w-0">
          {kicker ? <p className="t-kicker mb-6">{kicker}</p> : null}
          <h1 className="t-display max-w-[13ch] text-balance">
            {sentence.replace(/\.$/, '')}
            <span className="text-accent">.</span>
          </h1>
          {lead ? <p className="t-lead mt-6 max-w-[46ch]">{lead}</p> : null}
          {children}
        </div>
        {aside ? <div className="min-w-0 max-lg:max-w-md">{aside}</div> : null}
      </div>
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-(--gutter) py-5 text-xs text-ink-3">
        <span>{app.name}, the console for the ZZ platform</span>
      </footer>
    </main>
  );
}

/** The panel a standalone screen's action lives in: a lit card with the accent's line along its top edge. */
export function StandalonePanel({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className="relative overflow-hidden rounded-xl border border-line bg-surface/80 p-7 shadow-overlay backdrop-blur-xl sm:p-8">
      <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-accent-ink/60 to-transparent" />
      {children}
    </section>
  );
}

import type { ReactNode } from 'react';
import { Mascot, type Pose } from '@/console/brand';
import { app } from '@/app.config';
import { AppMark } from '@/components/base/app-mark';

/**
 * A screen outside the shell (sign-in, enrolment, signed out, not found): the lit ground, the mark in the corner, and
 * one sentence at poster size that ends on an accent full stop, the one place the accent is punctuation. `aside` is
 * the panel a person acts in.
 */
export function Standalone({ kicker, sentence, lead, aside, pose, children }: { kicker?: ReactNode; sentence: string; lead?: ReactNode; aside?: ReactNode; /** The mascot's pose for this moment, above the sentence. */ pose?: Pose; children?: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-hidden">
      <header className="flex h-20 items-center px-(--gutter)">
        <span className="flex items-center gap-2.5 text-md font-semibold tracking-[-0.015em]">
          <AppMark size={28} />
          {app.name}
        </span>
      </header>
      {/* Three blocks, not two, because the order differs by width and one column cannot express both. A phone reads
          top to bottom — what this is, then what to do about it, then what it holds. `aside` is documented as "the panel
          a person acts in", and putting `children` before it in the DOM (which the wide layout wants) put `Sign in`
          under three paragraphs about the product: the action was below the fold on every phone. On `lg` the hero and
          what it holds stack in the left column and the action takes the right, spanning both. */}
      <div className="mx-auto grid w-full max-w-(--stage-width) flex-1 items-center gap-12 px-(--gutter) pt-6 pb-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,26rem)] lg:content-center lg:gap-x-20">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {pose ? <Mascot pose={pose} scale={1.25} className="mb-10 w-fit" /> : null}
          {kicker ? <p className="t-kicker mb-6">{kicker}</p> : null}
          <h1 className="t-display max-w-[13ch] text-balance">
            {sentence.replace(/\.$/, '')}
            <span className="text-accent">.</span>
          </h1>
          {lead ? <p className="t-lead mt-6 max-w-[46ch]">{lead}</p> : null}
        </div>
        {aside ? <div className="min-w-0 max-lg:max-w-md lg:col-start-2 lg:row-span-2 lg:row-start-1">{aside}</div> : null}
        {children ? <div className="min-w-0 lg:col-start-1 lg:row-start-2">{children}</div> : null}
      </div>
      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-(--gutter) py-5 text-xs text-ink-3">
        <span>{app.name} · AI friend for a brighter you</span>
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

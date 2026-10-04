import Image from 'next/image';
import type { ReactNode } from 'react';
import { AppMark } from '@/console-old/AppMark';
import { cn } from '@/lib/cn';

/**
 * A screen that stands outside the app shell — signed out, a 404, a passkey enrolment. There is
 * no data to lead with, so the page leads with one sentence at poster size, the way the sign-in
 * screen does, and the mascot (when the moment has one) floats on a tinted disc above it.
 *
 * The mark sits in the corner rather than over the title: on a screen this empty, a logo stacked
 * above a heading reads as a form, and the title is the thing to read.
 *
 * DELIBERATE: the illustration is whatever the caller passes. Which artwork belongs to which
 * moment is `checks/mascot-assignment.ts`'s business, pinned per file, so this component must
 * not choose one.
 */
export function Standalone({
  illustration,
  eyebrow,
  title,
  children,
  className,
}: {
  illustration?: { src: string; width: number; height: number };
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <main className="relative grid min-h-dvh grid-rows-[auto_1fr] overflow-y-auto bg-bg">
      <header className="px-6 pt-6 sm:px-12 sm:pt-8">
        <AppMark withWordmark className="animate-rise" />
      </header>
      <div className={cn('flex flex-col items-center justify-center gap-8 px-6 pb-16 pt-8 text-center sm:px-12', className)}>
        {illustration ? (
          <div className="animate-rise relative grid place-items-center [animation-delay:60ms]">
            <span aria-hidden className="absolute size-44 rounded-full bg-accent-tint sm:size-52" />
            <Image
              src={illustration.src}
              alt=""
              width={illustration.width}
              height={illustration.height}
              priority
              className="drift relative h-40 w-auto object-contain sm:h-48"
            />
          </div>
        ) : null}
        <div className="flex max-w-[40rem] flex-col items-center gap-5">
          {eyebrow ? <p className="t-eyebrow animate-rise [animation-delay:100ms]">{eyebrow}</p> : null}
          <h1 className="t-hero animate-rise text-balance [animation-delay:140ms]">{title}</h1>
          <div className="animate-rise flex w-full flex-col items-center gap-6 [animation-delay:200ms]">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

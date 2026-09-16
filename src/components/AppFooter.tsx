'use client';

import { useConsole, type Me } from '@/lib/api';

/**
 * What you are looking at, at the foot of every page.
 *
 * THE QUESTION IT ANSWERS IS "WHICH BUILD IS THIS". The console and the platform version
 * separately, because they ship separately and the whole point of two numbers is that they
 * can disagree — a console reading a field its gateway does not send yet is the shape of
 * failure this pair makes diagnosable, and on a busy day both change several times.
 *
 * It rides the `/me` query every page already makes, so it costs no request. The platform
 * half renders as `—` until that answers, and on a page nobody has signed into it stays
 * that way: a signed-out visitor is told what console they are looking at and nothing
 * about the deployment behind it.
 */
export function AppFooter() {
  const { data } = useConsole<Me>('/me');
  return (
    /* NO RULE ACROSS THE PAGE. It had `border-t` on a full-width block, which drew a
       1,056px line under 88px of text — the heaviest element on the page announcing the
       least important thing on it. The line is gone and the text sits at the end of the
       content, quiet enough to be looked up rather than read. */
    <footer className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 t-micro text-ink-faint">
      <span>ZZ Console {process.env.NEXT_PUBLIC_CONSOLE_VERSION ?? '—'}</span>
      <span aria-hidden>·</span>
      <span>platform {data?.platformVersion ?? '—'}</span>
    </footer>
  );
}

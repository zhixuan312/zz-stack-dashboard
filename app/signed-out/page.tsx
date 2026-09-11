import Link from 'next/link';

/**
 * Where /auth/logout lands.
 *
 * Outside the (dash) group on purpose: the shell's gate would immediately offer
 * to sign the person back in, which is a strange thing to do to somebody who
 * has just asked to leave.
 */
export default function SignedOutPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-8">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-[var(--r-md)] border-[1.5px] border-accent text-[13px] font-semibold text-accent"
        >
          ZZ
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">Signed out</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          Your console session has ended. Your passkey is untouched — sign back in
          with it whenever you like.
        </p>
        <Link
          href="/login"
          className="rounded-[var(--r)] bg-accent px-3.5 py-2 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-deep"
        >
          Sign in again
        </Link>
      </div>
    </main>
  );
}

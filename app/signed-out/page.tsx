import Link from 'next/link';
import { Standalone } from '@/components/patterns/standalone';
import { buttonVariants } from '@/components/ui/button';

/**
 * Where /auth/logout lands.
 *
 * DELIBERATE: outside the (dash) group, because the shell's gate would
 * immediately offer to sign the person back in.
 */
export default function SignedOutPage() {
  return (
    <Standalone
      illustration={{ src: '/assets/brand/state-goodbye.png', width: 128, height: 160 }}
      eyebrow="Session ended"
      title={<>Signed out<span className="text-accent">.</span></>}
    >
      <p className="t-lead max-w-[42ch]">
        Your console session has ended. Your passkey is untouched — sign back in with it whenever
        you like.
      </p>
      <Link href="/login" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        Sign in again
      </Link>
    </Standalone>
  );
}

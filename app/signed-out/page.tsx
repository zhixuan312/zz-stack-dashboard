import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Standalone } from '@/console/standalone';

/** Where /auth/logout lands: the session is over, the passkey is untouched. */
export default function SignedOutPage() {
  return (
    <Standalone pose="goodbye" kicker="Session ended" sentence="Signed out." lead="Your console session has ended. Your passkey is untouched; sign back in with it whenever you like.">
      <Button asChild variant="primary" size="lg" className="mt-8"><Link href="/login">Sign in again</Link></Button>
    </Standalone>
  );
}

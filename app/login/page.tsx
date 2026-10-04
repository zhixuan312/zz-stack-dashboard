'use client';

import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, BookOpen, KeyRound, ListTree, ShieldAlert } from 'lucide-react';
import { app } from '@/app.config';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { KeyValue } from '@/components/ui/key-value';
import { Standalone, StandalonePanel } from '@/console/standalone';
import { startAuthentication } from '@simplewebauthn/browser';
import { useQuery } from '@tanstack/react-query';
import { useConsole } from '@/lib/api';
import { type Me } from '@/lib/api-shapes';

/**
 * The sign-in screen: a route, not a state of the dashboard.
 *
 * DELIBERATE: outside the `(dash)` group, so it gets no app shell. Rendered inside one, a
 * visitor who is not signed in sees the full navigation to pages they cannot open. Being a
 * real route also means the back button works and `?next=/skills` survives the ceremony.
 *
 * DELIBERATE: a button, no email field. The credential is discoverable, so the browser offers
 * every passkey it holds for this site and the person picks one. Asking who they are first
 * would ask a question the authenticator is about to answer, and answering it from an email
 * would be an account-existence oracle.
 */

/** The gateway's own status, so the button is never offered when it cannot work. */
interface AuthStatus { configured: boolean; rpId: string | null }

async function authStatus(): Promise<AuthStatus> {
  const res = await fetch('/auth/status', { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AuthStatus;
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in a statically rendered route.
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get('next') ?? '/';
  const denied = params.get('denied') === '1';
  const reason = params.get('reason');

  const me = useConsole<Me>('/me');
  // Not through useConsole: /auth/status is public and sits outside /api/console, so it
  // answers for a visitor with no session at all.
  const status = useQuery({ queryKey: ['auth-status'], queryFn: authStatus, retry: false });

  // Already signed in and allowed: send them where they were going. `replace`, not `push`, so
  // the back button does not bounce them onto this screen again.
  useEffect(() => {
    if (me.data?.mayRead && !denied) router.replace(next);
  }, [me.data?.mayRead, denied, next, router]);

  const configured = status.data?.configured ?? true;

  return (
    <Standalone
      kicker={`${app.name} · AI friend for a brighter you`}
      sentence="Everything the platform records."
      lead="Every team's work, the knowledge behind it, and what the plugins and skills it runs on cost and refuse."
      aside={
        <div className="flex flex-col items-center">
        {/* The greeter stands on the card: the one place the whole mascot appears, because sign-in is the screen with
            nothing to lead with but who the product is. */}
        <figure className="flex flex-col items-center">
          <Image src="/assets/brand/mascot-hero.png" alt="" width={168} height={213} priority className="relative z-10 -mb-3 h-40 w-auto object-contain sm:h-52" />
          <figcaption className="sr-only">ZZ, the platform&apos;s mascot</figcaption>
        </figure>
        <StandalonePanel labelledBy="sign-in">
          <div className="flex flex-col gap-6">
            {denied ? (
              <Banner tone="warning" title="This view is not open to you" icon={<ShieldAlert />}>
                {reason ?? 'You are signed in, but not through a door the console accepts.'}
              </Banner>
            ) : null}
            <div>
              <h2 id="sign-in" className="t-section">Sign in</h2>
              <p className="t-small mt-2 text-ink-2">Use the passkey you registered on this device. Your browser asks you to confirm it is you.</p>
            </div>
            {configured ? <PasskeyButton next={next} /> : (
              <Banner tone="critical" title="Sign-in is not configured">
                This gateway does not know its own address, so it cannot be a relying party. Set <code className="font-mono text-xs">CONSOLE_PUBLIC_URL</code> on the gateway.
              </Banner>
            )}
            <KeyValue items={[{ label: 'Method', value: 'Passkey (WebAuthn)' }, ...(status.data?.rpId ? [{ label: 'This site', value: status.data.rpId, mono: true }] : [])]} />
            <p className="t-caption text-pretty">No passkey yet? Ask an administrator for an enrolment link: accounts are created on the platform, never at this screen. A session here is for this console only.</p>
          </div>
        </StandalonePanel>
        </div>
      }
    >
      <ol className="mt-12 grid max-w-2xl gap-6 sm:grid-cols-3">
        <Line n="01" icon={<ListTree />} title="Teams and initiatives">Where every piece of work sits in its flow, and which gate it waits on.</Line>
        <Line n="02" icon={<BookOpen />} title="Knowledge">What the platform has learned, kept as nodes; corrections supersede, nothing is deleted.</Line>
        <Line n="03" icon={<Activity />} title="Plugins and runs">What each step costs to run, how it is judged, and how every door refuses.</Line>
      </ol>
    </Standalone>
  );
}

function Line({ n, icon, title, children }: { n: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-ink-3">
        <span className="t-eyebrow t-num">{n}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span aria-hidden className="[&_svg]:size-4">{icon}</span>
      </span>
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span className="t-caption">{children}</span>
    </li>
  );
}

/**
 * The passkey ceremony, from the button that starts it to the redirect that ends it.
 *
 * Three steps, and the middle one is the browser's: ask the gateway for options, hand them to
 * `startAuthentication`, post what comes back. The gateway remembers the challenge it chose,
 * in a row keyed by a short-lived cookie, so nothing this component holds decides anything.
 *
 * `credentials: 'same-origin'` is not passed and is not needed: the console and the gateway
 * are one origin behind Caddy, which makes the session cookie first-party and the WebAuthn
 * origin check pass at once.
 *
 * `NotAllowedError` — a cancelled prompt or a timeout — is swallowed rather than shown: the
 * person is looking at the screen they were on and can press the button again. Every other
 * error has its words shown, because the gateway's refusals name what to do.
 */
function PasskeyButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch('/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ next }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options?.error ?? `HTTP ${optionsRes.status}`);

      const credential = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const verdict = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verdict?.error ?? `HTTP ${verifyRes.status}`);

      // DELIBERATE: a full navigation, not router.push. A client-side transition would carry
      // React Query's cache of the unauthenticated session across the boundary.
      window.location.assign(verdict.next ?? next);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setBusy(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" block icon={<KeyRound />} onClick={() => void signIn()} busy={busy}>
        {busy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
      </Button>
      {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
    </div>
  );
}

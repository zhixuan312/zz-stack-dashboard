'use client';

import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, BookOpen, KeyRound, ListTree, ShieldAlert } from 'lucide-react';
import { AppMark } from '@/components/AppMark';
import { Button, Eyebrow } from '@/components/ui';
import { cn } from '@/lib/cn';
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

  /* Three areas, so one markup serves both shapes. On a phone the door comes straight after the
     headline — the button is above the fold — and the tour follows. From `lg` the poster takes
     the left column and the door stands in its own tinted column on the right. */
  return (
    <main className="grid min-h-dvh grid-cols-1 overflow-y-auto bg-bg [grid-template-areas:'head'_'door'_'foot'] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-rows-[1fr_auto] lg:[grid-template-areas:'head_door'_'foot_door']">
      {/* The poster */}
      <section className="flex flex-col justify-between gap-8 px-6 pb-8 pt-6 [grid-area:head] sm:gap-10 sm:pt-8 sm:px-12 lg:px-16 lg:pb-12 lg:pt-12">
        <AppMark withWordmark className="animate-rise" />
        <div className="flex max-w-[44rem] flex-col gap-6">
          <Eyebrow className="animate-rise [animation-delay:60ms]">The ZZ platform, in one place</Eyebrow>
          <h1 className="t-hero animate-rise max-w-[13ch] text-balance [animation-delay:120ms]">
            Everything the platform records<span className="text-accent">.</span>
          </h1>
          <p className="t-lead animate-rise max-w-[48ch] [animation-delay:180ms]">
            Every team&apos;s work, the knowledge behind it, and the telemetry of the plugins and
            skills it runs on.
          </p>
          <FlowTrack />
        </div>
      </section>

      {/* The tour — three things the console answers, as a numbered strip. */}
      <section className="border-line px-6 pb-12 [grid-area:foot] sm:px-12 lg:border-t lg:px-16 lg:py-10">
        <ol className="grid max-w-[60rem] grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
          <Line n="01" icon={<ListTree />} title="Teams and initiatives">
            Where every piece of work sits in the seven-step flow, and which gate it is waiting on.
          </Line>
          <Line n="02" icon={<BookOpen />} title="Knowledge">
            What the platform has learned, kept as nodes — corrections supersede, nothing is deleted.
          </Line>
          <Line n="03" icon={<Activity />} title="Plugins, skills and runs">
            What each step costs to run, how it is judged, and how every door actually refuses.
          </Line>
        </ol>
      </section>

      {/* The door */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-accent-tint px-6 py-8 [grid-area:door] sm:py-12 sm:px-12 lg:border-l lg:border-line">
        {/* Two quiet orbits behind the greeter — the only drawing on the screen, and it does not
            move. Bordered boxes, not an SVG: an inline SVG here would be a second hand-drawn
            mark as far as checks/one-mark.ts can tell, and these are only circles. */}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-accent/15" />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-accent/15" />

        <div className="relative flex w-full max-w-[24rem] flex-col items-center">
          {/* The greeter, standing on the card. Her tagline is her caption. */}
          <figure className="animate-rise flex flex-col items-center gap-2 [animation-delay:200ms]">
            <div className="relative">
              <Image
                src="/assets/brand/mascot-hero.png"
                alt=""
                width={320}
                height={400}
                priority
                className="drift relative z-10 h-28 w-auto object-contain sm:h-56 lg:h-64"
              />
              <span aria-hidden className="drift-shadow absolute -bottom-1 left-1/2 h-3 w-28 -translate-x-1/2 rounded-[50%] bg-accent-deep/25 blur-[6px]" />
            </div>
            <figcaption className="pt-2 text-sm font-medium text-accent-deep">AI friend for a brighter you</figcaption>
          </figure>

          <div className="animate-rise mt-4 flex w-full sm:mt-6 flex-col gap-5 rounded-[var(--r-lg)] border border-line-strong bg-surface p-6 shadow-[var(--shadow-lg)] [animation-delay:280ms]">
            {denied ? (
              <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--amber)] bg-[var(--amber-tint)] p-3.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--amber-text)]">
                  <ShieldAlert className="size-4" aria-hidden />
                  This view is not open to you
                </span>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {reason ?? 'You are signed in, but not through a door the console accepts.'}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <h2 className="t-title">Sign in</h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                Use the passkey you registered on this device. Your browser will ask you to
                confirm it&apos;s you.
              </p>
            </div>

            {configured ? (
              <PasskeyButton next={next} />
            ) : (
              <div className="rounded-[var(--r-md)] border border-[var(--rose)] bg-[var(--rose-tint)] p-3.5">
                <p className="text-sm font-semibold text-[var(--rose-deep)]">Sign-in is not configured</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  This gateway does not know its own address, so it cannot be a relying party.
                  Set{' '}
                  <code className="rounded-[var(--r-sm)] bg-surface-2 px-1 py-0.5 font-mono text-[11px]">CONSOLE_PUBLIC_URL</code>{' '}
                  on the gateway.
                </p>
              </div>
            )}

            <dl className="flex flex-col gap-2 border-t border-line pt-4 text-xs text-ink-faint">
              <Meta k="Method" v="Passkey · WebAuthn" />
              {status.data?.rpId ? <Meta k="This site" v={status.data.rpId} mono /> : null}
            </dl>
          </div>

          <p className="animate-rise mt-5 max-w-[24rem] text-center text-xs leading-relaxed text-ink-soft [animation-delay:340ms]">
            No passkey yet? Ask an administrator for an enrolment link — accounts are created on
            the platform, never at this screen. A session here is for this dashboard only.
          </p>
        </div>
      </section>
    </main>
  );
}

/**
 * The seven-step flow, drawn the way the Initiatives list draws an initiative's position — done
 * steps green, the current one in the accent, the rest waiting — at poster size. It is the
 * console's own vocabulary introduced before sign-in, so the first table a person opens already
 * reads.
 */
const STEPS = ['done', 'done', 'done', 'done', 'now', 'next', 'next'] as const;

function FlowTrack() {
  return (
    <figure className="flex max-w-[30rem] flex-col gap-2.5 pt-2">
      <div aria-hidden className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={i}
            style={{ ['--i' as string]: i }}
            className={cn(
              'bar-grow h-2.5 flex-1 rounded-[var(--r-pill)] [animation-delay:calc(var(--i)*70ms+260ms)]',
              s === 'done' && 'bg-green',
              s === 'now' && 'bg-accent shadow-[0_0_0_4px_var(--accent-tint)]',
              s === 'next' && 'bg-line-strong',
            )}
          />
        ))}
      </div>
      <figcaption className="text-xs text-ink-faint">
        Every initiative, step by step — drawn the way the console draws it.
      </figcaption>
    </figure>
  );
}

function Line({ n, icon, title, children }: { n: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-ink-faint">
        <span className="t-eyebrow tabular-nums">{n}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span aria-hidden className="[&_svg]:size-4">{icon}</span>
      </span>
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span className="text-xs leading-relaxed text-ink-soft">{children}</span>
    </li>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{k}</dt>
      <dd className={mono ? 'font-mono text-[11px] text-ink-soft' : 'text-ink-soft'}>{v}</dd>
    </div>
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
      <Button variant="primary" size="lg" fullWidth onClick={() => void signIn()} disabled={busy}>
        <KeyRound className="size-[18px]" aria-hidden />
        {busy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
      </Button>
      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-[var(--rose-deep)]">{error}</p>
      ) : null}
    </div>
  );
}

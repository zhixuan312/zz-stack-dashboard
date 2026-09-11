'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, BookOpen, KeyRound, ListTree, ShieldAlert } from 'lucide-react';
import { Button, ThemeToggle } from '@/components/ui';
import { startAuthentication } from '@simplewebauthn/browser';
import { useQuery } from '@tanstack/react-query';
import { useConsole, type Me } from '@/lib/api';

/**
 * The sign-in screen. A ROUTE, not a state of the dashboard.
 *
 * It used to be rendered inside the app shell, which meant a person who was not
 * signed in saw the full navigation — nine links to pages they could not open —
 * with a sign-in box floating in the content area. That reads as a dashboard
 * that failed to load, not as a door. The rail also had to lie to fill itself:
 * "Signed in · You: —".
 *
 * So this lives outside the `(dash)` group entirely and gets no shell at all.
 * Being a real route also means the URL is honest, the back button works, and a
 * deep link survives: `?next=/skills` is carried through the ceremony and back.
 *
 * A BUTTON, NOT A LINK, AND NO EMAIL FIELD. The door is a passkey now, and the
 * ceremony is driven from this page by script — there is no server route to
 * navigate to. The credential is discoverable, so the browser offers every
 * passkey it holds for this site and the person picks one; asking who they are
 * first would be asking a question the authenticator is about to answer, and
 * answering it from an email would be an account-existence oracle for anybody
 * who wanted to enumerate.
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
  // NOT through useConsole: /auth/status is public and sits outside
  // /api/console, so it answers for a visitor who has no session at all —
  // which is precisely who is looking at this page.
  const status = useQuery({ queryKey: ['auth-status'], queryFn: authStatus, retry: false });

  // Already signed in and allowed? Then this page is not for them — send them
  // where they were going. `replace`, not `push`, so the back button does not
  // bounce them straight back onto a login screen they never asked for.
  useEffect(() => {
    if (me.data?.mayRead && !denied) router.replace(next);
  }, [me.data?.mayRead, denied, next, router]);

  const configured = status.data?.configured ?? true;

  return (
    <main className="grid min-h-dvh grid-cols-1 overflow-y-auto bg-bg lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* ── what this is ──────────────────────────────────────────────────
          A person arriving from a directory sign-in has no idea what they are
          about to be shown. Three lines is enough to say it, and it also makes
          the screen look like a product rather than a lock. */}
      <section className="flex flex-col justify-center gap-8 border-line px-8 py-14 sm:px-14 lg:border-r">
        <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-8">
        <div className="flex flex-col gap-5">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-[var(--r-md)] border-[1.5px] border-accent text-[11px] font-semibold text-accent"
            >
              ZZ
            </span>
            <span className="text-[15px] font-semibold text-ink">ZZ Console</span>
          </span>
          <h1 className="max-w-[16ch] text-[clamp(1.75rem,1.2rem+1.8vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.022em] text-ink">
            Everything the platform records, in one place.
          </h1>
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            Every team&apos;s work, the knowledge behind it, and the telemetry of
            the skills and building blocks it runs on.
          </p>
        </div>

        <ul className="flex max-w-[46ch] flex-col gap-3.5">
          <Line icon={<ListTree />} title="Teams and initiatives">
            Where every piece of work sits in the seven-step flow, and which gate it is waiting on.
          </Line>
          <Line icon={<BookOpen />} title="Knowledge">
            What the platform has learned, kept as nodes — corrections supersede, nothing is deleted.
          </Line>
          <Line icon={<Activity />} title="Skills, blocks and runs">
            What each step costs to run, how it is judged, and how every block actually refuses.
          </Line>
        </ul>
        </div>
      </section>

      {/* ── the door ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col justify-center px-8 py-14 sm:px-14">
        <div className="mx-auto flex w-full max-w-[23rem] flex-col gap-6">
        {denied ? (
          <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--amber)] bg-[var(--amber-tint)] p-4">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--amber-text)]">
              <ShieldAlert className="size-4" aria-hidden />
              This view is not open to you
            </span>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {reason ?? 'You are signed in, but not through a door the console accepts.'}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <h2 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">Sign in</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Use the passkey you registered on this device. Your browser will ask
            you to confirm it&apos;s you.
          </p>
        </div>

        {configured ? (
          <PasskeyButton next={next} />
        ) : (
          <div className="rounded-[var(--r-lg)] border border-[var(--rose)] bg-[var(--rose-tint)] p-4">
            <p className="text-[13px] font-semibold text-[var(--rose-deep)]">Sign-in is not configured</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
              This gateway does not know its own address, so it cannot be a
              relying party. Set{' '}
              <code className="rounded-[var(--r-sm)] bg-surface-2 px-1 py-0.5 font-mono text-[11px]">CONSOLE_PUBLIC_URL</code>{' '}
              on the gateway.
            </p>
          </div>
        )}

        <div className="h-px bg-line" />

        <dl className="flex flex-col gap-2 text-xs text-ink-faint">
          <Meta k="Method" v="Passkey · WebAuthn" />
          {status.data?.rpId ? <Meta k="This site" v={status.data.rpId} mono /> : null}
        </dl>

        <p className="text-xs leading-relaxed text-ink-faint">
          No passkey yet? Ask an administrator for an enrolment link — accounts
          are created on the platform, never at this screen.
        </p>

        <p className="text-xs leading-relaxed text-ink-faint">
          Signing in here creates a session for this dashboard only. It does not
          change what you can do anywhere else on the platform.
        </p>

        <div className="pt-1">
          <ThemeToggle />
        </div>
        </div>
      </section>
    </main>
  );
}

function Line({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 text-ink-faint [&_svg]:size-[18px]">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="text-[13px] leading-relaxed text-ink-soft">{children}</span>
      </span>
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
 * THREE STEPS AND THE MIDDLE ONE IS THE BROWSER'S. We ask the gateway for options, hand them
 * to `startAuthentication`, and post what comes back. The gateway remembers the challenge it
 * chose (in a row, keyed by a short-lived cookie), so nothing this component holds decides
 * anything — it cannot, which is the point.
 *
 * `credentials: 'same-origin'` is not passed and does not need to be: the console and the
 * gateway are one origin behind Caddy, which is what makes the session cookie first-party and
 * the WebAuthn origin check pass at the same time.
 *
 * A CANCELLED PROMPT IS NOT AN ERROR TO SHOUT ABOUT. Pressing Escape throws
 * `NotAllowedError`, and so does a timeout; either way the person is looking at the screen
 * they were on and the honest response is to go quiet and let them press it again. Everything
 * else gets its words shown, because the gateway's refusals name what to do.
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

      // A FULL NAVIGATION, not router.push. The session cookie was set by the response we
      // just read, and the whole app's data is fetched behind it — a client-side transition
      // would carry React Query's cache of an unauthenticated session across the boundary.
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
        <p role="alert" className="text-[13px] leading-relaxed text-[var(--rose-deep)]">{error}</p>
      ) : null}
    </div>
  );
}

'use client';

import { AppMark } from '@/components/AppMark';
import { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { Button } from '@/components/ui';

/**
 * Where an enrolment link lands: register a passkey, once, and be signed in with it.
 *
 * THE TOKEN IS IN THE FRAGMENT, and that is the whole reason this page reads it with script
 * instead of taking a search parameter. A `?t=` token is written to Caddy's access log, to the
 * browser's history, and to the `Referer` of anything the page loads afterwards. A fragment is
 * never sent to a server at all, so it reaches none of those — the page reads
 * `window.location.hash` and posts it, and then clears it so a screenshot or a back button
 * does not carry it either.
 *
 * WHY THIS PAGE EXISTS RATHER THAN A FIELD ON THE SIGN-IN SCREEN. An authenticator asserts
 * possession of a key, never an identity. So a registration that named its own account would
 * be open self-registration: anybody reaching the console could mint themselves a principal.
 * The link names the principal instead, and the principal was created by a superadmin before
 * the link existed. The gateway reads it off the token's row and never off this page's body.
 *
 * SINGLE USE, SPENT WHEN THE CEREMONY STARTS. Cancelling the browser's prompt burns the link
 * — that is deliberate, and the wording below says so before the button is pressed rather
 * than after. A link that survived a cancel is a link somebody can retry with, which is not
 * what "usable once" means.
 */
export default function EnrolPage() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, not during render: `window` does not exist while this is prerendered, and the
  // hash is a client fact by construction — the server never received it.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const t = hash.get('t');
    if (t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading React state FROM an external store (the URL fragment) on mount is the case effects exist for. There is no render-time value to derive it from: the fragment is never sent to the server, so it does not exist during the prerender this page gets.
      setToken(t);
      // Out of the address bar the moment we have it. The value lives in this component's
      // state for the length of one ceremony and nowhere else.
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function enrol() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch('/auth/passkey/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token, next: '/' }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options?.error ?? `HTTP ${optionsRes.status}`);

      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const verdict = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verdict?.error ?? `HTTP ${verifyRes.status}`);

      // A full navigation, not router.push: the session cookie was set by the response we
      // just read, and every page behind it fetches with that cookie.
      window.location.assign(verdict.next ?? '/');
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        // The link is spent either way — the gateway burns it when the ceremony starts — so
        // say that plainly rather than inviting a retry that will be refused.
        setError('That was cancelled, and the link is now used up. Ask for a new one.');
        setBusy(false);
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-8">
      <div className="flex w-full max-w-[25rem] flex-col gap-6">
        <AppMark withWordmark />

        {token ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-ink">
                Register your passkey
              </h1>
              <p className="text-sm leading-relaxed text-ink-soft">
                Your browser will ask you to confirm — Touch ID, Windows Hello, a
                phone, or a security key. After that you sign in with it and never
                need this link again.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="primary" size="lg" fullWidth onClick={() => void enrol()} disabled={busy}>
                <KeyRound className="size-[18px]" aria-hidden />
                {busy ? 'Waiting for your device…' : 'Register a passkey'}
              </Button>
              {error ? (
                <p role="alert" className="text-[13px] leading-relaxed text-[var(--rose-deep)]">{error}</p>
              ) : null}
            </div>

            <p className="text-xs leading-relaxed text-ink-faint">
              This link works once. Register on the device you actually want to sign
              in from — an administrator can issue another for a second device.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--amber)] bg-[var(--amber-tint)] p-4">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--amber-text)]">
              <ShieldAlert className="size-4" aria-hidden />
              No enrolment link
            </span>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              This page needs the link an administrator sent you, opened whole —
              including everything after the <code>#</code>. Accounts are created on
              the platform, so there is nothing to fill in here.
            </p>
          </div>
        )}

        <div className="pt-1">
        </div>
      </div>
    </main>
  );
}

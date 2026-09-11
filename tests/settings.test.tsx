import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { credentialStatus, CredentialsPanel } from '@/components/settings/CredentialsPanel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import { TokensPanel } from '@/components/settings/TokensPanel';
import type { RedactedMarker } from '@/lib/api';

/**
 * Task I-13's own rule, tested at two levels:
 *
 *   1. `credentialStatus` — the pure function extracted from `CredentialsPanel`
 *      that decides the credential badge — reads ONLY `.present`/`.length` off
 *      a `RedactedMarker`, proven by handing it a marker shaped the way a
 *      future gateway defect might actually produce one (an extra field that
 *      should never have been there) and asserting nothing about it survives
 *      into the label.
 *   2. `CredentialsPanel` itself, rendered against a mocked `fetch` returning
 *      that same adversarial marker, asserting the planted value never
 *      reaches the DOM — the property the pure function's contract only
 *      PROMISES; this is what actually happens when React renders it.
 *
 * `InlineDestructive` is this console's third implementation of the
 * inline-confirm-no-modal shape (after `ApproveAction` and `FormPanel`'s own
 * `destructive` slot) — used here for every revoke/disconnect/delete action
 * on the settings page (NFR-4) — so its swap behaviour is covered the same
 * way `ApproveAction`'s is in tests/approve-action.test.tsx.
 */

const LEAKED = 'THIS-RAW-VALUE-MUST-NEVER-RENDER-9f3a';

// A marker shaped the way redact.ts actually produces one, PLUS a field that
// should not exist — the shape a defect upstream (a route that forgot to
// build `{ platform, api_key }` before calling `redact()`, or a `redact()`
// change that stopped stripping something) would hand this component. Real
// `RedactedMarker`s never carry this; the test does not assume redact.ts
// stays correct, it proves this file's OWN rendering is safe even if it did not.
const adversarialMarker = {
  redacted: true,
  present: true,
  length: 40,
  fingerprint: 'sha256:deadbeefcafe',
  raw_value_that_must_never_render: LEAKED,
} as unknown as RedactedMarker;

describe('credentialStatus', () => {
  it('reports a stored key by presence and length only', () => {
    expect(credentialStatus({ redacted: true, present: true, length: 24 })).toEqual({
      label: 'set · 24 chars', variant: 'sage',
    });
  });

  it('reports no key without inventing a length', () => {
    expect(credentialStatus({ redacted: true, present: false })).toEqual({
      label: 'not set', variant: 'neutral',
    });
  });

  it('never surfaces a field it was not built to read, even when one is present', () => {
    const status = credentialStatus(adversarialMarker);
    expect(status.label).not.toContain(LEAKED);
    expect(JSON.stringify(status)).not.toContain(LEAKED);
  });
});

describe('CredentialsPanel — a secret value is never rendered', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function renderPanel() {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <CredentialsPanel />
      </QueryClientProvider>,
    );
  }

  it('renders presence and length for a set credential, never the leaked field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ platform: 'casebox', api_key: adversarialMarker }],
    }) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() => expect(screen.getByText('casebox')).toBeInTheDocument());
    expect(screen.getByText('set · 40 chars')).toBeInTheDocument();
    expect(screen.queryByText(LEAKED, { exact: false })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(LEAKED);
  });

  it('renders "not set" for a platform with no key, and no length at all', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ platform: 'bookit', api_key: { redacted: true, present: false } }],
    }) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() => expect(screen.getByText('bookit')).toBeInTheDocument());
    expect(screen.getByText('not set')).toBeInTheDocument();
    expect(screen.queryByText(/chars/)).not.toBeInTheDocument();
  });
});

describe('TokensPanel — the one plaintext exception, shown exactly once', () => {
  const originalFetch = global.fetch;
  const ISSUED_TOKEN = 'zzpat_TEST_9f3a1b2c3d4e5f60';

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function renderPanel() {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <TokensPanel />
      </QueryClientProvider>,
    );
  }

  it('shows the freshly issued token after Issue, then drops it for good on dismiss', async () => {
    const user = userEvent.setup();
    // GET (the list) answers empty; POST (issue) answers the one plaintext
    // shape settings.ts's route sends — see that route's own comment for why
    // it is the single response in the whole gateway file not run through
    // redact(). Dispatched on `init.method` because both requests land on
    // the same mocked `fetch`.
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'POST') {
        return Promise.resolve({
          ok: true, json: async () => ({ token: ISSUED_TOKEN, label: '', email: 'a@b.example.com' }),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as Response);
    }) as unknown as typeof fetch;

    renderPanel();

    await waitFor(() => expect(screen.getByText('No tokens issued yet')).toBeInTheDocument());
    expect(screen.queryByText(ISSUED_TOKEN)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Issue token' }));

    await waitFor(() => expect(screen.getByText(ISSUED_TOKEN)).toBeInTheDocument());
    expect(screen.getByText(/shown once, store it now/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /I.ve stored it/ }));

    // Gone from the DOM, not merely hidden — a re-render must not be able to
    // bring it back, which is the whole reason this state lives in
    // `useState` rather than `useConsoleMutation`'s cache (see TokensPanel's
    // own comment).
    expect(screen.queryByText(ISSUED_TOKEN)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(ISSUED_TOKEN);
  });
});

describe('InlineDestructive', () => {
  it('shows the plain action first, no confirmation and no dialog', () => {
    render(<InlineDestructive label="Revoke" question="Revoke this token?" onConfirm={() => {}} />);
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.queryByText('Revoke this token?')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('swaps to an inline Cancel/Confirm on click, still never a modal', async () => {
    const user = userEvent.setup();
    render(<InlineDestructive label="Revoke" question="Revoke this token?" confirmLabel="Revoke" onConfirm={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(screen.getByText('Revoke this token?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('only calls onConfirm after the confirm step, never on the first click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<InlineDestructive label="Disconnect" question="Disconnect casebox?" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel returns to the plain action without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<InlineDestructive label="Remove" question="Remove this key?" onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

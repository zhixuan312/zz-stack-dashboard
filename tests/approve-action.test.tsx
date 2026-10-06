import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveAction, OutOfDate, canApprove, useRecordShown, type Shown } from '@/console/approve';
import { Toaster } from '@/components/ui/toast';
import type { DocumentDetail, Me } from '@/lib/api-shapes';

// Rendering is not enforcement — see canApprove's own comment — but a control
// shown to someone who cannot use it, or hidden from a document nobody can
// approve, is the bug this locks down. COUPLED: the page calls `canApprove` a
// second time, to decide whether to hand DocumentShell an `actions` slot at
// all, and a divergence between the two call sites would be silent.
const me: Me = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true,
  superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'member' }],
  activeTeam: 'team-one',
};

const doc: DocumentDetail = {
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow', current_revision: 1,
  current_version: 1, correction: null, content_revision: 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaa',
  type: 'spec', status: 'draft', outcome: null,
  approved_by: null, approved_at: null, closed_by: null,
  title: 'The spec', tags: null, evidence: null, superseded_by: null, body: 'body',
  updated_at: '2026-09-01T00:00:00Z', bytes: 4,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  versions: [{ path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null,
               updated_at: '2026-09-01T00:00:00Z', version: 1, revision: 1 }],
  sources: [],
};

const CONTEXT = 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb';
const recorded: Shown = { state: 'recorded', content_revision: doc.content_revision, review_context: CONTEXT };

/** A fetch that answers every call with `status` and `body`, recording what was sent. */
function answering(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}
/** What one recorded call sent: its address and its JSON body. */
function sent(mock: ReturnType<typeof answering>, i = 0): { url: string; body: Record<string, unknown> } {
  const [url, init] = mock.mock.calls[i] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('canApprove', () => {
  it('admits a member of the document\'s team', () => {
    expect(canApprove(doc, me)).toBe(true);
  });

  // zz-core records the console's presentation, and signs, in the team the session acts for and only for a member.
  it('refuses a superadmin who belongs to no team', () => {
    expect(canApprove(doc, { ...me, teams: [], activeTeam: null, superadmin: true })).toBe(false);
  });

  it('refuses a member whose session acts for another of their teams', () => {
    expect(canApprove(doc, { ...me, teams: [...me.teams, { slug: 'other-team', role: 'member' }], activeTeam: 'other-team' })).toBe(false);
  });

  it('refuses someone on a different team', () => {
    expect(canApprove(doc, { ...me, teams: [{ slug: 'other-team', role: 'member' }], activeTeam: 'other-team' })).toBe(false);
  });

  it('refuses when nobody is signed in yet', () => {
    expect(canApprove(doc, undefined)).toBe(false);
  });

  // gated has three states, and only one of them is "waiting on a person".
  it('refuses an ungated document — no approval is coming', () => {
    expect(canApprove({ ...doc, gated: false }, me)).toBe(false);
  });

  it('refuses a source — the flow says nothing about it', () => {
    expect(canApprove({ ...doc, gated: null }, me)).toBe(false);
  });

  it('refuses a document that is already approved', () => {
    expect(canApprove({ ...doc, approved_by: 'x@y.example.com' }, me)).toBe(false);
  });

  // Only a browser session can record what the console showed, and Approve signs only that.
  it('refuses a caller who is not a browser session', () => {
    expect(canApprove(doc, { ...me, via: 'pat', superadmin: true })).toBe(false);
  });
});

describe('useRecordShown', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  }

  it('records the displayed snapshot once, and holds the context it was handed', async () => {
    const fetchMock = answering(200, { ok: true, review_context: CONTEXT, content_revision: doc.content_revision, recorded: true });
    try {
      const { result, rerender } = renderHook(({ d }) => useRecordShown(d, true), { wrapper, initialProps: { d: doc } });
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      // A refetch hands the page an equal document as a new object: the same snapshot, not a second showing.
      rerender({ d: { ...doc } });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { url, body } = sent(fetchMock);
      expect(url).toBe('/api/console/documents/shown?team=team-one');
      expect(body).toEqual({ initiative: 'init-1', path: 'spec.md', content_revision: doc.content_revision });
      expect(result.current.shown).toEqual(recorded);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('records a new snapshot under the context it already holds', async () => {
    const fetchMock = answering(200, { ok: true, review_context: CONTEXT, content_revision: 'x', recorded: true });
    try {
      const { result, rerender } = renderHook(({ d }) => useRecordShown(d, true), { wrapper, initialProps: { d: doc } });
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      rerender({ d: { ...doc, content_revision: 'cr_cccccccccccccccccccccccccc' } });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(sent(fetchMock, 1).body).toEqual({ initiative: 'init-1', path: 'spec.md',
        content_revision: 'cr_cccccccccccccccccccccccccc', review_context: CONTEXT });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('records nothing while Approve is not on offer', () => {
    const fetchMock = answering(200, {});
    try {
      const { result } = renderHook(() => useRecordShown(doc, false), { wrapper });
      expect(result.current.shown).toEqual({ state: 'off' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('says the page is out of date when the document moved before it was recorded', async () => {
    const fetchMock = answering(409, { error: 'spec.md changed after this page loaded it. Reload to read what it says now.', conflict: 'changed' });
    try {
      const { result } = renderHook(() => useRecordShown(doc, true), { wrapper });
      await waitFor(() => expect(result.current.shown.state).toBe('stale'));
      expect(result.current.shown).toMatchObject({ message: 'spec.md changed after this page loaded it. Reload to read what it says now.' });
      // Asked again, the same snapshot is recorded again: a reload that found nothing new still retries.
      act(() => result.current.again());
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe('ApproveAction', () => {
  it('shows the Approve control to an eligible team member', () => {
    renderWithClient(<ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('renders nothing for someone on a different team', () => {
    const { container } = renderWithClient(
      <ApproveAction doc={doc} me={{ ...me, teams: [{ slug: 'other-team', role: 'member' }] }} shown={recorded} onStale={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('swaps to an inline confirmation, never a modal, on click', async () => {
    const user = userEvent.setup();
    renderWithClient(<ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByText('Approve this document?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for the presentation to be recorded before it can be pressed', () => {
    renderWithClient(<ApproveAction doc={doc} me={me} shown={{ state: 'recording', content_revision: doc.content_revision }} onStale={() => {}} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  /* The success toast is transient (it leaves after five seconds) so a screenshot cannot reach
   * it, and this test is what holds it: a success says so, not only a failure.
   */
  it('confirms a successful approval in a toast, not only the error path', async () => {
    const user = userEvent.setup();
    const fetchMock = answering(200, { ok: true });
    try {
      renderWithClient(
        <>
          <ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />
          <Toaster />
        </>,
      );
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByText(`Approved ${doc.path}`)).toBeInTheDocument();
      expect(screen.queryByText('Not approved')).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
  });

  // After the toast case: a toast outlives the test that raised it, and that case looks for exactly one.
  it('approves exactly the snapshot it showed, under the context it was handed', async () => {
    const user = userEvent.setup();
    const fetchMock = answering(200, { ok: true, result: 'approved' });
    try {
      renderWithClient(<ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />);
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const { url, body } = sent(fetchMock);
      expect(url).toBe('/api/console/documents/approve?team=team-one');
      expect(body).toEqual({ initiative: 'init-1', path: 'spec.md', expected_revision: doc.content_revision, review_context: CONTEXT });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('hands a conflict to the page in the gateway\'s words, not a toast', async () => {
    const user = userEvent.setup();
    const said = 'spec.md changed after this page showed it, so it was not approved. Reload to read what it says now, then approve that.';
    const fetchMock = answering(409, { error: said, conflict: 'changed' });
    const onStale = vi.fn();
    try {
      renderWithClient(<><ApproveAction doc={doc} me={me} shown={recorded} onStale={onStale} /><Toaster /></>);
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(onStale).toHaveBeenCalledWith(said));
      expect(screen.queryByText('Not approved')).toBeNull();
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe('OutOfDate', () => {
  it('says why the page is out of date and reloads on request', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const said = 'spec.md changed after this page showed it, so it was not approved. Reload to read what it says now, then approve that.';
    render(<OutOfDate message={said} failed={false} onReload={onReload} />);
    expect(screen.getByRole('status')).toHaveTextContent('This page is out of date');
    expect(screen.getByText(said)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('is an alert when the record of showing it failed', () => {
    render(<OutOfDate message="zz-core unreachable" failed onReload={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not recorded as shown');
  });
});

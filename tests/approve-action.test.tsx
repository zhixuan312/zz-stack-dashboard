import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
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
  title: 'The spec', tags: null, stakeholder: null, fields: {}, evidence: null, superseded_by: null, body: 'body',
  updated_at: '2026-09-01T00:00:00Z', bytes: 4,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  versions: [{ path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null,
               updated_at: '2026-09-01T00:00:00Z', version: 1, revision: 1 }],
  sources: [],
};

const CONTEXT = 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb';
const recorded: Shown = { state: 'recorded', content_revision: doc.content_revision, review_context: CONTEXT };
const NEWER = 'cr_cccccccccccccccccccccccccc';

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

  // A refetch can bring a newer snapshot while the reader is mid-way through what they were shown: the page says so
  // and records nothing until the reader reloads, so Approve can never sign text the reader did not ask to see.
  it('holds a newer snapshot a refetch brought until the reader reloads, then records it under the held context', async () => {
    const fetchMock = answering(200, { ok: true, review_context: CONTEXT, content_revision: 'x', recorded: true });
    try {
      const { result, rerender } = renderHook(({ d }) => useRecordShown(d, true), { wrapper, initialProps: { d: doc } });
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      rerender({ d: { ...doc, content_revision: NEWER } });
      expect(result.current.shown).toEqual({ state: 'changed', content_revision: NEWER });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      act(() => result.current.again(NEWER));
      await waitFor(() => expect(result.current.shown).toEqual({ state: 'recorded', content_revision: NEWER, review_context: CONTEXT }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sent(fetchMock, 1).body).toEqual({ initiative: 'init-1', path: 'spec.md', content_revision: NEWER, review_context: CONTEXT });
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('turns an Approve conflict into an out-of-date page until the reader reloads', async () => {
    const fetchMock = answering(200, { ok: true, review_context: CONTEXT, content_revision: doc.content_revision, recorded: true });
    try {
      const { result } = renderHook(() => useRecordShown(doc, true), { wrapper });
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      act(() => result.current.outdated('spec.md changed after this page showed it.'));
      expect(result.current.shown).toEqual({ state: 'stale', content_revision: doc.content_revision, message: 'spec.md changed after this page showed it.' });
      act(() => result.current.again(doc.content_revision));
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('says the record failed, in the gateway\'s words, when the platform refused it', async () => {
    const fetchMock = answering(502, { error: 'zz-core unreachable' });
    try {
      const { result } = renderHook(() => useRecordShown(doc, true), { wrapper });
      await waitFor(() => expect(result.current.shown).toEqual({ state: 'failed', content_revision: doc.content_revision, message: 'zz-core unreachable' }));
    } finally {
      fetchMock.mockRestore();
    }
  });

  // The page turns `offered` off when a refetch fails: the panel then shows the failure, not the body a record vouches for.
  it('stops offering when the page stops offering', async () => {
    const fetchMock = answering(200, { ok: true, review_context: CONTEXT, content_revision: doc.content_revision, recorded: true });
    try {
      const { result, rerender } = renderHook(({ on }) => useRecordShown(doc, on), { wrapper, initialProps: { on: true } });
      await waitFor(() => expect(result.current.shown.state).toBe('recorded'));
      rerender({ on: false });
      expect(result.current.shown).toEqual({ state: 'off' });
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
      act(() => result.current.again(doc.content_revision));
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

  it('says why Approve is held while the presentation is being recorded', () => {
    renderWithClient(<ApproveAction doc={doc} me={me} shown={{ state: 'recording', content_revision: doc.content_revision }} onStale={() => {}} />);
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve).toHaveAttribute('aria-busy', 'true');
    expect(approve).toHaveAccessibleDescription('Recording that this version was shown to you.');
  });

  it('holds Approve while the page is out of date, so the banner never sits beside a live Approve', () => {
    for (const shown of [
      { state: 'stale', content_revision: doc.content_revision, message: 'changed' },
      { state: 'changed', content_revision: NEWER },
      { state: 'failed', content_revision: doc.content_revision, message: 'unreachable' },
    ] as Shown[]) {
      const { unmount } = renderWithClient(<ApproveAction doc={doc} me={me} shown={shown} onStale={() => {}} />);
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
      unmount();
    }
  });

  // The confirmation answers for the snapshot the reader pressed Approve on. A newer one recorded under it, or the
  // same one recorded again by a reload, is a different thing to sign: the reader presses Approve again for it.
  it('closes the confirmation when the record it was opened on is replaced', async () => {
    const user = userEvent.setup();
    const fetchMock = answering(200, { ok: true, result: 'approved' });
    try {
      const { rerender } = renderWithClient(<ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />);
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      rerender(<QueryClientProvider client={new QueryClient()}>
        <ApproveAction doc={doc} me={me} shown={{ state: 'recorded', content_revision: NEWER, review_context: CONTEXT }} onStale={() => {}} />
      </QueryClientProvider>);
      expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('closes the confirmation while the presentation is being recorded again', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    const { rerender } = render(<QueryClientProvider client={client}><ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    rerender(<QueryClientProvider client={client}>
      <ApproveAction doc={doc} me={me} shown={{ state: 'recording', content_revision: doc.content_revision }} onStale={() => {}} />
    </QueryClientProvider>);
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  // The confirmation opens where Approve was. A double-click on Approve must not land its second click on Confirm:
  // Cancel takes the edge Approve sat on, and a click that is the second of a double-click is not a confirmation.
  it('never approves on the second click of a double-click', async () => {
    const user = userEvent.setup();
    const fetchMock = answering(200, { ok: true, result: 'approved' });
    try {
      renderWithClient(<ApproveAction doc={doc} me={me} shown={recorded} onStale={() => {}} />);
      await user.click(screen.getByRole('button', { name: 'Approve' }));
      const [confirm, cancel] = [screen.getByRole('button', { name: 'Confirm' }), screen.getByRole('button', { name: 'Cancel' })];
      expect(confirm.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(confirm, { detail: 2 });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('tells a member acting for another team to switch before approving', () => {
    renderWithClient(<ApproveAction doc={doc} me={{ ...me, teams: [...me.teams, { slug: 'other-team', role: 'member' }], activeTeam: 'other-team' }} shown={{ state: 'off' }} onStale={() => {}} />);
    expect(screen.getByText('Switch to team-one to approve.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
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
    render(<OutOfDate shown={{ state: 'stale', content_revision: doc.content_revision, message: said }} onReload={onReload} />);
    expect(screen.getByRole('status')).toHaveTextContent('This page is out of date');
    expect(screen.getByText(said)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('says the text changed while it was being read', () => {
    render(<OutOfDate shown={{ state: 'changed', content_revision: NEWER }} onReload={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('This document changed while you were reading it');
    expect(screen.getByRole('status')).toHaveTextContent('Reload to approve this version.');
  });

  it('is an alert, in the reader\'s words first, when the record of showing it failed', () => {
    render(<OutOfDate shown={{ state: 'failed', content_revision: doc.content_revision, message: 'zz-core unreachable' }} onReload={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Approve is unavailable');
    expect(alert).toHaveTextContent('The console could not record that it showed you this version, so it cannot approve it.');
    expect(alert).toHaveTextContent('zz-core unreachable');
  });

  it('draws nothing while the page is in step with the store', () => {
    const { container } = render(<OutOfDate shown={recorded} onReload={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

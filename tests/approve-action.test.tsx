import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveAction, canApprove } from '@/console/approve';
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
  current_version: 1, correction: null,
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

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('canApprove', () => {
  it('admits a member of the document\'s team', () => {
    expect(canApprove(doc, me)).toBe(true);
  });

  it('admits a superadmin who belongs to no team', () => {
    expect(canApprove(doc, { ...me, teams: [], superadmin: true })).toBe(true);
  });

  it('refuses someone on a different team', () => {
    expect(canApprove(doc, { ...me, teams: [{ slug: 'other-team', role: 'member' }] })).toBe(false);
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
});

describe('ApproveAction', () => {
  it('shows the Approve control to an eligible team member', () => {
    renderWithClient(<ApproveAction doc={doc} me={me} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('renders nothing for someone on a different team', () => {
    const { container } = renderWithClient(
      <ApproveAction doc={doc} me={{ ...me, teams: [{ slug: 'other-team', role: 'member' }] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('swaps to an inline confirmation, never a modal, on click', async () => {
    const user = userEvent.setup();
    renderWithClient(<ApproveAction doc={doc} me={me} />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByText('Approve this document?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* The success toast is transient (it leaves after five seconds) so a screenshot cannot reach
   * it, and this test is what holds it: a success says so, not only a failure.
   */
  it('confirms a successful approval in a toast, not only the error path', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }),
    );
    try {
      renderWithClient(
        <>
          <ApproveAction doc={doc} me={me} />
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
});

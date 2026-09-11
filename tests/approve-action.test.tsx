import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveAction, canApprove } from '@/components/ApproveAction';
import type { DocumentDetail, Me } from '@/lib/api';

// Rendering is not enforcement — see canApprove's own comment — but a control
// shown to someone who cannot use it, or hidden from a document nobody can
// approve, is exactly the bug this locks down. `canApprove` is exported and
// tested directly for the same reason `ModeSwitch`'s render rule is: the page
// calls it a second time (to decide whether to hand DocumentShell an `actions`
// slot at all), and a divergence between the two call sites would be silent.
const me: Me = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true,
  superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'member' }],
  activeTeam: 'team-one',
};

const doc: DocumentDetail = {
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow',
  type: 'spec', status: 'draft', outcome: null,
  approved_by: null, approved_at: null, closed_by: null,
  title: 'The spec', tags: null, evidence: null, superseded_by: null, body: 'body',
  updated_at: '2026-09-01T00:00:00Z', bytes: 4,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], versions: [{ path: 'spec.md', body: 'body', status: 'draft', approved_by: null,
                              updated_at: '2026-09-01T00:00:00Z', bytes: 4, version: 9999 }],
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
});

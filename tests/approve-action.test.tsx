import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveAction, canApprove } from '@/components/ApproveAction';
import { Toaster } from '@/components/ui/toast';
import type { DocumentDetail, Me } from '@/lib/api';

// Rendering is not enforcement — see canApprove's own comment — but a control
// shown to someone who cannot use it, or hidden from a document nobody can
// approve, is exactly the bug this locks down. `canApprove` is exported and
// tested directly for the same reason `ModeSwitch`'s render rule is: the page
// calls it a second time (to decide whether to hand DocumentShell an `actions`
// slot at all), and a divergence between the two call sites would be silent.
const me: Me = {
  platformVersion: '0.0.0-test',
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

  /* THE ONE TRANSIENT IN THE BRAND ADOPTION, and the only new surface a screenshot
   * cannot reach: it exists for about three seconds after a click that mutates real
   * state. Every other mascot was validated by rendering the page and looking at it.
   * This one had nothing — so it gets the test the screenshots could not be.
   *
   * It is also the surface with the weakest provenance. The spec asked for the mascot
   * on ApproveAction's SUCCESS toast; ApproveAction had no success toast at all, only
   * an error one, plus a comment arguing that the receipt for a successful approval is
   * the approvers row appearing. Adding one reversed a decision somebody had made on
   * purpose. A reversal that nothing tests is a reversal that quietly un-reverses.
   */
  it('marks a successful approval with the approved mascot, not just an error path', async () => {
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

      const toast = await screen.findByText(`Approved ${doc.path}.`);
      /* The CARD, addressed by its role. `closest('div')` finds the inner text wrapper
         — which holds the message and no image — and the assertion then fails against a
         component that is perfectly correct. A success toast is role="status"; an error
         toast is role="alert", and asserting the role here also pins that this is the
         success path rather than the error one that already existed. */
      const card = toast.closest('[role="status"]');
      expect(card, 'the success toast is not role="status"').not.toBeNull();

      const img = card!.querySelector('img');
      expect(img, 'the success toast renders no illustration').not.toBeNull();
      expect(img!.getAttribute('src')).toContain('state-approved');
      // Decorative: the message beside it already carries the meaning.
      expect(img!.getAttribute('alt')).toBe('');
    } finally {
      fetchMock.mockRestore();
    }
  });
});

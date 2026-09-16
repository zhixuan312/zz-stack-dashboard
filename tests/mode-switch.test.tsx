import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeSwitch } from '@/components/ModeSwitch';

// Rendering is not enforcement — the server decides scope — but a control shown
// to someone who cannot use it is a lie about their authority, so the render
// rule is worth asserting on its own. `Segmented` renders role="radiogroup",
// not "group". No provider is mounted here: `useConsoleMode` falls back to an
// inert default outside `ConsoleModeProvider` specifically so a component that
// only reads it can be rendered standalone, in a test, without dragging in
// `QueryClientProvider` and a real `/me` fetch just to check whether it renders.
const base = {
  platformVersion: '0.0.0-test',
  email: 'a@b.example.com', name: 'A', role: 'member' as const, mayRead: true,
  via: 'session', teams: [{ slug: 'team-one', role: 'member' as const }],
  activeTeam: 'team-one',
};

describe('ModeSwitch', () => {
  it('renders nothing for a member', () => {
    const { container } = render(<ModeSwitch me={{ ...base, superadmin: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled radiogroup for a superadmin', () => {
    render(<ModeSwitch me={{ ...base, role: 'superadmin', superadmin: true }} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});

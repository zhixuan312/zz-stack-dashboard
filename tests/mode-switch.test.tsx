import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeSwitch } from '@/components/ModeSwitch';

// Rendering is not enforcement — the server decides scope — but the render rule is asserted
// on its own so a control never shows to someone who cannot use it. `Segmented` renders
// role="radiogroup", not "group". DELIBERATE: no provider is mounted. `useConsoleMode` falls
// back to an inert default outside `ConsoleModeProvider`, so a component that only reads it
// renders standalone without `QueryClientProvider` and a real `/me` fetch.
const base = {
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

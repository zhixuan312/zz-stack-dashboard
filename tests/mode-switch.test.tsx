import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModeSwitch } from '@/console/settings/console-scope-panel';

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
  it('renders no control for a member', () => {
    render(<ModeSwitch me={{ ...base, superadmin: false }} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('holds the space the switch would take, for a member and before `/me` answers', () => {
    // COUPLED: the row's height may not depend on what the read says. This section is the first
    // on `/settings`, so a control that appears for a superadmin and not for a member — or one
    // that appears only once `/me` lands — moves every section below it, which is the layout
    // shift this section has caused in both directions. The slot is held for all three cases;
    // only its contents differ. `aria-hidden` because a gap is not a control.
    for (const me of [{ ...base, superadmin: false }, undefined]) {
      const { container, unmount } = render(<ModeSwitch me={me} />);
      const slot = container.firstElementChild;
      expect(slot).not.toBeNull();
      expect(slot).toHaveAttribute('aria-hidden');
      expect(container.querySelector('[role="radiogroup"]')).toBeNull();
      unmount();
    }
  });

  it('renders a labelled radiogroup for a superadmin', () => {
    render(<ModeSwitch me={{ ...base, role: 'superadmin', superadmin: true }} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});

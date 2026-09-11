import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarDrawer } from '@/components/ui/sidebar-drawer';

const pathname = { current: '/' };
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

/**
 * The rail below `lg`.
 *
 * The drawer exists because a fixed 232px rail left 158px of usable content on a
 * 390px screen — and every structural check passed, because every check ran at
 * 1280px and up. These lock the behaviours a hand-rolled drawer usually misses;
 * each one is invisible until someone actually uses it on a phone.
 */
describe('SidebarDrawer', () => {
  beforeEach(() => {
    pathname.current = '/';
  });

  it('starts closed and is announced as collapsed', () => {
    render(<SidebarDrawer>rail contents</SidebarDrawer>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a modal dialog holding the SAME rail node', async () => {
    const user = userEvent.setup();
    render(
      <SidebarDrawer>
        <nav>rail contents</nav>
      </SidebarDrawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('rail contents');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SidebarDrawer>rail</SidebarDrawer>);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('releases the body scroll lock when it closes', async () => {
    const user = userEvent.setup();
    render(<SidebarDrawer>rail</SidebarDrawer>);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes when the route changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SidebarDrawer>rail</SidebarDrawer>);
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Tapping a nav link navigates; without this the drawer stays open over the
    // page the user just moved to.
    pathname.current = '/records';
    rerender(<SidebarDrawer>rail</SidebarDrawer>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the trigger on close, not to the document', async () => {
    const user = userEvent.setup();
    render(<SidebarDrawer>rail</SidebarDrawer>);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(trigger).toHaveFocus();
  });
});

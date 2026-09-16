import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StatusDashboard } from '@/components/patterns/status-dashboard';

/**
 * WHICH ELEMENT SCROLLS, AND WHETHER THE METRIC ROW IS INSIDE IT.
 *
 * jsdom does no layout, so "do the tiles move when you scroll" is not observable here.
 * The fact underneath it is, and it is the one that broke: on a rail-less page the metric
 * row was a SIBLING of the scrolling column, so the page scrolled and the four tiles did
 * not move a pixel. Containment is the invariant; the pixels follow from it.
 */
const metrics = [{ label: 'Refusal rate', value: '9%' }];
const draw = (props: Parameters<typeof StatusDashboard>[0]) =>
  render(<TooltipProvider><StatusDashboard {...props} /></TooltipProvider>).container;

/* THE DESKTOP SCROLLER, which is not simply "has overflow-y-auto". Every one of these
 * wrappers carries that at mobile width — the columns only take over from `lg` up — so the
 * outer element matches it on a rail page too and the naive selector found a "scroller"
 * that stops scrolling at the width this rule is about. The desktop scroller is the element
 * that keeps the overflow at `lg`: it either never hands it back (`lg:overflow-visible`
 * absent) or claims it there (`lg:overflow-y-auto`). */
const desktopScrollers = (c: HTMLElement): HTMLElement[] =>
  [...c.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"]')]
    .filter((el) => !el.className.includes('lg:overflow-visible'));

describe('StatusDashboard', () => {
  it('scrolls the metric row with the page when there is no rail', () => {
    const c = draw({ metrics, scroll: 'outer', primary: <p>work</p> });
    const [s, ...rest] = desktopScrollers(c);
    expect(s).toBeDefined();
    // ONE scroller, and the tiles are inside it. Two would mean the column took the
    // overflow back and the row is stranded above it again.
    expect(rest).toHaveLength(0);
    expect(s.textContent).toContain('Refusal rate');
  });

  it('keeps the metric row above the panes when there is a rail', () => {
    // Two columns scrolling independently under one fixed row is what that layout is FOR,
    // so the rail case is asserted too — the fix above must not have changed it.
    const c = draw({ metrics, scroll: 'outer', primary: <p>work</p>, aside: <p>rail</p> });
    const panes = desktopScrollers(c);
    expect(panes.length).toBeGreaterThan(0);
    for (const pane of panes) expect(pane.textContent).not.toContain('Refusal rate');
  });
});

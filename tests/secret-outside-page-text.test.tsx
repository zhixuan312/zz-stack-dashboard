import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace() {} }),
}));

import { SurfaceOverride } from '@/components/base/surface';
import { OMIT, pageText } from '@/components/patterns/assistant/page-text';
import type { Access } from '@/lib/destination-shapes';
import type { People } from '@/lib/fleet-shapes';
import { AccessView } from '@/views/pages/access';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';

/**
 * A secret shown once is never part of the page text the assistant reads (bug ee35a0d7, spec FR-22).
 *
 * The assistant sends the visible text of `[data-scroll-region]` with every message, without any node marked
 * `data-assistant="omit"` (ZZ Meridian's `pageText`). A newly issued token, on Access, and a superadmin's enrolment
 * link, on Platform's People, are each shown exactly once, and while they are on screen an Ask would have carried them
 * into the model's context. So each is drawn in a dialog, which the design system portals to the document's body,
 * outside the region, and marked `omit` besides: the person still reads and copies it, and neither the region's text
 * nor the page's text holds it, even were the dialog drawn inside the region.
 */
const TOKEN = 'zz_pat_0123456789abcdefSECRET';
const LINK = 'https://console.example.com/enrol#t=zze_SECRETLINK0123456789';
const ACCESS = access(ME)[1] as Access;
const PATH = peoplePath(PEOPLE_DEFAULTS);
const PEOPLE = people(ME, new URLSearchParams(), { limit: 10, offset: 0 })![1] as People;

/** Every write answered as the gateway answers it, with the value it shows once; every read with the fixture. */
function browser() {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://console.test');
    const p = url.pathname.replace('/api/console', '');
    const body = p === '/me' ? ME
      : init?.method === 'POST' && p === '/settings/me/tokens' ? { token: TOKEN, label: 'laptop', email: ME.email }
        : init?.method === 'POST' && p === '/settings/platform/enrolments' ? { ok: true, url: LINK, result: 'issued' }
          : p === '/access' ? ACCESS : p === '/people' ? PEOPLE : [];
    return Promise.resolve({ ok: true, status: 200, json: async () => body } as unknown as Response);
  }));
}

/** `ui` in the console's providers, inside the scroll region the assistant reads. */
function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SurfaceOverride surface={{}}><Tooltip.Provider><div data-scroll-region>{ui}</div></Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
  return document.querySelector<HTMLElement>('[data-scroll-region]')!;
}

/** The node that shows `value`, and the page text of the region were that node's dialog drawn inside it. */
function insideTheRegion(region: HTMLElement, value: string): string {
  const shown = [...document.querySelectorAll('code')].find((c) => c.textContent?.includes(value))!;
  const dialog = shown.closest('[role="dialog"]')!;
  const home = dialog.parentElement!;
  region.appendChild(dialog);
  try {
    return pageText(region);
  } finally {
    home.appendChild(dialog);
  }
}

/**
 * jsdom has no `innerText`, so `pageText` would read nothing and every assertion on it would hold whatever was drawn.
 * This one is the text of every node not taken out of the layout by an inline `display: none`, which is how `pageText`
 * takes an omitted node out for its read: enough to tell a value it reads from one it leaves out.
 */
function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLElement && node.style.display === 'none') return '';
  return [...node.childNodes].map(visibleText).join('');
}
const native = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get(this: HTMLElement) { return visibleText(this); } }); });
afterAll(() => {
  if (native) Object.defineProperty(HTMLElement.prototype, 'innerText', native);
  else delete (HTMLElement.prototype as { innerText?: string }).innerText;
});

beforeEach(() => { browser(); window.history.replaceState(null, '', '/access'); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('a secret shown once stays out of the page text the assistant reads', () => {
  it('draws a token issued on Access in a dialog outside the scroll region, marked omit', async () => {
    const region = mount(<AccessView served={{ state: 'ok', access: ACCESS }} />);
    const tokens = screen.getByRole('heading', { level: 2, name: 'Tokens' }).closest('section')!;
    await act(async () => { fireEvent.click(within(tokens).getByRole('button', { name: 'Issue token' })); });
    await waitFor(() => expect(document.body.textContent).toContain(TOKEN));
    const shown = [...document.querySelectorAll('code')].find((c) => c.textContent === TOKEN)!;
    expect(shown.closest(OMIT)).not.toBeNull();
    expect(region.contains(shown)).toBe(false);
    expect(region.textContent).not.toContain(TOKEN);
    expect(pageText(document.body)).not.toContain(TOKEN);
    const read = insideTheRegion(region, TOKEN);
    expect(read).toContain('Tokens');
    expect(read).toContain('Shown once. Store it now.');
    expect(read).not.toContain(TOKEN);
  });

  it('draws an enrolment link issued on People in a dialog outside the scroll region, marked omit', async () => {
    window.history.replaceState(null, '', '/platform/people');
    const region = mount(<PlatformPeopleView served={{ state: 'ok', path: PATH, data: PEOPLE }} />);
    const [first] = screen.getAllByRole('button', { name: 'Enrolment link' });
    await act(async () => { fireEvent.click(first); });
    await waitFor(() => expect(document.body.textContent).toContain(LINK));
    const shown = [...document.querySelectorAll('code')].find((c) => c.textContent === LINK)!;
    expect(shown.closest(OMIT)).not.toBeNull();
    expect(region.textContent).not.toContain(LINK);
    expect(pageText(document.body)).not.toContain(LINK);
    const read = insideTheRegion(region, LINK);
    expect(read).toContain('Enrolment link');
    expect(read).not.toContain(LINK);
  });
});

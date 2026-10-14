/**
 * Wait for a page's late chrome before reading it, anchored to the page's own signal rather than to a duration.
 *
 * One control arrives late and is announced: the assistant's launcher sits inside a boundary that resolves when the
 * request's own work does (`app/(dashboard)/layout.tsx` hands `AppShell` a promise, deliberately, so the frame never
 * blocks). What a fixed wait costs was measured on the keyboard walk: assistant off, 39 stops, pass; assistant on, 41
 * stops, pass idle and **fail under load**, a forward pass of 39 against a reverse pass of 40. A suite that only counts
 * (the presses) or only looks (the audit) does not fail that way: it reads the page without the late control and says
 * the page is clean, which is worse. So every suite that reads a page waits here first.
 *
 * The wait is anchored to `[data-assistant-slot]` — in the page from the first byte, `aria-hidden` until the answer is
 * known — and falls back to quiescence for anything else late: the count of focusable controls unchanged over three
 * readings. With no assistant configured there is nothing to wait for, so that is asked once per origin, of the one
 * endpoint that answers for it, and the wait is then a few frames. Bounded at seven seconds: a page that never settles is
 * read as it stands.
 *
 * The deep-DOM helper (scripts/lib/deep.ts) must already be injected into the page.
 */
import type { Page } from './chrome.ts';

const assistant = new Map<string, boolean>();

/** Resolves with the number of focusable controls the page settled on. */
export async function settle(page: Page): Promise<number> {
  const origin = await page.eval<string>('location.origin');
  if (!assistant.has(origin)) assistant.set(origin, (await page.eval<number>('fetch("/api/assistant", { method: "POST" }).then((r) => r.status).catch(() => 404)')) !== 404);
  return page.eval<number>(`new Promise((done) => {
    let last = '', stable = 0, tries = 0;
    const count = () => deepAll(document.body).filter((el) => el.matches('a[href],button,input,select,textarea,[tabindex]') && !el.hasAttribute('disabled') && el.tabIndex >= 0).length;
    const slotResolved = () => { const el = deepAll(document.body).find((n) => n.matches('[data-assistant-slot]')); return !el || el.getAttribute('aria-hidden') === null; };
    const tick = () => {
      const now = String(count()), ready = !${assistant.get(origin)} || slotResolved();
      if (ready && now === last) { if (++stable >= 3) return done(+now); } else { stable = 0; last = now; }
      if (++tries > 140) return done(+now);
      setTimeout(tick, 50);
    };
    tick();
  })`);
}

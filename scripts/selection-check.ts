/**
 * A control that shows a selection shows the one that was pressed — on that press. One of verify's `browserChecks`.
 *
 *   node scripts/selection-check.ts [--base http://localhost:3100]
 *
 * Meridian's presses suite asks whether pressing a control changes SOMETHING — the address, the page, a dialog, a
 * toast — and it is right to. The gap it leaves is a press whose change lands everywhere except on screen, and this
 * console had two of those, in the same shape:
 *
 *   - The reporting period. `setPeriod` notified its listeners before writing the address, and its snapshot reads the
 *     address first. React checks a store's snapshot synchronously inside the notify, so the check compared the
 *     address being replaced against the one still on screen, found no change and skipped the re-render. The address
 *     moved and the control did not: `30D` then `7D` wrote `?period=7d` on the first press with the control still on
 *     30D, and the second press was what showed it. The presses suite passed it, correctly — the address HAD changed.
 *   - Every filter. `useQueryState` told the address readers inside the transition, before Next's router had
 *     committed, so the readers were handed the address as it still was: `useOptimistic` showed the press until the
 *     transition settled and then reverted to a value read from the address before it moved.
 *
 * Both are invisible to a check that asks only whether something happened, which is why this asks the question the
 * eye asks instead: after ONE press, is the thing I pressed the thing that is on? It reads what the control itself
 * publishes — `aria-checked`, `aria-selected`, `aria-pressed`, `data-state` — and never the console's internals, so
 * it holds for a control built any way.
 *
 * What it does NOT prove: that a press did the RIGHT thing, only that it is shown. A control that selects the wrong
 * period and shows it passes here.
 *
 * Fails (exit 1) on a group whose pressed item is not the item showing after one press, and on an uncaught page error.
 * Whether the press landed inside the group is not a failure of its own — it is the reason an item did not take, so it
 * is named in that failure's line: a press that landed elsewhere and still showed the item has changed the selection,
 * whichever element the pointer reached.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GROUP_SEL = '[role="radiogroup"],[role="tablist"],[role="group"],[role="listbox"]';
const ITEM_SEL = '[role="radio"],[role="tab"],[role="switch"],[role="checkbox"],button';

/**
 * A group's identity, so it can be found again after a press.
 *
 * By role and accessible name rather than by a marker this check wrote: an attribute of ours is lost the moment the
 * press re-renders the group, and the first version of this file read every such group as gone — a claim about the
 * check, not about the page.
 */
const KEY = `const key = (g) => (g.getAttribute('role') || '') + '|' + (g.getAttribute('aria-label') || '') + '|' + g.querySelectorAll(${JSON.stringify(ITEM_SEL)}).length;`;

/** What a control says about itself: the one attribute a selection publishes. */
const ON = `const on = (el) => el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || ['on', 'checked', 'active'].includes(el.dataset.state);`;

/** The groups on the page that are selections: more than one visible item, and the items publish a state. */
const GROUPS = `(() => {
  ${KEY}
  ${ON}
  const items = (g) => [...g.querySelectorAll(${JSON.stringify(ITEM_SEL)})].filter((b) => b.hasAttribute('aria-checked') || b.hasAttribute('aria-selected') || b.hasAttribute('aria-pressed') || b.dataset.state !== undefined);
  return [...document.querySelectorAll(${JSON.stringify(GROUP_SEL)})]
    .filter((g) => g.getBoundingClientRect().width > 0)
    .filter((g) => items(g).filter((b) => b.getBoundingClientRect().width > 0).length > 1)
    .map((g) => ({
      key: key(g),
      label: (g.getAttribute('aria-label') || g.getAttribute('role') || 'group'),
      items: items(g).map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24), on: on(b),
                 x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
      }),
    }));
})()`;

/** What the group with this key shows now, or GONE when the press took the page somewhere it is not. */
const showing = (k: string) => `(() => {
  ${KEY}
  ${ON}
  const g = [...document.querySelectorAll(${JSON.stringify(GROUP_SEL)})].find((x) => key(x) === ${JSON.stringify(k)});
  if (!g) return 'GONE';
  return [...g.querySelectorAll(${JSON.stringify(ITEM_SEL)})].filter(on).map((b) => (b.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24)).join(',');
})()`;

type Item = { label: string; on: boolean; x: number; y: number; w: number };
type Group = { key: string; label: string; items: Item[] };

const page = await launch();
const failures: string[] = [];
await page.send('Network.enable');

/** One press at the item's own centre, through the input layer rather than the element's `click()`. */
async function press(it: Item): Promise<string> {
  /* Into view first: a group is a row that scrolls sideways on a narrow viewport, and an item parked outside it has a
   * centre the pointer cannot reach — `elementFromPoint` answers nothing and the press lands on the page. The first
   * version pressed without this and read the console's own overflow as a control that does not take. */
  const at = await page.eval<Item | null>(`(() => {
    const b = [...document.querySelectorAll(${JSON.stringify(ITEM_SEL)})].find((x) => (x.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24) === ${JSON.stringify(it.label)} && x.getBoundingClientRect().width > 0);
    if (!b) return null;
    b.scrollIntoView({ block: 'nearest', inline: 'center' });
    const r = b.getBoundingClientRect();
    return { label: ${JSON.stringify(it.label)}, on: false, w: Math.round(r.width), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!at) return 'the item is not on the page';
  const covered = await page.eval<string>(`(() => {
    const t = document.elementFromPoint(${at.x}, ${at.y});
    if (!t) return 'nothing';
    return t.closest(${JSON.stringify(GROUP_SEL)}) ? 'in-group' : t.tagName + '.' + String(t.className).slice(0, 50);
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  await sleep(400);
  return covered;
}

/** The rail's own routes and the detail routes verify already drives, so this walks what the rest of verify walks. */
const config = (await import('./verify.config.ts')).default;
const routes = [...(config.navigationChecks ?? []).map((c) => c.path), ...(config.detailRoutes ?? [])];
let presses = 0, groupsSeen = 0;

for (const route of routes) {
  await page.open(base + route, { width: 1440, height: 900, theme: 'dark', reduced: false, wait: 5000 });
  for (const g of await page.eval<Group[]>(GROUPS)) {
    groupsSeen++;
    const was = g.items.find((it) => it.on);
    const target = g.items.find((it) => !it.on && it.w > 0 && it.y > 0);
    if (!target) continue;
    presses++;
    const covered = await press(target);
    const now = await page.eval<string>(showing(g.key));
    if (!now.split(',').includes(target.label)) {
      failures.push(`${route}: "${g.label}" — pressed "${target.label}" once and it shows "${now}"${covered === 'in-group' ? '' : `, and the press landed on ${covered}`}`);
    }
    // Put it back, so the next group on the page is judged from the state the route loads in.
    if (was && was.label !== target.label) await press(was);
    if (await page.eval<string>(showing(g.key)) === 'GONE') break;
  }
  for (const e of page.errors.slice(0, 1)) failures.push(`${route}: ${e.slice(0, 160)}`);
}

console.log(`\nselection: ${presses} selection(s) pressed across ${routes.length} routes and ${groupsSeen} group(s); ${failures.length} issue(s)`);
for (const f of failures) console.log(`  FAIL ${f}`);
page.close();
process.exit(failures.length ? 1 : 0);

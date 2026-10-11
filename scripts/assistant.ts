/**
 * Walk through the assistant against a running build.
 *
 *   node scripts/assistant.ts --base <url> --expect off
 *   node scripts/assistant.ts --base <url> --expect on --llm <fake llm url> --key <the app's ASSISTANT_API_KEY>
 *
 * off: no panel, no launcher and no Ask on any rail route or embed view, and POST /api/assistant answers 404.
 * on:  the launcher opens the panel, a question gets the streamed reply, the model was told which page it was on, a
 *      reply renders as markdown, the thread survives following the rail, Clear empties it, the layout holds at 1440px
 *      and 390px, a provider that refuses the key says so, and the key itself never reaches the browser.
 *
 * Beyond the panel, the walk-through drives the template's own sample where it is still there: the Overview's view
 * context, Ask and view tool; on /members, a query with no Proposal, an approved change shown without a reload, a
 * dismissed removal, a row-menu change the next query finds, and a waiting Proposal expiring on reload and on moving
 * on (from /keys); and the Settings switch. A product that removed one of those pages has no such flow to walk: each
 * step says `n/a` with the reason, and the rest still runs. Whether a sample surface is there is decided from its files,
 * so Meridian's own repository, which has every one, always walks all of them.
 *
 * Controls are found through open shadow roots (scripts/lib/deep.ts), so a design system whose buttons, rows and menus are
 * web components is walked the same way: a control is searched for under the light-DOM container that holds it (the panel,
 * the page's scroll region, the rail's `nav`) and named by its rendered text.
 */
import path from 'node:path';
import { slug } from '../src/app.config.ts';
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { APP_DIR, discover, railRoutes } from './lib/routes.ts';
import { sampleSurfaces } from './lib/sample.ts';

const SAMPLE = sampleSurfaces(path.resolve(import.meta.dirname, '..'), APP_DIR);

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? '').replace(/\/$/, '');
const expect = opt('--expect');
const llm = opt('--llm')?.replace(/\/$/, '');
const key = opt('--key');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!base || (expect !== 'off' && expect !== 'on') || (expect === 'on' && (!llm || !key))) {
  console.error('usage: node scripts/assistant.ts --base <url> --expect off | --expect on --llm <url> --key <key>');
  process.exit(1);
}

const ok = (what: string) => console.log(`ok   assistant ${expect}: ${what}`);
const na = (what: string, why: string) => console.log(`n/a  assistant ${expect}: ${what} (${why})`);
const { routes: rail, landing } = await railRoutes();
const fail = (why: string): never => { throw new Error(why); };
const until = async <T>(what: string, read: () => Promise<T>, done: (v: T) => boolean, ms = 15000) => {
  let v = await read();
  for (const end = Date.now() + ms; !done(v) && Date.now() < end; ) { await sleep(200); v = await read(); }
  return done(v) ? v : fail(`timed out waiting for ${what} (last: ${JSON.stringify(v)})`);
};

/** A browser whose every page defines the deep-DOM helpers. */
const browser = async () => { const p = await launch(); await p.send('Page.addScriptToEvaluateOnNewDocument', { source: DEEP_SOURCE }); return p; };
const page = await browser();
/** Page expressions: the panel, the page's own content, and the controls in the panel. */
const PANEL = `deepQuery('aside[data-assistant]')`;
const CONTENT = `deepQuery('[data-scroll-region]')`;
const MESSAGE = `deepQuery('textarea[aria-label="Message"]', ${PANEL})`;
const SEND = `deepQuery('button[aria-label="Send"]', ${PANEL})`;
const PROPOSALS = `deepQueryAll('article[aria-label^="Proposal from Assistant"]', ${PANEL})`;

/** Type `text` into the panel and press Send. */
async function ask(text: string) {
  await page.eval(`${MESSAGE}.focus()`);
  await page.send('Input.insertText', { text });
  await until('Send to enable', () => page.eval<boolean>(`!${SEND}.disabled`), Boolean);
  await page.eval(`${SEND}.click()`);
}
/** What the assistant's latest text says (a Proposal card's own text is not the assistant speaking).
 *  `data-assistant-text` is the reply block's own handle: a reply is markdown, so its text may be in a paragraph, a
 *  list item or a table cell, and a selector that assumed a paragraph would break the day a model answers with a list. */
const said = () => page.eval<string>(`deepQueryAll('[data-assistant-text]', ${PANEL}).at(-1)?.textContent.trim() ?? ''`);
/** The titles of the Proposal cards in the panel. */
const proposals = () => page.eval<string[]>(`${PROPOSALS}.map((a) => a.getAttribute('aria-label'))`);
/** A table row's text: the member's name, role, team, status and activity. */
const row = (name: string) => page.eval<string | null>(`deepQueryAll('tr').map((r) => deepText(r)).find((t) => t.includes(${JSON.stringify(name)})) ?? null`);
/** Press with the mouse, as a person does: menus open on the pointer, not on a synthetic click. */
async function press(find: string) {
  const where = `(() => { const el = ${find}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`;
  // A menu animates open: wait for the target to exist and stop moving.
  let at = await page.eval<{ x: number; y: number } | null>(where);
  for (let i = 0; i < 50; i++) {
    await sleep(150);
    const next = await page.eval<{ x: number; y: number } | null>(where);
    if (next && at && next.x === at.x && next.y === at.y) break;
    at = next;
  }
  if (!at) return fail(`nothing to press: ${find}`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'] as const) await page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
}
/** Press the button named `label` in the open Proposal card. */
const decide = (label: string) => press(`${PROPOSALS}.flatMap((a) => deepQueryAll('button', a)).find((b) => deepText(b).trim() === ${JSON.stringify(label)})`);
try {
  if (expect === 'off') {
    // Without an assistant, and outside any host, no agent control appears anywhere: no launcher, no panel, no Ask.
    // The product's own pages: the Design Atlas under /system is Meridian's documentation, whose specimens show agent controls.
    const ROUTES = [...rail.filter((r) => !r.startsWith('/system')), ...discover().filter((r) => r.startsWith('/embed/'))];
    for (const route of ROUTES) {
      await page.open(`${base}${route}`, { width: 1440 });
      await sleep(400);
      const found = await page.eval<number>(`deepQueryAll('[data-assistant], button[aria-label="Assistant"], button[aria-label^="Ask: "]').length`);
      if (found) fail(`${route} has ${found} agent control(s) with no assistant and no host`);
    }
    ok(`${ROUTES.length} pages and views have no panel, no launcher and no Ask`);
    // The person's own findings do not depend on any agent.
    if (SAMPLE.overview) {
      await page.open(`${base}/`, { width: 1440 });
      await until('the Overview finding', () => page.eval<boolean>(`deepQueryAll('button', ${CONTENT}).some((b) => /usual on/.test(deepText(b)))`), Boolean);
      ok('the Overview shows its finding with no assistant');
    } else na('the Overview shows its finding with no assistant', 'the sample Overview is not in this product');
    const status = (await fetch(`${base}/api/assistant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"messages":[]}' })).status;
    if (status !== 404) fail(`POST /api/assistant answered ${status}, expected 404`);
    ok('POST /api/assistant answers 404');
  } else {
    const LAUNCHER = `deepQuery('button[aria-label="Assistant"]')`;
    const LAUNCH = `${LAUNCHER}.click()`;
    const panelOpen = () => page.eval<boolean>(`!!${PANEL}`);
    const openPanel = async () => { await page.eval(LAUNCH); await until('the panel to open', panelOpen, Boolean); };
    const stored = () => page.eval<string | null>(`localStorage.getItem(${JSON.stringify(`${slug}.assistant`)})`);
    const here = () => page.eval<string>(`location.pathname`);
    const cards = () => page.eval<{ text: string; buttons: string[] }[]>(`${PROPOSALS}.map((a) => ({ text: a.textContent, buttons: deepQueryAll('button', a).map((b) => deepText(b).trim()) }))`);
    // The rail's link, as navigate.ts finds it: a link inside a nav, the one on screen.
    const follow = async (href: string) => { await press(`deepQueryAll('nav a[href="${href}"]').find((a) => a.getBoundingClientRect().width > 0)`); await until(`the address to be ${href}`, here, (p) => p === href); };
    const recorded = async () => (await (await fetch(`${llm}/requests`)).json()) as { messages?: { role: string; content: unknown }[] }[];
    const LOCAL = `${slug}.assistant`;
    const ABOUT_PAGE = /^This is the .+ page\.$/;

    await page.open(`${base}${landing}`, { width: 1440 });
    if (!(await page.eval<boolean>(`!!${LAUNCHER}`))) fail(`no launcher on ${landing}`);
    ok(`the launcher is on ${landing}`);

    // The panel is a SEPARATE CHUNK, and this is what says so. The page is measured with the panel closed, then again
    // with it open: the scripts that appear in between are the panel's. If the launcher's own chunk carried the panel
    // — which it did until issue #7 — opening it fetches nothing new, because every page already had all of it.
    const loadedScripts = () => page.eval<string[]>(`performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).map((e) => e.name)`);
    const beforeOpen = await loadedScripts();
    await openPanel();
    const panelChunks = (await loadedScripts()).filter((u) => !beforeOpen.includes(u));
    if (!panelChunks.length) fail('opening the panel downloaded no script a page with it closed had not already fetched, so the panel is in every page\'s first load');
    ok(`the panel is its own chunk: opening it fetched ${panelChunks.length} script(s) that a page with it closed never downloads`);
    ok('pressing the launcher opens the panel');

    await ask('What is this page?');
    const reply = await until('the reply', said, (t) => ABOUT_PAGE.test(t));
    ok(`the streamed reply reads "${reply}"`);
    const landingTitle = /^This is the (.+) page\.$/.exec(reply)![1];
    const told = `Page: ${landingTitle} (${landing})`;
    if (!JSON.stringify(await recorded()).includes(told)) fail(`no request to the model carried "${told}"`);
    ok(`the model request carried "${told}"`);

    if (SAMPLE.overview) {
      if (landing !== '/') {
        await page.open(`${base}/`, { width: 1440 });
        await openPanel();
        await ask('What is this page?');
        await until('the reply', said, (t) => t === 'This is the Overview page.');
      }
      const requests = await recorded();
      // The view's shared context (decision 0011): the Overview's own account, with its definitions and what code found.
      const overviewSystem = String(requests.filter((r) => JSON.stringify(r.messages?.[0]).includes('Page: Overview (/)')).at(-1)?.messages?.find((m) => m.role === 'system')?.content ?? '');
      const viewContext = /<view-context>\n([\s\S]*?)\n<\/view-context>/.exec(overviewSystem)?.[1] ?? '';
      for (const line of ['(Share of requests answered with a 5xx or a 429.)', "the period's median of", 'Nothing is recorded between']) if (!viewContext.includes(line)) fail(`the Overview's view context does not carry "${line}"`);
      ok(`the model was given the Overview's view context: ${viewContext.length} characters, with the error rate's definition, the spike against its median and what nothing recorded explains`);

      // Handoff: Ask on a card posts its question into the panel as the person's, with the page's view context.
      const ASK = `deepQuery('button[aria-label^="Ask: "]', ${CONTENT})`;
      const askLabel = await page.eval<string>(`${ASK}?.getAttribute('aria-label') ?? ''`);
      if (!askLabel) fail('the Overview has no Ask on its featured card while the assistant is on');
      const question = askLabel.replace(/^Ask: /, '');
      const beforeAsk = (await recorded()).length;
      await press(ASK);
      await until('the asked question in the thread', () => page.eval<string[]>(`deepQueryAll('[data-role="user"]', ${PANEL}).map((m) => m.textContent)`), (ms) => ms.some((m) => m.includes(question)));
      const asked = await until('the request carrying the question', async () => (await recorded()).slice(beforeAsk), (rs) => rs.some((r) => JSON.stringify(r.messages?.at(-1)).includes(question.slice(0, 40))));
      const askedSystem = String(asked.find((r) => JSON.stringify(r.messages?.at(-1)).includes(question.slice(0, 40)))?.messages?.find((m) => m.role === 'system')?.content ?? '');
      if (!askedSystem.includes('<view-context>')) fail('the question Ask posted reached the model without the view context');
      ok(`Ask on the featured card posted "${question}" into the panel, and the model received it with the Overview's view context`);

      // A view tool: another period, read without navigating, quoted from that view's own context.
      await ask('Open the overview for the last 90 days');
      const viewReply = await until('the view tool\'s reply', said, (t) => t.startsWith('From /?period=90d'));
      if (!viewReply.includes('Upload failures for files over 50 MB')) fail(`the 90-day Overview's finding did not name the incident beside its spike: "${viewReply}"`);
      ok(`view_overview read the last 90 days without leaving the page: "${viewReply.slice(0, 120)}…"`);
    } else na('the Overview\'s view context, Ask and view tool', 'the sample Overview is not in this product');

    // A reply is rendered as markdown, never as the model's own markup: the list, the bold and the table are
    // ELEMENTS, and the characters that made them are gone from the panel's text.
    await ask('Show me a markdown summary');
    const md = await until('the markdown reply', () => page.eval<{ list: number; bold: number; table: number; text: string }>(
      `(() => { const b = deepQueryAll('[data-assistant-text]', ${PANEL}).at(-1);
                return b ? { list: deepQueryAll('li', b).length, bold: deepQueryAll('strong', b).length,
                             table: deepQueryAll('table', b).length, text: b.textContent } : { list: 0, bold: 0, table: 0, text: '' }; })()`),
      (v) => v.table > 0);
    if (!md.list || !md.bold) fail(`the markdown reply rendered ${md.list} list items and ${md.bold} bold runs`);
    if (md.text.includes('**') || md.text.includes('|---') || md.text.includes('| ---')) fail(`the markdown reply still shows its markup: "${md.text}"`);
    ok(`the reply is rendered markdown: ${md.list} list items, ${md.bold} bold runs and a table, with no markup characters left`);

    if (SAMPLE.members) {
      // The collections: ask, approve, dismiss, and a change made on the page.
      await page.open(`${base}/members`, { width: 1440 });
      await page.eval(`window.__walk = true`);
      await openPanel();

      // The table is newest-joined first at 20 a page, so the long-tenured members are on page 2: show 50 to read them all.
      await press(`deepQueryAll('button', deepQuery('nav[aria-label="Pagination"]')).find((b) => deepText(b).includes('per page'))`);
      await press(`deepQueryAll('[role="menuitem"]').find((i) => deepText(i).includes('50 per page'))`);
      await until('every member to show', () => row('Alice Moreno'), Boolean);

      await ask('Which Support viewers have been inactive for more than 60 days?');
      const listed = await until('the query result', said, (t) => t.includes('Alice Moreno') && t.includes('Ravi Patel'));
      if ((await proposals()).length) fail(`the query raised a Proposal: ${JSON.stringify(await proposals())}`);
      if (/Amara|Noah|Grace/.test(listed)) fail(`the query listed more than two members: "${listed}"`);
      ok(`the query listed Alice Moreno and Ravi Patel with no Proposal ("${listed}")`);

      await ask('Suspend them');
      await until('a Proposal to change two members', proposals, (t) => t.some((l) => l?.startsWith('Proposal from Assistant: Change 2 members')));
      // A second tab holds the Overview open, as a teammate would: the Activity line must reach it without a reload.
      const watcher = SAMPLE.overview ? await browser() : null;
      await watcher?.open(`${base}/`, { width: 1440 });
      await decide('Approve');
      const suspended = await until('both rows to read Suspended', async () => [await row('Alice Moreno'), await row('Ravi Patel')], (r) => r.every((t) => t?.includes('Suspended')));
      if (!(await page.eval<boolean>(`window.__walk === true`))) fail('the page reloaded instead of refreshing');
      ok(`the approved suspension shows Alice Moreno and Ravi Patel as Suspended without a reload (${suspended.length} rows)`);
      await until('the assistant to say Done.', said, (t) => t === 'Done.');
      if (watcher) {
        // Provenance: the approved change left an Activity line naming the agent and the person it acted for.
        const object = 'status to Suspended for Alice Moreno and Ravi Patel';
        const line = await until('the Activity line on the open Overview', () => watcher.eval<string>(`deepQueryAll('li', ${CONTENT}).map((l) => l.textContent).find((t) => t.includes(${JSON.stringify(object)})) ?? ''`), Boolean);
        watcher.close();
        if (!/^Assistant ?changed/.test(line.trim()) || !line.includes('for Maya Chen')) fail(`the Activity line does not name the Assistant and the person it acted for: "${line}"`);
        ok(`the open Overview's Activity showed "${line.replace(/\s+/g, ' ').trim()}" without a reload`);
      } else na('the Activity line on an open Overview', 'the sample Overview is not in this product');

      await ask('Remove Alice Moreno');
      await until('a removal Proposal', proposals, (t) => t.some((l) => l?.startsWith('Proposal from Assistant: Remove')));
      await decide('Dismiss');
      await until('the assistant to say Nothing changed.', said, (t) => t === 'Nothing changed.');
      const kept = await row('Alice Moreno');
      if (!kept) fail('the dismissed removal took Alice Moreno out of the table');
      ok('the dismissed removal left Alice Moreno in the table');

      await press(`deepQuery('button[aria-label="Actions for Amara Okafor"]')`);
      await until('the row menu', () => page.eval<boolean>(`!!deepQuery('[role="menu"]')`), Boolean);
      await press(`deepQueryAll('[role="menuitem"]').find((i) => deepText(i).trim() === 'Suspend')`);
      await until('Amara Okafor to read Suspended', () => row('Amara Okafor'), (t) => !!t?.includes('Suspended'));
      await ask('Who is suspended?');
      const found = await until('the answer to name Amara Okafor', said, (t) => t.includes('Amara Okafor'));
      ok(`a member suspended from the row menu is found by the assistant's next query ("${found}")`);

      // The page context: the title and path, and the page's text, capped.
      const onMembers = (await recorded()).filter((r) => JSON.stringify(r.messages?.[0]).includes('Page: Members (/members)')).at(-1);
      const system = String(onMembers?.messages?.find((m) => m.role === 'system')?.content ?? '');
      if (!system) fail('no request to the model carried "Page: Members (/members)"');
      const text = /<page-text>\n([\s\S]*?)\n<\/page-text>/.exec(system)?.[1] ?? '';
      if (!text.includes('Alice Moreno')) fail('the page text the model was given does not contain "Alice Moreno"');
      if (text.length > 24_000) fail(`the page text the model was given is ${text.length} characters, over 24,000`);
      ok(`the last request from /members carried "Page: Members (/members)" and ${text.length} characters of page text with "Alice Moreno"`);
    } else na('the collection walk-through on /members', 'the sample Members page is not in this product');

    // Navigation: the rail keeps the panel open with the thread, each message labelled with the page it was asked on.
    const from = await here();
    const fromTitle = SAMPLE.members ? 'Members' : from === landing ? landingTitle : 'Overview';
    const to = SAMPLE.members && SAMPLE.keys ? '/keys' : rail.find((r) => r !== from && !r.startsWith('/system'));
    if (to) {
      await follow(to);
      if (!(await panelOpen())) fail(`following the rail to ${to} closed the panel`);
      const labels = () => page.eval<string[]>(`deepQueryAll('span', ${PANEL}).map((s) => s.textContent.trim()).filter((t) => t.startsWith('On '))`);
      const tagged = await labels();
      if (!tagged.includes(`On ${fromTitle}`)) fail(`${to} shows the labels ${JSON.stringify(tagged)}, none "On ${fromTitle}"`);
      if (!(await page.eval<boolean>(`${PANEL}.textContent.includes('Show me a markdown summary')`))) fail(`${to} lost the earlier messages`);
      ok(`following the rail to ${to} kept the panel open with the earlier messages and their "On ${fromTitle}" labels (${tagged.length} labels)`);
    } else na('the thread across navigation', 'the rail has one route');

    if (SAMPLE.members && SAMPLE.keys) {
      // Reload: a removal that waited is Expired with the reload reason and cannot be approved.
      await ask('Remove Ravi Patel');
      await until('a waiting removal', cards, (c) => c.length > 0 && c.at(-1)!.buttons.some((b) => b.startsWith('Approve')));
      await sleep(500);
      await page.open(`${base}/keys`, { width: 1440 });
      await openPanel();
      const afterReload = await until('the stored thread', cards, (c) => c.length > 0);
      const reloaded = afterReload.at(-1)!;
      if (!reloaded.text.includes('Expired') || !reloaded.text.includes('The page was reloaded before anyone approved it.')) fail(`after a reload the waiting card reads "${reloaded.text}"`);
      if (afterReload.some((c) => c.buttons.some((b) => b.startsWith('Approve')))) fail('after a reload a card still offers Approve');
      ok('after a reload the thread is back and the waiting removal reads Expired with the reload reason and no Approve');

      // Moved on: a new message closes whatever still waits.
      const before = afterReload.length;
      await ask('Remove Ravi Patel');
      await until('a new waiting removal', cards, (c) => c.length === before + 1 && c.at(-1)!.buttons.some((b) => b.startsWith('Approve')));
      await ask('What is this page?');
      await until('the reply', said, (t) => t === 'This is the API keys page.');
      const closed = (await cards()).at(-1)!;
      if (!closed.text.includes('Expired') || !closed.text.includes('You moved on before approving it.') || closed.buttons.length) fail(`after moving on the waiting card reads "${closed.text}" with buttons ${JSON.stringify(closed.buttons)}`);
      ok('asking something else closes the waiting removal as Expired with the moved-on reason');
    } else na('a waiting Proposal expiring on reload and on moving on', 'the sample Members and API keys pages are not both in this product');

    // Clear: the panel and the stored thread are both emptied.
    await press(`deepQuery('button[aria-label="Clear conversation"]', ${PANEL})`);
    await until('the panel to empty', () => page.eval<number>(`deepQueryAll('[data-role]', ${PANEL}).length`), (n) => n === 0);
    await until('the stored thread to go', stored, (v) => v === null);
    ok(`Clear conversation empties the panel and removes ${LOCAL} from local storage`);

    if (SAMPLE.settings) {
      // The switch: off hides the launcher and the panel and keeps the thread; on brings both back.
      await ask('What is this page?');
      await until('the reply', said, (t) => ABOUT_PAGE.test(t));
      await until('the thread to be stored', stored, (v) => !!v?.includes('What is this page?'));
      await follow('/settings');
      const SWITCH = `deepQueryAll('label').find((x) => deepText(x).includes('Show the assistant'))?.control`;
      const absent = () => page.eval<boolean>(`!${LAUNCHER} && !${PANEL}`);
      await press(SWITCH);
      await until('the launcher and panel to go from /settings', absent, Boolean);
      const elsewhere = SAMPLE.members ? '/members' : rail.find((r) => r !== '/settings' && r !== '/' && !r.startsWith('/system')) ?? landing;
      await page.open(`${base}${elsewhere}`, { width: 1440 });
      if (!(await absent())) fail(`${elsewhere} still shows the assistant with the switch off`);
      if (!(await stored())?.includes('What is this page?')) fail('switching the assistant off removed the stored thread');
      // Switched off, the pages work as they would without any agent: no Ask anywhere, and the person's findings still there.
      if (SAMPLE.overview) {
        await page.open(`${base}/`, { width: 1440 });
        await until('the Overview to render its finding', () => page.eval<boolean>(`deepQueryAll('button', ${CONTENT}).some((b) => /usual on/.test(deepText(b)))`), Boolean);
        if (await page.eval<boolean>(`!!deepQuery('button[aria-label^="Ask: "]')`)) fail('the Overview shows Ask with the assistant switched off');
        if (!(await absent())) fail('/ still shows the assistant with the switch off');
      }
      await page.open(`${base}/settings`, { width: 1440 });
      if (!(await absent())) fail('/settings still shows the assistant with the switch off');
      await press(SWITCH);
      await until('the launcher to return', () => page.eval<boolean>(`!!${LAUNCHER}`), Boolean);
      await openPanel();
      await until('the thread to return', () => page.eval<boolean>(`${PANEL}.textContent.includes('What is this page?')`), Boolean);
      ok(`Show the assistant off hides the launcher on /settings and ${elsewhere}${SAMPLE.overview ? ' and / and every Ask, keeps the Overview\'s finding' : ''} and the thread; on brings the launcher and the thread back`);
    } else {
      na('the Settings switch', 'the sample Settings page, which holds "Show the assistant", is not in this product');
    }

    // Layout: a column beside the page at 1440px, over it at 390px; Escape closes it.
    if (!(await panelOpen())) await openPanel();
    const geometry = () => page.eval<{ position: string; main: number; panel: number; width: number }>(`(() => { const a = ${PANEL}; return { position: getComputedStyle(a).position, main: Math.round(document.querySelector('main').getBoundingClientRect().right), panel: Math.round(a.getBoundingClientRect().left), width: innerWidth }; })()`);
    const wide = await geometry();
    if (wide.position === 'fixed' || Math.abs(wide.main - wide.panel) > 1) fail(`at 1440px the panel is ${wide.position} with the page ending at ${wide.main}px and the panel starting at ${wide.panel}px`);
    await page.open(`${base}${landing}`, { width: 390 });
    await openPanel();
    const narrow = await geometry();
    if (narrow.position !== 'fixed' || narrow.main !== narrow.width || narrow.panel >= narrow.main) fail(`at 390px the panel is ${narrow.position}, the page ends at ${narrow.main}px and the panel starts at ${narrow.panel}px`);
    await page.eval(`${MESSAGE}.focus()`);
    for (const type of ['keyDown', 'keyUp'] as const) await page.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await until('Escape to close the panel', panelOpen, (v) => !v);
    ok(`at 1440px the panel is a column (page ends at ${wide.main}px, panel starts at ${wide.panel}px); at 390px it is fixed over the page; Escape closes it`);

    // A provider that refuses the key: plain words and Retry, and nothing of the key. Responses are kept as the browser got them.
    await page.open(`${base}${landing}`, { width: 1440 });
    await page.eval(`(() => { window.__api = []; const f = window.fetch; window.fetch = async (...a) => { const r = await f(...a); if (String(a[0]).includes('/api/assistant')) r.clone().text().then((t) => window.__api.push(t)); return r; }; })()`);
    await openPanel();
    await ask('Please fail now');
    const panelText = () => page.eval<string>(`${PANEL}.textContent`);
    await until('the failure to show', panelText, (t) => t.includes('The assistant is not set up correctly'));
    if (!(await page.eval<boolean>(`deepQueryAll('button', ${PANEL}).some((b) => deepText(b).trim() === 'Retry')`))) fail('the failure offers no Retry');
    if ((await panelText()).includes(key!)) fail('the panel shows the key');
    ok('a refused key shows "The assistant is not set up correctly" with Retry');
    const seen = await page.eval<string[]>(`window.__api`);

    // The key never reaches the browser: console pages, their RSC payloads, their scripts and the route's answers.
    const bodies: [string, string][] = seen.map((t, i) => [`the panel's /api/assistant response ${i + 1}`, t]);
    const post = async (said: string) => {
      const res = await fetch(`${base}/api/assistant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: said }] }], page: { path: '/', title: 'Overview', text: '' } }) });
      return await res.text();
    };
    bodies.push(['POST /api/assistant (an answer)', await post('Hello')], ['POST /api/assistant (a refused key)', await post('Please fail')]);
    const scripts = new Set<string>();
    let pages = 0;
    for (const route of discover()) {
      const html = await (await fetch(`${base}${route}`)).text();
      const rsc = await (await fetch(`${base}${route}`, { headers: { RSC: '1' } })).text();
      pages += 1;
      bodies.push([`${route} (HTML)`, html], [`${route} (RSC)`, rsc]);
      for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+?\.js/g)) scripts.add(m[0]);
    }
    for (const src of scripts) bodies.push([src, await (await fetch(`${base}${src}`)).text()]);
    if (!bodies.some(([, t]) => t.includes('not set up correctly'))) fail('no /api/assistant response carried the failure sentence, so the key check proved nothing');
    const leaked = bodies.filter(([, t]) => t.includes(key!)).map(([what]) => what);
    if (leaked.length) fail(`the key appears in: ${leaked.join(', ')}`);
    ok(`the key is in none of ${pages} pages, ${pages} RSC payloads, ${scripts.size} scripts or ${seen.length + 2} /api/assistant responses`);
  }
} catch (e) {
  console.log(`FAIL assistant ${expect}: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  page.close();
}

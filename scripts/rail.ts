/**
 * The rail's links, as the browser drew them, for one persona.
 *
 *   node scripts/rail.ts [--base http://localhost:3100] [--as viewer]
 *
 * `--as` reads a persona from scripts/verify.config.ts and signs the browser in as that person with the persona's own
 * cookie, set before the first request (scripts/lib/chrome.ts). It opens the landing route, then goes through the
 * configured rail routes once, in their order, opening each one that no rail read so far has linked to, and prints, as its
 * last line, `rail: <json>` — every address the rail linked to, inside `nav[aria-label="Main"]`, each once, in the order first
 * drawn. A rail may show only the part of the navigation its page belongs to, so the landing page alone would not hold a
 * persona against all of their routes; a route no rail links to (one the persona may not open) is opened once and adds
 * nothing, and a product whose landing rail links to every route is opened once.
 *
 * This is a suite of its own because `pnpm verify --as` compares the rail with a persona's hand-written expected routes,
 * and that comparison needs what the browser actually drew rather than what `src/app.config.ts` declares. It launches
 * Chrome through scripts/lib/chrome.ts and closes it, so nothing is left running.
 *
 * Exits non-zero, naming the declared personas, when `--as` names one that is not declared — and when the landing rail drew
 * nothing, which is a page that never resolved the person rather than a persona who may see no destination. A navigation
 * that cannot be read leaves the landing page alone.
 */
import { launch } from './lib/chrome.ts';
import { railRoutes } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
// verify.config.ts is the team's, so read its persona table through the shape this script needs.
const personas = (config as { personas?: Record<string, { cookie: { name: string; value: string } }> }).personas ?? {};
const as = opt('--as', '');
const persona = as ? personas[as] : undefined;
if (as && !persona) {
  console.error(`rail: --as ${as} is not a declared persona. Declared personas: ${Object.keys(personas).join(', ')}.`);
  process.exit(1);
}

// The routes the configuration declares, in order; a navigation that cannot be read leaves the landing page alone.
const { routes: configured, landing } = await railRoutes().catch(() => ({ routes: [] as string[], landing: '/' }));

const page = await launch();
try {
  await page.open(base + landing, { width: 1440, height: 900, theme: 'dark', cookie: persona?.cookie });
  // The rail streams behind the shell's frame, and every destination is chosen on the client: read what is there, and
  // give a page that is still resolving the person a few seconds to draw it before calling the rail empty. Every link is
  // read, displayed or not.
  const read = () => page.eval<string[]>(`(async () => {
    const read = () => { const n = document.querySelector('nav[aria-label="Main"]'); return n ? [...n.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) : null; };
    const end = Date.now() + 10000;
    let out = read();
    while ((!out || !out.length) && Date.now() < end) { await new Promise((r) => setTimeout(r, 100)); out = read(); }
    return out ?? [];
  })()`);
  const links = await read();
  if (!links.length) { console.error('rail: the rail drew no links'); page.close(); process.exit(1); }
  const seen = new Set(links);
  const order = [...links];
  const note = (found: string[]) => { for (const h of found) if (!seen.has(h)) { seen.add(h); order.push(h); } };
  for (const route of configured) {
    if (route === landing || seen.has(route)) continue;
    await page.open(base + route, { width: 1440, height: 900, theme: 'dark', cookie: persona?.cookie });
    note(await read());
  }
  console.log(`rail: ${JSON.stringify(order)}`);
} catch (e) {
  console.error(`rail: ${(e as Error).message}`);
  page.close();
  process.exit(1);
}
page.close();
process.exit(0);

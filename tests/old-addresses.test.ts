import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nav, workspaces } from '@/app.config';
import { PREPARED } from '@/data/prepared';
import { viewTools } from '@/views/tools';
import baseline from '../scripts/verify.baseline.json';
import config from '../scripts/verify.config.ts';

/**
 * The old addresses are gone, and nothing points at them (AC-1.12, reconciliation 75): `/teams`, `/teams/<slug>`,
 * `/people` and `/settings` are answered by the console's missing page (`tests/no-access.test.tsx` holds that), so a
 * link to one, a probe of one or a sentence sending a person or a model to one would send them to nothing.
 *
 * What counts as naming one as a console page, and what does not. A gateway path the console asks under `/api/console`
 * is no console page: `/teams?…`, `/teams/:slug`, `/people?…` and `/settings/me/*`, `/settings/team/*` and
 * `/settings/platform/*`, which Access and the pages under Platform still read and write, and neither is a module under
 * `@/console/settings/`. A comment naming an old address as measurement history may stay, so code is read with its
 * comments out. Managed files (`.meridian/manifest.json`) are the release's and are not read.
 */
const ROOT = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const MANAGED = new Set(Object.keys((JSON.parse(read('.meridian/manifest.json')) as { files: Record<string, string> }).files));
/** Comments out, so a sentence of history is not a link. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Every file under `dirs` with one of `exts`, as a path from the repository's root, `node_modules` and builds aside. */
function filesUnder(dirs: string[], exts: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const at = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'out'].includes(entry.name)) walk(at);
      } else if (exts.test(entry.name)) out.push(at);
    }
  };
  for (const dir of dirs) if (fs.existsSync(path.join(ROOT, dir))) walk(dir);
  return out.sort();
}

const OLD = ['teams', 'people', 'settings'];
/** One of the four as a console address: `/teams`, `/teams/<anything>`, `/people` or `/settings`, ending the string or
 *  followed by a path, a query or a fragment. */
const isOld = (address: string) => /^\/(teams|people|settings)(?=$|[/?#])/.test(address);

/**
 * A link target in code: an `href` or a `homeHref` given a literal, a `router.push`, `replace` or `prefetch` of one, or a
 * `redirect` to one. The literal's own first segment decides, so `/platform/teams` and `/api/console/teams` never match.
 */
const LINK_TARGET = /(?:[hH]ref\s*[:=]\s*\{?\s*|\b(?:push|replace|prefetch|redirect)\(\s*)(['"`])(\/[^'"`]*)\1?/g;
function linkTargets(src: string): string[] {
  return [...code(src).matchAll(LINK_TARGET)].map((m) => m[2].replace(/\$\{[^}]*\}.*$/, '<x>'));
}

/**
 * The four named as a page in prose: an address that starts a word (after the line's start, a space, a quote, a
 * backtick or a bracket), not a longer path's tail. A gateway path is told apart by its own shape: a query (`/teams?`),
 * a route parameter (`/teams/:slug`), the gateway's three settings routes, or a method in front of it (`GET /people`).
 */
const PROSE_ADDRESS = /(^|[\s'"`(\[])(\/(?:teams|people|settings)(?:\/[^\s'"`)\],.;]*)?)(\??)/gm;
function proseAddresses(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(PROSE_ADDRESS)) {
    const [, , address, query] = m;
    if (query) continue;
    if (/^\/teams\/:/.test(address) || /^\/settings\/(me|team|platform)(\/|$)/.test(address)) continue;
    const before = text.slice(Math.max(0, m.index - 8), m.index + m[1].length);
    if (/\b(GET|POST|PUT|PATCH|DELETE)\s*$/.test(before)) continue;
    found.push(address);
  }
  return found;
}

const UNMANAGED_CODE = [...filesUnder(['app', 'src', 'scripts'], /\.(tsx?|mjs|js)$/), 'proxy.ts', 'next.config.ts']
  .filter((f) => fs.existsSync(path.join(ROOT, f)) && !MANAGED.has(f));

describe('the discriminators', () => {
  it('find a link to an old address and leave a gateway path, a Platform page and a module path alone', () => {
    const src = [
      "<Link href={`/teams/${team}`} />", "{ href: '/people' }", "router.push('/settings')", "homeHref: '/teams'",
      "useConsole(`/teams?limit=10`)", "gatewayGet('/teams/atlas')", "{ href: '/platform/teams' }", "import x from '@/console/settings/teams-panel'",
      "// <a href='/teams'> is history", "fetch('/api/console/settings/me/tokens')",
    ].join('\n');
    expect(linkTargets(src).filter(isOld)).toEqual(['/teams/<x>', '/people', '/settings', '/teams']);
  });

  it('find a page named in prose and leave the gateway\'s paths alone', () => {
    const text = 'Open `/teams` or /people, and (/settings). It reads `GET /people?limit=10`, `POST /settings/platform/teams`, '
      + '`/teams/:slug`, `/settings/me/tokens`, `/teams?scope=platform` and `/platform/teams/atlas`; GET /teams is the read.';
    expect(proseAddresses(text)).toEqual(['/teams', '/people', '/settings']);
  });
});

describe('nothing points at /teams, /teams/<slug>, /people or /settings', () => {
  it('the navigation holds no item for any of them, in either workspace', () => {
    const items = nav.flatMap((g) => g.items);
    expect(items.map((i) => i.href).filter(isOld)).toEqual([]);
    expect(items.map((i) => i.feature)).not.toContain('settings');
    expect(Object.values(workspaces).map((w) => w.homeHref).filter(isOld)).toEqual([]);
  });

  it('no unmanaged file links to one, pushes to one or redirects to one', () => {
    expect(UNMANAGED_CODE.length).toBeGreaterThan(50);
    const found = UNMANAGED_CODE.flatMap((f) => linkTargets(read(f)).filter(isOld).map((t) => `${f}: ${t}`));
    expect(found).toEqual([]);
  });

  it('verify neither walks nor probes one', () => {
    const named = [
      ...(config.navigationChecks ?? []).map((c) => c.path),
      ...config.detailRoutes,
      ...Object.values(config.personas ?? {}).flatMap((p) => [...p.expectedRoutes, ...Object.keys(p.deniedProbe ?? {})]),
    ];
    expect(named.filter(isOld)).toEqual([]);
  });

  it('the baseline holds no key for one, first-load or HTML', () => {
    const keys = Object.keys((baseline as { routes: Record<string, number> }).routes);
    expect(keys.filter(isOld)).toEqual([]);
    expect(keys).toContain('/platform/teams');
    // Every page's HTML is held to its own figure (ZZ Meridian 0.19.0), People's where it is now.
    const html = Object.keys((baseline as { html?: { routes: Record<string, number> } }).html?.routes ?? {});
    expect(html.filter(isOld)).toEqual([]);
    expect(html).toContain('/platform/people');
  });

  it('the brief and the README name none of them, nor Settings, as a page', () => {
    for (const file of ['docs/brief.md', 'README.md']) {
      const text = read(file);
      expect(proseAddresses(text), file).toEqual([]);
      expect(text, file).not.toMatch(/\bSettings\b/);
    }
  });

  it('nothing the assistant route hands a model names one: the brief, the addresses, the view tools and the prepared queries', () => {
    const addresses = [...nav.flatMap((g) => g.items).map((i) => i.href), ...viewTools.map((v) => v.page)];
    expect(addresses.filter(isOld)).toEqual([]);
    const told = [
      read('docs/brief.md'),
      ...viewTools.map((v) => `${v.title} ${v.description}`),
      ...PREPARED.map((r) => JSON.stringify(r, (_k, v: unknown) => (typeof v === 'function' ? undefined : v))),
    ];
    expect(told.flatMap(proseAddresses)).toEqual([]);
    for (const tool of viewTools) expect(tool.name, tool.page).not.toBe('settings');
  });
});

describe('no "until Phase 7" line', () => {
  it('stands anywhere in app, src, scripts, docs or the README', () => {
    const files = [...filesUnder(['app', 'src', 'scripts', 'docs'], /\.(tsx?|mjs|js|json|md|css)$/), 'README.md'];
    expect(files.length).toBeGreaterThan(50);
    const found = files.filter((f) => /until Phase 7/i.test(read(f)));
    expect(found).toEqual([]);
  });
});

describe('the four routes', () => {
  it.each(OLD)('have no folder under app/(dash): /%s', (dir) => {
    expect(fs.existsSync(path.join(ROOT, 'app', '(dash)', dir))).toBe(false);
  });
});

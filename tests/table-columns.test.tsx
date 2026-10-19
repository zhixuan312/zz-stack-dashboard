import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The address as a page reads it: a tab or a page is in the address, as a navigation leaves it. */
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
/** The console's server's reads, answered from the fake gateway's own answers: the release route is drawn whole. */
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));

import type { Me } from '@/lib/api-shapes';
import type { Access, Runs } from '@/lib/destination-shapes';
import type { People, Teams } from '@/lib/fleet-shapes';
import type { Approvals } from '@/lib/work-shapes';
import { APPROVALS_DEFAULTS, approvalsPath } from '@/views/approvals-context';
import { AccessView } from '@/views/pages/access';
import { ApprovalsView } from '@/views/pages/approvals';
import { PlatformBugsView } from '@/views/pages/platform-bugs';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformReleaseView } from '@/views/pages/platform-release';
import { PlatformReleasesView } from '@/views/pages/platform-releases';
import { PlatformStatusView } from '@/views/pages/platform-status';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import { PluginsView } from '@/views/pages/plugins';
import { RunsView } from '@/views/pages/runs';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import type { Catalog } from '@/views/plugins-context';
import { BUGS_DEFAULTS, bugPath, bugsPath } from '@/views/platform-bugs-context';
import { RELEASES_DEFAULTS, lifted, releasesPath } from '@/views/platform-releases-context';
import { statusRead } from '@/views/platform-status-context';
import { RUNS_DEFAULTS, runsPath } from '@/views/runs-context';
import { TEAMS_DEFAULTS, teamsPath } from '@/views/teams-filter';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { bugs } from '../scripts/fake-gateway/platform-bugs.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { releaseDetail, releases } from '../scripts/fake-gateway/platform-releases.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teams } from '../scripts/fake-gateway/platform-teams.ts';
import { access as accessOf } from '../scripts/fake-gateway/work-access.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';
import PlatformReleasePage from '../app/(dash)/platform/releases/[version]/page';

/**
 * Every table the Wave 2 acceptance audit found wider than its frame, fitting it (Task I-136, AC-2.8): each table drawn
 * from the fake gateway's own answer, the one `pnpm verify` serves the page. jsdom lays nothing out, so this reads what
 * the layout acts on: the columns that carry the container query hiding them under 896px (`hideBelow: 'lg'`, the band
 * the 1024 and 768 frames of 713 and 729px fall in), the cells cut to the width there is (`max-w-0 truncate`), and where
 * a hidden column's fact is still in reach: a link in the row's first cell to the page that holds it, or the title of a
 * cell that stays. Each table's first column and its row action carry no breakpoint at all. The audit run is the layout
 * evidence; this is what keeps a later edit from undoing it.
 */
const LG = '@max-[896px]:hidden';
const XL = '@max-[1152px]:hidden';
/** Any of the four breakpoints a column can be hidden below. */
const HIDDEN = /@max-\[\d+px\]:hidden/;

beforeEach(() => {
  // A read the browser would make is never answered: every page here draws what its server read handed it.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

const mount = (ui: ReactElement) => render(<Tooltip.Provider>{ui}</Tooltip.Provider>);

/** The table whose caption is `caption`, and its columns by their header's words. */
function table(caption: string) {
  const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption')?.textContent === caption);
  if (!t) throw new Error(`no table captioned "${caption}"; captions: ${[...document.querySelectorAll('caption')].map((c) => c.textContent).join(' | ')}`);
  const heads = [...t.querySelectorAll('thead th')];
  const rows = [...t.querySelectorAll('tbody tr')];
  const at = (header: string) => {
    const i = heads.findIndex((th) => th.textContent?.trim() === header);
    if (i < 0) throw new Error(`no column "${header}" in "${caption}"; columns: ${heads.map((th) => th.textContent?.trim()).join(' | ')}`);
    return { th: heads[i], cells: rows.map((tr) => tr.children[i] as HTMLElement) };
  };
  return { t, heads, rows, at };
}
const classes = (el: Element) => el.className.split(/\s+/);
/** What a cell draws where the table is a table: a phone's own words for it, and the dot before them, left out. */
const drawn = (td: Element): Element => td.querySelector(':scope > [class~="@max-[640px]:hidden"]') ?? td;
const said = (td: Element) => [...drawn(td).childNodes].filter((n) => !(n instanceof Element && n.hasAttribute('data-sep'))).map((n) => n.textContent).join('');

/** Each named column hides under 896px (or under 1152px, which holds it), its header and every cell alike. */
function hidesBelowLg(caption: string, headers: string[], below = LG) {
  const { at } = table(caption);
  for (const h of headers) {
    const { th, cells } = at(h);
    expect(classes(th), `${caption}: ${h}`).toContain(below);
    for (const td of cells) expect(classes(td), `${caption}: a ${h} cell`).toContain(below);
  }
}
/** Each named column shows at every width: no breakpoint on its header or its cells. */
function staysAtEveryWidth(caption: string, headers: string[]) {
  const { at } = table(caption);
  for (const h of headers) {
    const { th, cells } = at(h);
    expect(th.className, `${caption}: ${h}`).not.toMatch(HIDDEN);
    for (const td of cells) expect(td.className, `${caption}: a ${h} cell`).not.toMatch(HIDDEN);
  }
}
/** Each cell of the column is cut to the width there is, and its title holds the whole of it. */
function cutWithTitle(caption: string, header: string) {
  const { cells } = table(caption).at(header);
  expect(cells.length).toBeGreaterThan(0);
  for (const td of cells) {
    expect(classes(td), `${caption}: a ${header} cell`).toEqual(expect.arrayContaining(['max-w-0', 'truncate']));
    expect(td.title, `${caption}: a ${header} cell's title`).not.toBe('');
  }
}
/** Each row's first cell links to the row's own page, where the hidden columns' facts are. */
function rowsLink(caption: string, href: (i: number) => RegExp) {
  const { rows } = table(caption);
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach((tr, i) => expect(tr.children[0].querySelector('a')?.getAttribute('href'), `${caption}: row ${i + 1}`).toMatch(href(i)));
}

const AT = '2026-10-17T09:00:00Z';
const query = (path: string) => new URLSearchParams(path.split('?')[1]);

describe('Plugins', () => {
  const catalog = plugins(ME)[1] as Catalog;
  const draw = () => mount(<PluginsView served={{ state: 'ok', path: '/plugins', at: AT, data: catalog }} />);

  it('under 896px gives up the version and the counts, each on the plugin\'s page the row opens, and keeps the score and Install', () => {
    draw();
    hidesBelowLg('Plugins', ['Version', 'Skills', 'Gates']);
    staysAtEveryWidth('Plugins', ['Plugin', 'Required', 'Score', 'Install']);
    rowsLink('Plugins', (i) => new RegExp(`^/plugins/${catalog.plugins[i].plugin}$`));
  });

  it('cuts the plugin and its blurb to the width there is, whole in the title, lets the score\'s second line wrap and narrows Install', () => {
    draw();
    cutWithTitle('Plugins', 'Plugin');
    const { at } = table('Plugins');
    at('Plugin').cells.forEach((td, i) => expect(td.title).toContain(catalog.plugins[i].plugin));
    expect(classes(at('Install').th)).toContain('w-56');
    const scored = at('Score').cells.map((td) => td.querySelector('.text-2xs')).filter((x) => x !== null);
    expect(scored.length).toBeGreaterThan(0);
    for (const line of scored) expect(classes(line!)).not.toContain('whitespace-nowrap');
  });
});

describe('Access\'s tokens', () => {
  const CAPTION = 'Your tokens, newest first';
  const draw = (who: Me) => mount(<AccessView served={{ state: 'ok', access: accessOf(who)[1] as Access }} />);

  it.each([['the superadmin', ME], ['a member', MEMBER]] as const)('as %s keeps the label, the state and Revoke at a phone\'s width, Revoke the last cell', (_, who) => {
    draw(who);
    staysAtEveryWidth(CAPTION, ['Label', 'State', 'Revoke']);
    const { at, rows } = table(CAPTION);
    // The lead column's floor is lowered from the managed 160px, so the three fit a 356px frame.
    expect(classes(at('Label').th)).toContain('min-w-32');
    for (const tr of rows) expect(tr.lastElementChild).toBe(at('Revoke').cells[rows.indexOf(tr)]);
  });

  it('says under the label what the hidden columns say: the application and the day issued, and when it was last used', () => {
    draw(ME);
    const { at } = table(CAPTION);
    for (const td of at('Label').cells) {
      const under = td.querySelector('.t-caption');
      expect(under?.textContent).toMatch(/, issued /);
      expect(under?.querySelector('[class~="@min-[512px]:hidden"]')?.textContent).toMatch(/^, (last used .+|never used)$/);
    }
  });
});

describe('Approvals', () => {
  const answer = (path: string) => approvals(ME, query(path))[1] as Approvals;
  const WAITING = approvalsPath(APPROVALS_DEFAULTS);
  const HISTORY = approvalsPath({ tab: 'history', page: '1' });

  it('waiting gives up the version under 896px, the revision the row and its Review open; Review stays', () => {
    mount(<ApprovalsView served={{ state: 'ok', path: WAITING, data: answer(WAITING), team: 'atlas' }} />);
    hidesBelowLg('Team approvals', ['Version']);
    staysAtEveryWidth('Team approvals', ['Document', 'Initiative', 'Waiting since', 'Review']);
    rowsLink('Team approvals', () => /^\/initiatives\/atlas\/[^/]+\/.+/);
    for (const td of table('Team approvals').at('Review').cells) expect(td.querySelector('a')?.getAttribute('aria-label')).toMatch(/^Review .+ v\d+ of /);
  });

  it('history gives up the version and the decision basis under 896px, both on the revision the row opens', () => {
    window.history.replaceState(null, '', HISTORY);
    mount(<ApprovalsView served={{ state: 'ok', path: HISTORY, data: answer(HISTORY), team: 'atlas' }} />);
    hidesBelowLg('Approved in your name', ['Version', 'Decision basis']);
    staysAtEveryWidth('Approved in your name', ['Document', 'Initiative', 'Approved at', 'Presentation']);
    rowsLink('Approved in your name', () => /^\/initiatives\/atlas\/[^/]+\/.+/);
  });
});

describe('Status', () => {
  const draw = () => mount(<PlatformStatusView read={statusRead(PLATFORM_STATUS)} />);

  it('the activity measures give up the low under 896px, and the high\'s title names both', () => {
    draw();
    const CAPTION = 'Three activity measures, each against the week before';
    hidesBelowLg(CAPTION, ['First week', 'Low']);
    staysAtEveryWidth(CAPTION, ['Measure', 'High', 'Last week', 'Change']);
    const { at } = table(CAPTION);
    at('High').cells.forEach((td, i) => {
      expect(td.title).toMatch(/^High .+; low /);
      const low = at('Low').cells[i].querySelector('span > span');
      expect(td.title).toContain(low ? `low ${low.textContent}` : 'low none');
    });
  });

  it('the doors give up the days with calls under 896px, and the fault days\' title says what they are out of', () => {
    draw();
    const CAPTION = 'Each door\'s fault days and its run of days under 1% tool failures';
    hidesBelowLg(CAPTION, ['Days with calls', 'Today']);
    staysAtEveryWidth(CAPTION, ['Door', 'Fault days', 'Last fault day', 'Run']);
    const { at } = table(CAPTION);
    at('Fault days').cells.forEach((td, i) => expect(td.title).toBe(`${said(td)} fault days of ${said(at('Days with calls').cells[i])} days with calls`));
  });
});

describe('Bugs', () => {
  const CAPTION = 'Bug reports, newest filed first';
  const NO_FILTER = { state: null, impact: null, surface: null };
  const draw = (admin: boolean) => mount(<PlatformBugsView served={{ state: 'ok', path: bugsPath(BUGS_DEFAULTS), data: bugs(admin, NO_FILTER, 10, 0) }} />);

  it.each([['the superadmin', true], ['a member', false]] as const)('as %s gives up the surface and the version under 896px, and the report\'s title names the surface', (_, admin) => {
    draw(admin);
    hidesBelowLg(CAPTION, ['Surface', 'Version']);
    staysAtEveryWidth(CAPTION, ['Report', 'Impact', 'Filed', 'Status']);
    const { at } = table(CAPTION);
    at('Report').cells.forEach((td, i) => {
      const surface = said(at('Surface').cells[i]);
      expect(td.title).toMatch(new RegExp(`, on ${surface === 'None named' ? 'no surface named' : surface!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    });
  });

  it('opens each report\'s page from its row for the superadmin, who resolves it there', () => {
    draw(true);
    const rows = bugs(true, NO_FILTER, 10, 0).queue;
    const ids = rows.state === 'ok' ? rows.data.rows.map((r) => r.id) : [];
    rowsLink(CAPTION, (i) => new RegExp(`^${bugPath(ids[i])}$`));
  });
});

describe('Evaluation', () => {
  it('each plugin\'s latest score gives up the protocol under 896px, and the plugin\'s title names it', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: evaluation(true) }} />);
    const CAPTION = 'Each plugin\'s latest score';
    hidesBelowLg(CAPTION, ['Protocol']);
    staysAtEveryWidth(CAPTION, ['Plugin', 'Score', 'Standing', 'Guardrails', 'Scored']);
    const { at } = table(CAPTION);
    at('Plugin').cells.forEach((td, i) => expect(td.title).toBe(`${said(td)}, ${said(at('Protocol').cells[i])}`));
  });
});

describe('Knowledge health', () => {
  it('the shelves give up the superseded and the searches under 896px, and what stands and what was made name them', () => {
    mount(<PlatformKnowledgeView read={{ state: 'ok', health: knowledge(true, ME.activeTeam) }} />);
    const CAPTION = 'Each shelf\'s lessons and last week\'s searches';
    hidesBelowLg(CAPTION, ['Superseded', 'Searches last week']);
    staysAtEveryWidth(CAPTION, ['Shelf', 'Standing', 'Made last week', 'No result']);
    const { at } = table(CAPTION);
    at('Standing').cells.forEach((td, i) => expect(td.title).toContain(`${said(at('Superseded').cells[i])} superseded`));
    at('Made last week').cells.forEach((td, i) => expect(td.title).toMatch(new RegExp(`, ${said(at('Searches last week').cells[i])} search(es)? last week$`)));
  });
});

describe('People', () => {
  const PATH = peoplePath(PEOPLE_DEFAULTS);
  const data = people(ME, query(PATH), { limit: 10, offset: 0 })![1] as People;

  it('gives up the role, the teams and the passkeys under 896px; the person carries them, and the acts stay', () => {
    mount(<PlatformPeopleView served={{ state: 'ok', path: PATH, data }} />);
    hidesBelowLg('People', ['Role', 'Teams', 'Passkey']);
    staysAtEveryWidth('People', ['Person', 'Last sign-in', 'State', 'Actions']);
    cutWithTitle('People', 'Person');
    const { at } = table('People');
    at('Person').cells.forEach((td, i) => {
      const p = data.people[i];
      const role = p.role === 'superadmin' ? 'Superadmin' : 'Member';
      expect(td.title).toContain(p.email);
      expect(td.title).toContain(role);
      for (const team of p.teams) expect(td.title).toContain(team);
      // Under the person, while the columns are gone: the role and the passkeys, which the row's two acts turn on.
      const under = td.querySelector('[class~="@min-[896px]:hidden"]');
      expect(under?.textContent).toBe(`${role} · ${p.passkeys ? `${p.passkeys} passkey` : 'No passkey'}${p.passkeys > 1 ? 's' : ''}`);
    });
  });
});

describe('Releases', () => {
  it('cuts the summary to the width there is, whole in its title; each row opens its release', () => {
    const data = releases(10, 0);
    const rows = data.rows.state === 'ok' ? data.rows.data.rows : [];
    mount(<PlatformReleasesView served={{ state: 'ok', path: releasesPath(RELEASES_DEFAULTS), data }} />);
    const CAPTION = 'Releases with what was observed either side of each';
    cutWithTitle(CAPTION, 'Summary');
    staysAtEveryWidth(CAPTION, ['Version', 'Released', 'Malformed per 1,000']);
    rowsLink(CAPTION, (i) => new RegExp(`^/platform/releases/${rows[i].version.replace(/\./g, '\\.')}$`));
  });

  it('a release\'s windows let the words for a figure not observed wrap, where a number never does', () => {
    const version = '0.95.0';
    mount(<PlatformReleaseView version={version} served={{ state: 'ok', data: releaseDetail(version)! }} />);
    const { t } = table(`What was observed in the 72 hours either side of ${version}`);
    const cells = [...t.querySelectorAll('td[data-num="num"]')].map(drawn);
    const words = cells.filter((c) => !/\d/.test(c.textContent ?? ''));
    expect(words.length).toBeGreaterThan(0);
    for (const c of words) expect(c.querySelector('.whitespace-normal')?.textContent).toBe(c.textContent);
    for (const c of cells) if (/\d/.test(c.textContent ?? '')) expect(c.querySelector('.whitespace-normal')).toBeNull();
  });
});

describe('Teams', () => {
  it('gives up both weeks\' calls under 896px, on the team\'s page each row opens', () => {
    const PATH = teamsPath(TEAMS_DEFAULTS);
    const data = teams(ME, query(PATH), { limit: 10, offset: 0 })![1] as Teams;
    mount(<PlatformTeamsView served={{ state: 'ok', path: PATH, data }} />);
    hidesBelowLg('Teams', ['Lessons', 'Sessions by week', 'Calls last week']);
    hidesBelowLg('Teams', ['Week before'], XL);
    staysAtEveryWidth('Teams', ['Team', 'People', 'Open work', 'Last active']);
    rowsLink('Teams', (i) => new RegExp(`^/platform/teams/${data.teams[i].slug}$`));
  });
});

describe('Runs', () => {
  it('cuts a recent run\'s initiative at 128px under 896px, whole in its title, and keeps the output and the state', () => {
    const PATH = runsPath(RUNS_DEFAULTS);
    const data = runs(ME, query(PATH))[1] as Runs;
    mount(<RunsView served={{ state: 'ok', path: PATH, data }} />);
    staysAtEveryWidth('Recent runs', ['Skill', 'Output', 'State']);
    const recent = data.recent.state === 'ok' ? data.recent.data.rows : [];
    const named = table('Recent runs').at('Initiative').cells.filter((_, i) => recent[i].initiative);
    expect(named.length).toBeGreaterThan(0);
    for (const td of named) {
      const slug = drawn(td).querySelector('span')!;
      expect(classes(slug)).toEqual(expect.arrayContaining(['truncate', '@max-[896px]:max-w-32']));
      expect(slug.title).toBe(slug.textContent);
    }
  });
});

describe('a release\'s notes', () => {
  /** What the console's server sends for `ui`, once every part of it has been drawn. */
  async function served(ui: ReactNode): Promise<string> {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { prelude } = await prerender(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
    return new Response(prelude).text();
  }
  /** One card of the page, by its title. */
  const card = (html: string, title: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('main h2, h2')].find((h) => h.textContent?.trim() === title)?.closest('[data-protagonist], .card, section') ?? null;
  };

  it('are drawn as prose by the route on the console\'s server, headings lifted under the card\'s h2, with no plain text to swap', async () => {
    gateway.get.mockImplementation(async (path: string) => (path === '/me' ? ME : releaseDetail(decodeURIComponent(path.split('/').at(-1)!))));
    for (const version of ['0.97.0', '0.96.0']) {
      const html = await served(await PlatformReleasePage({ params: Promise.resolve({ version }) }));
      const changelog = card(html, 'Changelog');
      expect(changelog, version).not.toBeNull();
      expect(changelog!.querySelectorAll('h3').length, version).toBeGreaterThan(0);
      expect(changelog!.querySelector('h4, h5, pre'), version).toBeNull();
      expect(changelog!.querySelector('li'), version).not.toBeNull();
      // Part of the page, not a boundary the browser fills again: a lazy renderer's boundary is what flipped to plain text.
      const walker = changelog!.ownerDocument.createTreeWalker(changelog!, NodeFilter.SHOW_COMMENT);
      const boundaries: string[] = [];
      while (walker.nextNode()) if (/^\$/.test(walker.currentNode.nodeValue ?? '')) boundaries.push(walker.currentNode.nodeValue!);
      expect(boundaries, version).toEqual([]);
      const notes = card(html, 'Upgrade notes');
      expect(notes!.querySelector('pre'), version).toBeNull();
    }
  });

  it('lift a section cut from under its release so it starts at ##, leaving fenced code and a text that already does', () => {
    expect(lifted('Intro.\n\n### zz-stack 0.97.0\n\n#### Fixed\n\n- One.\n')).toBe('Intro.\n\n## zz-stack 0.97.0\n\n### Fixed\n\n- One.\n');
    expect(lifted('### A\n\n```sh\n### not a heading\n```\n')).toBe('## A\n\n```sh\n### not a heading\n```\n');
    for (const md of ['## Already\n\n### Under it\n', '# Top\n\n### Deep\n', 'No heading at all.\n']) expect(lifted(md)).toBe(md);
  });
});

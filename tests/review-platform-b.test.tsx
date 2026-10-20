import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, refresh() {}, back() {}, forward() {}, prefetch() {}, replace(url: string) { window.history.replaceState(null, '', url); } }),
}));

// jsdom measures nothing; a chart that draws in real pixels is given a width, so the sparklines draw their lines.
vi.mock('@/components/charts/use-size', () => ({ useSize: () => [{ current: null }, { width: 96, height: 24 }] }));

import type { Audit, People, Teams } from '@/lib/fleet-shapes';
import { PlatformAuditView } from '@/views/pages/platform-audit';
import { PlatformEvaluationView } from '@/views/pages/platform-evaluation';
import { PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { PlatformTeamView } from '@/views/pages/platform-team';
import { PlatformTeamsView } from '@/views/pages/platform-teams';
import { PlatformUsageView } from '@/views/pages/platform-usage';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';
import { AUDIT_DEFAULTS, auditPath, type ReportTitles } from '@/views/platform-audit-context';
import { TILES as EVALUATION_TILES } from '@/views/platform-evaluation-context';
import { TEAMS_DEFAULTS, teamsPath } from '@/views/teams-filter';
import { ME } from '../scripts/fake-gateway/people.ts';
import { audit } from '../scripts/fake-gateway/platform-audit.ts';
import { evaluation } from '../scripts/fake-gateway/platform-evaluation.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { people } from '../scripts/fake-gateway/platform-people.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';

/**
 * The causes behind the Platform review's findings on Evaluation, Teams, a team, People, Usage, Audit and Knowledge
 * health (Task I-156, from "Phase 7, I-129: a non-builder's review of the Platform destinations"), each gone, read off
 * the fake gateway's own answers as the pages draw them. jsdom lays nothing out, so each case reads what the layout acts
 * on: a figure or identifier held to one line (`whitespace-nowrap`, never `[overflow-wrap:anywhere]`, which broke
 * "reliab / ility"), the page's rows inside one Stack, the classes a phone card is keyed on, a label wrapping as a block.
 *
 * Two findings were the managed cards' and were fixed in ZZ Meridian (zz-meridian#61 and #67, #62): Usage's team split
 * is asserted below, and a refused address lighting no rail item in tests/workspace-chrome.test.tsx.
 */
beforeEach(() => {
  // A read the browser would make is never answered: every page here draws what its server read handed it.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

function mount(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const tableOf = (caption: string) => [...document.querySelectorAll('table')].find((t) => t.querySelector('caption')?.textContent === caption)!;
/** The cells of `caption`'s column headed `header`. */
function column(caption: string, header: string): HTMLElement[] {
  const t = tableOf(caption);
  const i = [...t.querySelectorAll('thead th')].findIndex((th) => th.textContent?.trim() === header);
  expect(i, `${caption}: ${header}`).toBeGreaterThanOrEqual(0);
  return [...t.querySelectorAll('tbody tr')].map((tr) => tr.children[i] as HTMLElement);
}
/** What a cell draws where the table is a table: a phone's own words for it, and the dot before them, left out. */
const drawn = (td: Element): Element => td.querySelector(':scope > [class~="@max-[640px]:hidden"]') ?? td;
/** A cell's words as the table draws them. */
const said = (td: Element) => [...drawn(td).childNodes].filter((n) => !(n instanceof Element && n.hasAttribute('data-sep'))).map((n) => n.textContent).join('');
/** Whether `el`'s own text is held to one line by it or an ancestor inside `cell`. */
function heldWhole(el: Element, cell: Element): boolean {
  for (let at: Element | null = el; at && at !== cell.parentElement; at = at.parentElement) {
    if (at.classList.contains('whitespace-nowrap')) return true;
  }
  return false;
}
/** Every element in a table's columns but the lead whose classes break a word anywhere: only the lead, which takes the
 *  slack, may wrap its prose where it must. */
const brokenAnywhere = (table: Element) => [...table.querySelectorAll('tbody td:not(:first-child) [class*="overflow-wrap:anywhere"]')];
/** Each non-empty text holder a cell draws on a wide screen: the leaves that draw words. */
const leaves = (cell: Element) => [...drawn(cell).querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent?.trim() && !e.hasAttribute('data-sep'));

describe('figure columns sized to content, identifiers kept whole (F-3)', () => {
  it('Evaluation: every column but the lead holds its values to one line, and no key breaks mid-word', () => {
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: evaluation(true) }} />);
    const PLUGINS = 'Each plugin\'s latest score';
    for (const td of column(PLUGINS, 'Score')) for (const l of leaves(td)) expect(heldWhole(l, td), `Score: ${l.textContent}`).toBe(true);
    // The protocol is the plugin's caption, whole, rather than a column squeezed beside the figures.
    expect([...tableOf(PLUGINS).querySelectorAll('thead th')].map((th) => th.textContent?.trim())).not.toContain('Protocol');
    for (const p of tableOf(PLUGINS).querySelectorAll('[data-protocol]')) expect(p.classList).toContain('whitespace-nowrap');
    const SERIES = 'Every score, by series';
    for (const header of ['Scores', 'Within the series']) {
      for (const td of column(SERIES, header)) for (const l of leaves(td)) expect(heldWhole(l, td), `${header}: ${l.textContent}`).toBe(true);
    }
    for (const td of column(SERIES, 'Series')) expect(heldWhole(td.querySelector('.font-mono')!, td)).toBe(true);
    const WAITING = 'Findings waiting for a decision, oldest first';
    for (const header of ['Plugin', 'Owner', 'Waiting']) {
      for (const td of column(WAITING, header)) for (const l of leaves(td)) expect(heldWhole(l, td), `${header}: ${l.textContent}`).toBe(true);
    }
    for (const m of tableOf(WAITING).querySelectorAll('[data-measure] .font-mono')) expect(m.classList).toContain('whitespace-nowrap');
    for (const caption of [PLUGINS, SERIES, WAITING]) expect(brokenAnywhere(tableOf(caption)), caption).toEqual([]);
  });

  it('Usage: each tool\'s medians and change on one line a line', () => {
    mount(<PlatformUsageView read={{ state: 'ok', usage: usage(true) }} />);
    const TOOLS = 'Each tool\'s median call, first week against last';
    for (const header of ['First week', 'Last week', 'Change']) {
      for (const td of column(TOOLS, header)) for (const l of leaves(td)) expect(heldWhole(l, td), `${header}: ${l.textContent}`).toBe(true);
    }
    expect(brokenAnywhere(tableOf(TOOLS))).toEqual([]);
  });

  it('People: a team and its role stay on one line, and only the comma between two teams breaks', () => {
    const path = peoplePath(PEOPLE_DEFAULTS);
    const q = new URLSearchParams(path.split('?')[1]);
    const data = people(ME, q, { limit: 10, offset: 0 })![1] as People;
    window.history.replaceState(null, '', '/platform/people');
    mount(<PlatformPeopleView served={{ state: 'ok', path, data }} />);
    const cells = column('People', 'Teams');
    expect(cells.some((td) => td.querySelectorAll('[data-teams] > span').length > 1)).toBe(true);
    for (const td of cells) for (const s of td.querySelectorAll('[data-teams] > span')) expect(s.classList).toContain('whitespace-nowrap');
    expect(brokenAnywhere(tableOf('People'))).toEqual([]);
  });

  it('Knowledge health: a question\'s team and when it was last asked on one line', () => {
    mount(<PlatformKnowledgeView read={{ state: 'ok', health: knowledge(true, ME.activeTeam) }} />);
    const QUESTIONS = 'Questions the searches that found nothing asked';
    for (const header of ['Team', 'Last asked']) {
      const cells = column(QUESTIONS, header);
      expect(cells.length).toBeGreaterThan(0);
      for (const td of cells) for (const l of leaves(td)) expect(heldWhole(l, td), `${header}: ${l.textContent}`).toBe(true);
    }
  });
});

describe('a team\'s cards a row gap apart (F-9)', () => {
  it('draws its tiles, its chart and the team, and its members as rows of one Stack', () => {
    const { container } = mount(<PlatformTeamView slug="atlas" served={{ state: 'ok', data: teamDetail('atlas')! }} />);
    const members = container.querySelector('section[aria-label="atlas\'s members"]')!;
    const stack = members.parentElement!;
    expect(stack.className).toMatch(/flex-col/);
    expect(stack.className).toMatch(/gap-\(--stack-gap\)/);
    expect(stack.querySelector(':scope > [data-split="2/3"]')).not.toBeNull();
    expect(stack.querySelector('[data-split="tiles"]')).not.toBeNull();
    expect(stack.querySelector('[data-split="tiles"]')!.closest('[data-split="2/3"]')).toBeNull();
  });
});

describe('Evaluation: labels whole and one series named once (F-17)', () => {
  it('names every tile in a label short enough for a tile\'s head', () => {
    for (const t of Object.values(EVALUATION_TILES)) expect(t.label.length, t.label).toBeLessThanOrEqual(20);
    expect(EVALUATION_TILES.daysScored.label).toBe('Days scored');
  });

  it('says a plugin\'s statement once, and names each series by its protocol and population', () => {
    const e = evaluation(true);
    mount(<PlatformEvaluationView read={{ state: 'ok', evaluation: e }} />);
    const series = tableOf('Every score, by series');
    const history = e.history.state === 'ok' ? e.history.data : [];
    expect([...series.querySelectorAll('[data-statement]')].map((s) => s.textContent)).toEqual(history.map((h) => h.statement));
    expect(series.querySelectorAll('[data-population]')).toHaveLength(history.flatMap((h) => h.series).length);
    for (const td of column('Every score, by series', 'Plugin')) expect(td.title).not.toMatch(/:.*:/);
  });
});

describe('Teams: neutral sparklines and a team with no activity (F-18, F-19)', () => {
  const read = () => {
    const path = teamsPath(TEAMS_DEFAULTS);
    const q = new URLSearchParams(path.split('?')[1]);
    return { state: 'ok' as const, path, data: teams(ME, q, { limit: 10, offset: 0 })![1] as Teams };
  };

  it('draws every sessions line in the neutral comparison colour, never the accent', () => {
    window.history.replaceState(null, '', '/platform/teams');
    const { container } = mount(<PlatformTeamsView served={read()} />);
    const lines = [...container.querySelectorAll('tbody svg path[stroke]')];
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.getAttribute('stroke')).toBe('var(--chart-neutral-strong)');
  });

  it('says No activity yet for a team that never made a call, in the table and on a phone\'s card, never "Never"', () => {
    window.history.replaceState(null, '', '/platform/teams');
    const { container } = mount(<PlatformTeamsView served={read()} />);
    const dune = [...container.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('dune'))!;
    const last = dune.lastElementChild!;
    expect(said(last)).toBe('No activity yet');
    expect(last.querySelector('[class~="@max-[640px]:contents"]')!.textContent).toBe('No activity yet');
    expect(container.textContent).not.toMatch(/\bNever\b/);
  });
});

describe('People: a phone card keeps the name and the badge whole (F-20)', () => {
  it('lets a long name wrap beside its badge, and sends the acts to the line under them', () => {
    const path = peoplePath(PEOPLE_DEFAULTS);
    const q = new URLSearchParams(path.split('?')[1]);
    const data = people(ME, q, { limit: 10, offset: 0 })![1] as People;
    window.history.replaceState(null, '', '/platform/people');
    const { container } = mount(<PlatformPeopleView served={{ state: 'ok', path, data }} />);
    const section = container.querySelector('section[aria-label="People"]')!;
    expect(section.className).toContain('@max-[640px]:[&_td[data-mobile=status]:not(:empty)]:basis-full');
    const names = [...container.querySelectorAll('[data-card-name]')];
    expect(names).toHaveLength(data.people.length);
    for (const n of names) {
      expect(n.classList).toContain('whitespace-normal');
      expect(n.classList).toContain('flex-wrap');
      expect(n.querySelector('.truncate')).toBeNull();
    }
    expect(names.some((n) => n.textContent?.includes('Superadmin'))).toBe(true);
  });
});

describe('Usage: the key value wraps whole, its caveat after the figure (F-22)', () => {
  it('wraps each value under the chart, and says too few after the whole', () => {
    const { container } = mount(<PlatformUsageView read={{ state: 'ok', usage: usage(true) }} />);
    const line = container.querySelector('[data-followup]')!;
    const values = [...line.querySelectorAll('dd')];
    expect(values.length).toBe(4);
    for (const dd of values) {
      expect(dd.classList).not.toContain('truncate');
      expect(dd.className).toContain('[overflow-wrap:anywhere]');
    }
    expect(line.textContent).toContain('87.5% of 16 refused sessions · too few to judge');
    expect(line.textContent).not.toMatch(/too few of/);
  });
});

describe('Audit: each report named by its title (F-23)', () => {
  const ADMIN = audit(new URLSearchParams(), { limit: 10, offset: 0 })![1] as Audit;
  const ids = [...new Set(ADMIN.rows.filter((r) => r.kind.startsWith('bug.') && r.subject).map((r) => r.subject!))];
  const REPORTS: ReportTitles = Object.fromEntries(ids.map((id, i) => [id, `The report numbered ${i + 1}`]));

  it('says each report an act names by its title, never its id, and tells zz-core\'s act from the console\'s', () => {
    window.history.replaceState(null, '', '/platform/audit');
    const { container } = mount(<PlatformAuditView served={{ state: 'ok', path: auditPath(AUDIT_DEFAULTS), data: ADMIN, reports: REPORTS }} />);
    const lines = [...container.querySelectorAll('[data-feed] ol > li p')].map((p) => p.textContent!.trim());
    const resolved = lines.filter((l) => l.includes('resolved report'));
    expect(resolved.length).toBeGreaterThanOrEqual(2);
    for (const id of ids) expect(lines.join('\n')).not.toContain(id);
    // A deleted report has no record left to read a title from: it is named from its filing (I-162, F-23 option B).
    const standing = ids.filter((id) => !ADMIN.rows.some((r) => r.subject === id && r.kind === 'bug.delete'));
    for (const id of standing) expect(lines.join('\n')).toContain(`"${REPORTS[id]}"`);
    expect(new Set(resolved).size).toBe(resolved.length);
    expect(resolved.some((l) => l.endsWith(' through bug_resolve'))).toBe(true);
    expect(resolved.some((l) => l.endsWith(' in the console'))).toBe(true);
  });
});

describe('Knowledge health: bar-list labels wrap (F-25)', () => {
  it('draws each week\'s note as a block under the week, free to wrap, inside the list\'s one-line label', () => {
    const { container } = mount(<PlatformKnowledgeView read={{ state: 'ok', health: knowledge(true, ME.activeTeam) }} />);
    const labels = [...container.querySelectorAll('[data-cohort]')];
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect([...l.classList]).toEqual(expect.arrayContaining(['block', 'whitespace-normal']));
      expect([...l.lastElementChild!.classList]).toContain('block');
    }
  });
});

describe('Usage: the team split in categorical slots (F-21)', () => {
  it('draws each team of the calls by week in a categorical slot of its own, and Other in the neutral, never the accent', () => {
    const { container } = mount(<PlatformUsageView read={{ state: 'ok', usage: usage(true) }} />);
    const parts = [...container.querySelectorAll<HTMLElement>('[data-part]')].filter((p) => p.closest('[aria-label="Real-work calls by week, by team"]'));
    expect(parts.length).toBeGreaterThan(0);
    const colours = new Map<string, Set<string>>();
    for (const p of parts) colours.set(p.dataset.part!, (colours.get(p.dataset.part!) ?? new Set()).add(p.style.background));
    const teams = [...colours.keys()].filter((k) => k !== 'Other');
    expect(teams.length).toBeGreaterThan(1);
    for (const t of teams) {
      expect(parts.filter((p) => p.dataset.part === t).every((p) => p.dataset.tone === 'series'), t).toBe(true);
      expect(colours.get(t)!.size, t).toBe(1);
    }
    expect(new Set(teams.map((t) => [...colours.get(t)!][0])).size).toBe(teams.length);
    expect(parts.filter((p) => p.dataset.part === 'Other').every((p) => p.dataset.tone === 'neutral')).toBe(true);
    expect(parts.some((p) => p.dataset.tone === 'accent')).toBe(false);
  });
});

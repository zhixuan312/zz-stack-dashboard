import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the settings page shows are the data's — the ninth and last page of `standard.md`'s floor, "the numbers
 * the pages show are the data's", and the last one to get a test of its own.
 *
 * It is the last for a reason worth writing down. It draws no tiles, and it mounts five panels at once, each reading a
 * different route with a different shape. A stub that answers the wrong shape throws inside a panel, that panel's error
 * boundary draws in its place, and the page still renders — so this is the one page where a test can be green while the
 * page is not. Every read is answered below with its real type, and one assertion of every case is that the section is
 * drawn at all rather than replaced.
 *
 * WHAT IS PINNED, and why each could not be reached by counting something else:
 *
 *   `Everyone on this deployment, 5 in all`  the platform people panel's own read. The fixture holds five people, two
 *                                            team memberships and three tokens, so a page counting the wrong array
 *                                            cannot reach this sentence.
 *   `atlas (member), beacon (member)`        a person's teams, joined from the ROW's own `teams` array — not from the
 *                                            teams panel, which answers a different question.
 *   `no team`                                the same cell for a person on none, which says so rather than reading
 *                                            blank.
 *   `acting`, on the second row              the teams panel marks the team the data marks. The fixture marks the
 *                                            second, so a page marking the first row fails.
 *   `active` twice and `revoked` once        the tokens panel reads each token's state from its own record. Counted as
 *                                            leaf elements inside that section: the platform people table carries an
 *                                            `active` badge of its own, so an unscoped count would be counting it.
 *
 * NOT COVERED HERE: `GET /settings/team/members`, which no panel asks for until a team is in view, and none is on a
 * superadmin's page — the team field is free text and starts empty. `tests/team-settings.test.tsx` covers that panel.
 */
import type { Me, MyAccessToken, MyClientSetup, MyTeams, PlatformPersonRow } from '@/lib/api-shapes';
import SettingsPage from '../app/(dash)/settings/page';

const ME: Me = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }, { slug: 'beacon', role: 'member' }],
  activeTeam: 'atlas',
};

/** Five people; the first and the last are superadmins, one holds no team at all. */
const PEOPLE: PlatformPersonRow[] = [
  { email: 'one@example.com', display_name: 'One', role: 'superadmin', status: 'active', created_at: '2026-08-01T00:00:00Z',
    teams: [{ team: 'atlas', role: 'admin', added_by: null, added_at: '2026-08-01T00:00:00Z' }] },
  { email: 'two@example.com', display_name: 'Two', role: 'member', status: 'active', created_at: '2026-08-02T00:00:00Z',
    teams: [
      { team: 'atlas', role: 'member', added_by: 'one@example.com', added_at: '2026-08-02T00:00:00Z' },
      { team: 'beacon', role: 'member', added_by: 'one@example.com', added_at: '2026-08-03T00:00:00Z' },
    ] },
  // A principal exists before anybody adds them to a team, so this row is a real state and not a gap in the fixture.
  { email: 'three@example.com', display_name: 'Three', role: 'member', status: 'active', created_at: '2026-08-03T00:00:00Z',
    teams: [] },
  { email: 'four@example.com', display_name: 'Four', role: 'member', status: 'active', created_at: '2026-08-04T00:00:00Z',
    teams: [{ team: 'beacon', role: 'member', added_by: null, added_at: '2026-08-04T00:00:00Z' }] },
  { email: 'five@example.com', display_name: 'Five', role: 'superadmin', status: 'active', created_at: '2026-08-05T00:00:00Z',
    teams: [{ team: 'atlas', role: 'member', added_by: null, added_at: '2026-08-05T00:00:00Z' }] },
];

/* Two teams, and the one this browser acts for is the SECOND — so a panel that badges the first row, or badges every
 * row, meets a different page from this one. */
const TEAMS: MyTeams = {
  actingFor: 'beacon',
  teams: [{ team: 'atlas', role: 'admin', active: false }, { team: 'beacon', role: 'member', active: true }],
  note: null,
};

/* Three tokens, one of them revoked: "active" and "revoked" are each the token's own record, not a page state. */
const TOKENS: MyAccessToken[] = [
  { id: 't1', label: 'laptop — Claude Code', created_at: '2026-09-01T00:00:00Z', last_used_at: '2026-10-01T00:00:00Z', revoked_at: null },
  { id: 't2', label: 'ci-runner', created_at: '2026-09-02T00:00:00Z', last_used_at: null, revoked_at: null },
  { id: 't3', label: 'old laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: '2026-08-15T00:00:00Z', revoked_at: '2026-09-01T00:00:00Z' },
];

const SETUP: MyClientSetup = { client: 'claude-code', config: '{\n  "mcpServers": { "zz": { "url": "https://example.invalid/mcp" } }\n}' };

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    // `/console/me` last: every `/settings/me/*` route contains "/me" as a substring, and answering one of those with
    // the caller's own `Me` throws inside the panel that asked.
    const body = url.includes('/settings/platform/people') ? PEOPLE
      : url.includes('/settings/me/teams') ? TEAMS
        : url.includes('/settings/me/tokens') ? TOKENS
          : url.includes('/settings/me/client-setup') ? SETUP
            : url.endsWith('/console/me') ? ME
              : {};
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

const text = () => document.body.textContent ?? '';

/** The section whose heading is `title` — thrown on rather than returning the body, so a scoped count can never
 *  quietly become a count of the whole page. */
function section(title: string): HTMLElement {
  const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === title);
  const el = heading?.closest('section');
  if (!el) throw new Error(`no section headed "${title}" — is the heading worded differently?`);
  return el as HTMLElement;
}

/** The text an element holds itself, ignoring its descendants' — a badge's own label, not the cell around it. */
function ownText(el: Element): string {
  return [...el.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent ?? '')
    .join('')
    .trim();
}

/** The elements holding exactly `word` as their own text: a badge, not a row or a sentence that contains it.
 *
 *  Not "an element with no element children" — a `Badge` with `dot` draws a decorative `<span>` beside its label, so
 *  the label is a bare text node and the badge itself does have a child. Reading the element's OWN text nodes catches
 *  it either way, and still misses a `<td>`, whose own text is whitespace and whose label lives in a child. */
function badges(root: HTMLElement, word: string): Element[] {
  return [...root.querySelectorAll('*')].filter((el) => ownText(el) === word);
}

/** The row of `root` whose text carries `needle`. */
function row(root: HTMLElement, needle: string): HTMLElement {
  const found = [...root.querySelectorAll('tr')].find((r) => r.textContent?.includes(needle));
  if (!found) throw new Error(`no row carrying "${needle}"`);
  return found as HTMLElement;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/settings');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

/**
 * Awaited inside `act`: the Assistant section waits on the layout's promise of whether the console has an assistant,
 * so the page suspends on its first render, and React flushes nothing after an `act` that was not awaited.
 */
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { render(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>); });
}

describe('the figures on the settings page', () => {
  it('counts the people the platform read holds, in the sentence that carries the number', async () => {
    await mount();
    // The count arrives with the read; the sentence without it ("Everyone on this deployment.") is on the page first.
    await waitFor(() => expect(text()).toContain('Everyone on this deployment, 5 in all'));
    // Five people, where the teams panel holds two and the tokens panel three — so this sentence is not reachable by
    // counting either of those, and the section is drawn rather than replaced by its boundary.
    expect(section('People')).toBeTruthy();
    expect(text()).toContain('one@example.com');
    expect(text()).toContain('five@example.com');
  });

  it('joins each person’s teams from their own row, and says so when there are none', async () => {
    await mount();
    await waitFor(() => expect(text()).toContain('one@example.com'));
    expect(row(section('People'), 'two@example.com').textContent).toContain('atlas (member), beacon (member)');
    expect(row(section('People'), 'one@example.com').textContent).toContain('atlas (admin)');
    // Nobody to act for is a state a person is in, not a blank cell to interpret.
    expect(row(section('People'), 'three@example.com').textContent).toContain('no team');
  });

  it('marks the team this browser acts for, and only that one', async () => {
    await mount();
    await waitFor(() => expect(text()).toContain('beacon'));
    const teams = section('Your teams');
    expect(badges(teams, 'acting')).toHaveLength(1);
    expect(row(teams, 'beacon').textContent).toContain('acting');
    // The first row is a team this browser is not acting for, so it carries no such badge.
    expect(row(teams, 'atlas').textContent).not.toContain('acting');
  });

  it('reads each token’s state from its own record', async () => {
    await mount();
    await waitFor(() => expect(text()).toContain('laptop — Claude Code'));
    const tokens = section('Access tokens');
    expect(badges(tokens, 'revoked')).toHaveLength(1);
    expect(badges(tokens, 'active')).toHaveLength(2);
    expect(row(tokens, 'old laptop').textContent).toContain('revoked');
    // Not the row of the token whose label merely ends in "laptop": "old laptop" is the third one's own.
    expect(row(tokens, 'ci-runner').textContent).toContain('active');
  });

  it('draws the client setup the read answered with, verbatim', async () => {
    await mount();
    // A wrong-shaped answer here throws and the boundary draws; the config text is what says the panel got its own.
    await waitFor(() => expect(text()).toContain('mcpServers'));
    expect(text()).toContain('https://example.invalid/mcp');
  });
});

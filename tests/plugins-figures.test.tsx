import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me, PluginRow } from '@/lib/api-shapes';
import { formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { PluginsView } from '@/views/pages/plugins';
import type { Catalog, PluginsRead } from '@/views/plugins-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';

/**
 * The figures Plugins draws are the catalog's, each in its own column for the plugin the row names: the fake gateway's
 * own answer, the one `pnpm verify` serves the page, is what is drawn, and a cell is read by the header it stands under,
 * so a column mapped onto another's data cannot pass. Both people read it: the superadmin is sent each protocol's key,
 * a member only its version, and the page draws what each was sent.
 */
const catalogOf = (who: Me): Catalog => plugins(who)[1] as Catalog;
const served = (who: Me): PluginsRead => ({ state: 'ok', path: '/plugins', at: '2026-10-17T09:00:00Z', data: catalogOf(who) });

beforeEach(() => {
  window.history.replaceState(null, '', '/plugins');
  // The page is the server's read: the browser is never answered, so anything drawn came from it.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

const mount = (read: PluginsRead) => render(<Tooltip.Provider><PluginsView served={read} /></Tooltip.Provider>);

/** The text of `plugin`'s row in the column whose header is `header`: its value, not the words a phone card adds. */
function cell(plugin: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tbody tr')].find((r) => r.querySelector('td')?.textContent?.startsWith(plugin));
  if (column < 0 || !row) return `no ${header} column or no ${plugin} row`;
  const td = [...row.querySelectorAll('td')][column];
  const value = td ? [...td.children].find((e) => !e.hasAttribute('data-sep') && !e.classList.contains('hidden')) : undefined;
  return ((value ?? td)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const row = (who: Me, name: string): PluginRow => catalogOf(who).plugins.find((p) => p.plugin === name)!;

describe('the figures on Plugins', () => {
  it('draws the spec\'s columns, in its order, and no tile', () => {
    mount(served(ME));
    expect([...document.querySelectorAll('th')].map((h) => h.textContent?.trim())).toEqual(['Plugin', 'Required', 'Version', 'Skills', 'Gates', 'Score', 'Install']);
    expect(document.querySelector('[data-split="tiles"]')).toBeNull();
  });

  it('draws every plugin in the gateway\'s order, the team\'s most recently used first', () => {
    mount(served(ME));
    const names = [...document.querySelectorAll('tbody tr')].map((r) => r.querySelector('td .font-medium')?.textContent?.trim());
    expect(names).toEqual(catalogOf(ME).plugins.map((p) => p.plugin));
  });

  it('shows each plugin\'s own skills, gates, version and requirement, read per row', () => {
    mount(served(ME));
    for (const p of catalogOf(ME).plugins) {
      expect(cell(p.plugin, 'Skills'), p.plugin).toBe(formatCount(p.skills.length));
      expect(cell(p.plugin, 'Gates'), p.plugin).toBe(formatCount(p.gates));
      expect(cell(p.plugin, 'Required'), p.plugin).toBe(p.required ? 'Required' : 'Optional');
      expect(cell(p.plugin, 'Version'), p.plugin).toBe(p.version ? `${p.version}${p.release ? 'released' : 'not released'}` : 'None declared');
    }
  });

  it('quotes each score out of 10 with the protocol and the day it was scored against, and says when there is none', () => {
    mount(served(ME));
    const sdlc = row(ME, 'sdlc').score!;
    expect(cell('sdlc', 'Score')).toBe(`${sdlc.value.toFixed(1)} / 10 · ${formatShortDate(sdlc.scoredAt)}${sdlc.protocol.key} v${sdlc.protocol.version}`);
    expect(cell('research-kit', 'Score')).toBe('Never scored');
    expect(cell('zz-access', 'Score')).toBe('Never scored');
  });

  it('gives a member the protocol\'s version and never its key, as the gateway sent it', () => {
    mount(served(MEMBER));
    const sdlc = row(MEMBER, 'sdlc').score!;
    expect(sdlc.protocol.key).toBeNull();
    expect(cell('sdlc', 'Score')).toBe(`${sdlc.value.toFixed(1)} / 10 · ${formatShortDate(sdlc.scoredAt)}v${sdlc.protocol.version} of its own protocol`);
    expect(document.body.textContent).not.toContain(row(ME, 'sdlc').score!.protocol.key!);
  });

  it('puts each plugin\'s own install command in its Copy control', () => {
    mount(served(MEMBER));
    for (const p of catalogOf(MEMBER).plugins) {
      const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.querySelector('td')?.textContent?.startsWith(p.plugin)) as HTMLElement;
      expect(within(tr).getAllByLabelText(`the command that installs ${p.plugin}`)[0]).toHaveTextContent(p.install);
      expect(within(tr).getAllByRole('button', { name: `Copy the command that installs ${p.plugin}` }).length).toBeGreaterThan(0);
    }
  });

  it('counts what the search lets through', () => {
    mount(served(ME));
    expect(screen.getByText(`${catalogOf(ME).plugins.length} plugins`)).toBeInTheDocument();
  });
});

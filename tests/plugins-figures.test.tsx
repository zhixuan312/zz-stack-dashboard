import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tooltip } from 'radix-ui';

/**
 * The figures the plugins page leads with are the data's — the eighth page of `standard.md`'s floor, and the last of the
 * tile-led kind.
 *
 * What it pins: figures that cannot be reached by counting something else, of different KINDS, which is why this page
 * is worth its own test. "Plugins" is a row count. "Skills" is not — it is the SUM of every plugin's skill list, which
 * the page computes, and a page that showed the plugin count there would render and be wrong. "Never run" is a filter
 * over those skills, by the team. "Required" is a count of a different column again. And a plugin's score is quoted with
 * the protocol version it was scored against, or said to be none.
 *
 * The fixture gives every one of those a different answer: 3 plugins, 4 skills, 2 required, 1 never run.
 */
import { PeriodProvider } from '@/console/period';
import type { PluginRow } from '@/lib/api-shapes';
import { PluginsView } from '@/views/pages/plugins';

const TooltipProvider = Tooltip.Provider;

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const skill = (name: string, everRun: boolean) => ({
  name, position: null, isEntry: false, origin: 'ours' as const, version: null, description: null, source: null,
  versions: 1, calls: everRun ? 3 : 0, evals: 0, everRun, lastRun: everRun ? '2026-10-01T00:00:00Z' : null,
});

const plugin = (name: string, over: Partial<PluginRow>): PluginRow => ({
  plugin: name, owner: 'zz', agentName: null, description: `${name} does a thing`, version: null,
  servers: [], stages: [], entry: null, documents: [], gates: 0, skills: [], release: null,
  required: false, install: `claude plugin install ${name}@zz-stack`, score: null, comparability: 'No score to compare',
  yourTeam: { calls: 0, failed: 0, lastRun: null }, ...over,
});

/* Three plugins, and the counts that matter are each a different number:
 *   plugins 3 · skills 2+1+1 = 4 · required 2 · never run 1 */
const PLUGINS: PluginRow[] = [
  plugin('sdlc', {
    version: '0.92.10', stages: ['intent', 'spec'], entry: 'sdlc-flow', gates: 3,
    skills: [skill('sdlc-spec', true), skill('sdlc-plan', true)],
    release: { version: '0.92.10', digest: 'abc123', evals: 4 },
    score: { value: 7.1, lower: 6.5, upper: 7.7, standing: 'established', protocol: { key: null, version: 2 }, scoredAt: '2026-10-12T00:00:00Z' },
    comparability: 'Not comparable: a different protocol version',
    yourTeam: { calls: 6, failed: 1, lastRun: '2026-10-01T00:00:00Z' },
  }),
  plugin('research-kit', { version: '1.4.0', required: true, skills: [skill('research-scan', true)], yourTeam: { calls: 3, failed: 0, lastRun: '2026-10-01T00:00:00Z' } }),
  // Neither a version nor a score, and its one skill the team never ran.
  plugin('sketchbook', { required: true, skills: [skill('sketch-note', false)] }),
];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : { plugins: PLUGINS };
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/plugins');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <TooltipProvider>
          <PluginsView />
        </TooltipProvider>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

describe('the figures on the plugins page', () => {
  it('sums every plugin’s skills, which is not the number of plugins', async () => {
    mount();
    await waitFor(() => expect(figure('Plugins')).toBe('3'));
    expect(figure('Skills')).toBe('4');
  });

  it('counts the required plugins, which is not the plugins that ran', async () => {
    mount();
    await waitFor(() => expect(figure('Plugins')).toBe('3'));
    expect(figure('Required')).toBe('2');
  });

  it('counts the skills the team never ran', async () => {
    mount();
    await waitFor(() => expect(figure('Plugins')).toBe('3'));
    // One skill of the four, on the plugin that also carries neither a version nor a score.
    expect(figure('Never run')).toBe('1');
  });

  it('quotes a score with the protocol version it was scored against, and says when there is none', async () => {
    mount();
    await waitFor(() => expect(text()).toContain('7.1'));
    expect(text()).toContain('protocol v2');
    expect(text()).toContain('never scored');
    // The calls are the team's, and say so.
    expect(text()).toContain('Your team\'s calls');
  });
});

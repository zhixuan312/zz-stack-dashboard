import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tooltip } from 'radix-ui';

/**
 * The figures the plugins page leads with are the data's — the eighth page of `standard.md`'s floor, and the last of the
 * tile-led kind.
 *
 * What it pins: three figures that cannot be reached by counting something else, and they are three different KINDS of
 * figure, which is why this page is worth its own test. "Plugins" is a row count. "Skills" is not — it is the SUM of
 * every plugin's skill list, which the page computes, and a page that showed the plugin count there would render and be
 * wrong. "Never run" is a filter over those skills. "Released" comes through its note — `Of N declaring a version` —
 * and is a count of a different column again.
 *
 * The fixture gives every one of those a different answer: 3 plugins, 4 skills, 2 declaring a version, 1 released, 1
 * never run.
 */
import { PeriodProvider } from '@/console/period';
import type { PluginRow } from '@/lib/api-shapes';
import PluginsPage from '../app/(dash)/plugins/page';

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
  servers: [], stages: [], entry: null, documents: [], gates: 0,
  skills: [], calls: 0, failed: 0, lastRun: null, release: null, latestEval: null, ...over,
});

/* Three plugins, and the counts that matter are each a different number:
 *   plugins 3 · skills 2+1+1 = 4 · declaring a version 2 · released 1 · never run 1 */
const PLUGINS: PluginRow[] = [
  plugin('sdlc', {
    version: '0.92.10', stages: ['intent', 'spec'], entry: 'sdlc-flow', gates: 3,
    skills: [skill('sdlc-spec', true), skill('sdlc-plan', true)],
    release: { version: '0.92.10', digest: 'abc123', evals: 4 },
  }),
  plugin('research-kit', { version: '1.4.0', skills: [skill('research-scan', true)] }),
  // Neither a version nor a release, and its one skill has never run — so "Released" (1) and "Never run" (1) answer
  // different questions about different rows, and a page confusing them fails.
  plugin('sketchbook', { skills: [skill('sketch-note', false)] }),
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
          <PluginsPage />
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

  it('counts what was released apart from what declares a version', async () => {
    mount();
    await waitFor(() => expect(text()).toContain('Of 2 declaring a version'));
    expect(figure('Released')).toBe('1');
  });

  it('counts the skills nobody has ever run', async () => {
    mount();
    await waitFor(() => expect(figure('Plugins')).toBe('3'));
    // One skill of the four, on the plugin that also carries neither a version nor a release.
    expect(figure('Never run')).toBe('1');
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsoleModeProvider, useConsole, useConsoleMode } from '@/lib/api';

/**
 * When the console reads its data again.
 *
 * COUPLED: `ConsoleModeProvider.setMode` and the query key `useConsole` builds. The key is the
 * path alone, and the scope travels in the URL, because the gateway decides a scope from the
 * CALLER rather than from the parameter (`services/gateway/src/scope.ts`): a non-superadmin
 * sending `scope=platform` gets exactly what it would have got without it. So the mode settles
 * from `/me` and the read it already made stands, and a scope somebody chooses by hand is the one
 * act that makes those cached rows the wrong ones — it drops them and reads again.
 *
 * DELIBERATE: this is the only layer that can see either half. The console's fake gateway answers
 * the same rows for both scopes, so the browser audit passes whichever way this goes, and a read
 * that never re-reads on a hand-picked scope looks exactly like one that does.
 */

const me = (superadmin: boolean) => ({
  email: 'a@b.example.com', name: 'A', role: superadmin ? 'superadmin' : 'member',
  mayRead: true, superadmin, via: 'session',
  teams: [{ slug: 'team-one', role: 'member' }], activeTeam: 'team-one',
});

let calls: string[];

/** A probe that reads like a page does, and a button that switches scope like the rail does. */
function Probe() {
  const q = useConsole<{ marker: string }>('/overview');
  const { mode, setMode } = useConsoleMode();
  return (
    <div>
      <span data-testid="marker">{q.data?.marker ?? 'pending'}</span>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={() => setMode(mode === 'platform' ? 'team' : 'platform')}>switch</button>
    </div>
  );
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsoleModeProvider><Probe /></ConsoleModeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const body = url.includes('/me')
      ? me(process.env.ZZ_TEST_SUPER === '1')
      : { marker: url.includes('scope=platform') ? 'platform' : 'team' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.ZZ_TEST_SUPER; });

describe('a scope that settles from /me', () => {
  it('reads once: the answer that arrived under the undecided scope is the one the page keeps', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent(/platform|team/));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.getByTestId('mode')).toHaveTextContent('team');
    // One read of `/overview`, whatever scope the first one went out under. Before this held, a
    // member read every endpoint twice — once scoped `platform` and once `team`.
    expect(calls.filter((u) => u.includes('/overview'))).toHaveLength(1);
  });
});

describe('a scope somebody chooses', () => {
  it('reads again, under the scope they chose', async () => {
    process.env.ZZ_TEST_SUPER = '1';
    mount();
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('platform'));
    const before = calls.filter((u) => u.includes('/overview')).length;

    await act(async () => { screen.getByRole('button', { name: 'switch' }).click(); });

    await waitFor(() => expect(screen.getByTestId("mode")).toHaveTextContent("team"));
    await waitFor(() => expect(calls.filter((u) => u.includes('/overview')).length).toBeGreaterThan(before));
    // The new read carries the chosen scope, and the rows it brings are the new scope's — not the
    // ones the shared cache entry already held.
    await waitFor(() => expect(screen.getByTestId('marker')).toHaveTextContent('team'));
  });
});

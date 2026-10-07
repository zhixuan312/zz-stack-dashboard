import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VersionChain } from '@/console/version-chain';
import type { DocumentDetail } from '@/lib/api-shapes';

/**
 * The history is one entry per public version, and a version's text is read by its snapshot id.
 *
 * A version can hold several snapshots, so `version` and `revision` differ: v1 below is snapshot 2,
 * its last retained state; snapshot 1 was an earlier one of v1, presented and then changed with no
 * new cause. Reading v1's text by its version number would fetch snapshot 1 — a real snapshot, of
 * the wrong bytes. v2 is snapshot 3, the live one, whose text the page already holds.
 */
const fetched: string[] = [];
beforeEach(() => {
  fetched.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(url);
    const revision = Number(/[?&]revision=(\d+)/.exec(url)?.[1]);
    return { ok: true, status: 200,
             json: async () => ({ version: revision <= 2 ? 1 : 2, revision, body: `text of r${revision}\n` }) } as unknown as Response;
  }));
});

const doc: DocumentDetail = {
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow',
  current_revision: 3, current_version: 2, correction: null, content_revision: 'cr_dddddddddddddddddddddddddd',
  type: 'agreement', status: 'approved', outcome: null,
  approved_by: 'a@b.example.com', approved_at: '2026-08-31T00:00:00Z', closed_by: null,
  title: 'The spec', tags: null, stakeholder: null, fields: {}, evidence: null, superseded_by: null, body: 'text of r3\n',
  updated_at: '2026-09-01T00:00:00Z', bytes: 11,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  versions: [
    { path: 'spec.md', hash: 'h2', status: 'draft', approved_by: null, updated_at: '2026-08-30T00:00:00Z', version: 1, revision: 2 },
    { path: 'spec.md', hash: 'h3', status: 'approved', approved_by: 'a@b.example.com', updated_at: '2026-08-31T00:00:00Z', version: 2, revision: 3 },
  ],
  sources: [],
};

describe('VersionChain', () => {
  it('names each change by public version and reads its text by snapshot', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><VersionChain doc={doc} /></QueryClientProvider>);
    expect(screen.getByText('v1 → v2')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('text of r3')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('text of r2')).toBeInTheDocument());
    expect(fetched.some((u) => /[?&]revision=2\b/.test(u))).toBe(true);
    expect(fetched.some((u) => /[?&]revision=1\b/.test(u))).toBe(false);
  });

  it('says a version whose text could not be read cannot be compared, and loses nothing above', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'database unreachable' }) }) as unknown as Response));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><VersionChain doc={doc} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText(/could not be read, so the change cannot be/)).toBeInTheDocument());
  });

  // Older documents filed a version for every approval or metadata write, so neighbours can carry the same text.
  it('lists versions with the same text as one change, and says why without promising they still happen', () => {
    const same = { ...doc, current_revision: 3, current_version: 3, status: 'approved', approved_by: 'a@b.example.com', body: 'text of r3\n', versions: [
      { path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null, updated_at: '2026-08-30T00:00:00Z', version: 1, revision: 1 },
      { path: 'spec.md', hash: 'h3', status: 'draft', approved_by: null, updated_at: '2026-08-31T00:00:00Z', version: 2, revision: 2 },
      { path: 'spec.md', hash: 'h3', status: 'approved', approved_by: 'a@b.example.com', updated_at: '2026-09-01T00:00:00Z', version: 3, revision: 3 },
    ] };
    render(<QueryClientProvider client={new QueryClient()}><VersionChain doc={same} /></QueryClientProvider>);
    expect(screen.getByText('v2–v3')).toBeInTheDocument();
    expect(screen.getByText('2 versions, same text')).toBeInTheDocument();
    expect(screen.getByText(/1 version is listed with the one before it: same text\. Older documents filed a version for every approval or metadata change\./)).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
});

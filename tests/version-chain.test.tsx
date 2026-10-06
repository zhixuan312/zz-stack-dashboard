import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VersionChain } from '@/console/version-chain';
import type { DocumentDetail } from '@/lib/api-shapes';

/**
 * The history is one entry per public version, and a version's text is read by its snapshot id.
 *
 * A version can hold several snapshots, so `version` and `revision` differ: v2 below is snapshot 3,
 * and the document's live snapshot is 4, a draft filed after v2 was approved. Reading a version's
 * text by its version number would fetch snapshot 2 — a real snapshot, of the wrong bytes.
 */
const fetched: string[] = [];
beforeEach(() => {
  fetched.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(url);
    const revision = Number(/[?&]revision=(\d+)/.exec(url)?.[1]);
    return { ok: true, status: 200,
             json: async () => ({ version: revision === 1 ? 1 : 2, revision, body: `text of r${revision}\n` }) } as unknown as Response;
  }));
});

const doc: DocumentDetail = {
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow',
  current_revision: 4, current_version: 2, correction: null, content_revision: 'cr_dddddddddddddddddddddddddd',
  type: 'agreement', status: 'draft', outcome: null,
  approved_by: null, approved_at: null, closed_by: null,
  title: 'The spec', tags: null, evidence: null, superseded_by: null, body: 'text of r4\n',
  updated_at: '2026-09-01T00:00:00Z', bytes: 11,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  versions: [
    { path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null, updated_at: '2026-08-30T00:00:00Z', version: 1, revision: 1 },
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
    expect(fetched.some((u) => /[?&]revision=1\b/.test(u))).toBe(true);
    expect(fetched.some((u) => /[?&]revision=3\b/.test(u))).toBe(true);
    expect(fetched.some((u) => /[?&]revision=2\b/.test(u))).toBe(false);
  });
});

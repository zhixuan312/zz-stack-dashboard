/**
 * One document waiting for approval and the member who may approve it, for the tests of Approve and of the page that
 * holds it. Written once so a field added to `DocumentDetail` is added in one place, and the two suites read the same
 * document.
 */
import type { DocumentDetail, Me } from '@/lib/api-shapes';

/** The content revision the reader read, a newer one another session wrote, and the presentation the read recorded. */
export const OLD = 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaa';
export const NEW = 'cr_cccccccccccccccccccccccccc';
export const CONTEXT = 'rc_bbbbbbbbbbbbbbbbbbbbbbbbbb';

/** A member of `team-one`, the team the document is in, signed in by a browser session. */
export const READER: Me = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true,
  superadmin: false, via: 'session', teams: [{ slug: 'team-one', role: 'member' }], activeTeam: 'team-one',
};

/** `team-one/init-1/spec.md`, a gated draft at one version, at `content_revision` with `body`. */
export const draftAt = (content_revision = OLD, body = 'body'): DocumentDetail => ({
  team: 'team-one', initiative: 'init-1', path: 'spec.md', flow: 'sdlc-flow', current_revision: 1,
  current_version: 1, correction: null, content_revision,
  type: 'agreement', status: 'draft', outcome: null, approved_by: null, approved_at: null, closed_by: null,
  title: 'The spec', tags: null, stakeholder: null, fields: {}, evidence: null, superseded_by: null, body,
  updated_at: '2026-09-01T00:00:00Z', bytes: body.length,
  gated: true, closing: false, requiredForClose: false,
  decisions: [], decisionCounts: { rows: 0, withVerdict: 0, withQualifier: 0, withChecker: 0 },
  // One version, so the history panel reads nothing of its own.
  versions: [{ path: 'spec.md', hash: 'h1', status: 'draft', approved_by: null, updated_at: '2026-09-01T00:00:00Z', version: 1, revision: 1, superseded_approved: null }],
  sources: [],
});

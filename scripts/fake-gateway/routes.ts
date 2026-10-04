/**
 * The detail pages the browser checks visit, one per state worth seeing, taken from the fake gateway's own records:
 * a team with work and one with none, an initiative waiting on a person, a closed one, one with no flow, a document
 * approved and one awaiting approval, a current and a superseded knowledge node, a plugin with an evaluation, one
 * never profiled, one vendored and never run, and a skill in each of its views. Static routes are found on their own.
 */
export const DETAIL_ROUTES = [
  '/teams/atlas',
  '/teams/dune',
  '/initiatives/atlas/2026-09-28-search-relevance',
  '/initiatives/cinder/2026-08-20-incident-runbooks',
  '/initiatives/atlas/2026-09-05-research-notes',
  '/initiatives/atlas/2026-09-28-search-relevance/spec.md',
  '/initiatives/atlas/2026-09-28-search-relevance/plan.md',
  '/knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md',
  '/knowledge/atlas/nodes/0004-rank-by-recency-first.md',
  '/plugins/sdlc',
  '/plugins/zz-access',
  '/plugins/research-kit',
  '/plugins/sdlc/sdlc-spec',
  '/plugins/sdlc/sdlc-spec?view=read',
  '/plugins/sdlc/sdlc-spec?view=references',
  '/plugins/research-kit/research-scan',
];

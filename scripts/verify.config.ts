/**
 * What `pnpm verify` needs to know about this project that it cannot discover from `app/`. Edit it; verify reads it.
 */
export type VerifyConfig = {
  /**
   * Detail pages checked beside every static route, one per state worth seeing (a normal record, a failed one, a missing
   * one). `pnpm verify --extra a,b` replaces them for one run.
   */
  detailRoutes: string[];
  /**
   * For a product whose pages read and write a live API. verify presses every control it finds, Approve, Revoke and
   * Delete included, so those presses must reach a fake, never production. `script` starts a server on `--port 0` that
   * answers every route the pages call (writes answer success and are forgotten) and prints `listening on <url>`; verify
   * starts it first and builds and serves the app with the environment variable `env` set to that URL. Leave it out only
   * when the pages read nothing but local data, as this sample does.
   */
  fakeApi?: { script: string; env: string };
  /**
   * The product's own browser checks, beside Meridian's audit, presses and keyboard walk: scripts verify runs with
   * `--base <url>` against the built app, failing when one exits non-zero.
   */
  browserChecks?: string[];
};

const config: VerifyConfig = {
  // One per state worth seeing, taken from the fake gateway's own records (scripts/fake-gateway): a team with
  // work and one with none, an initiative waiting on a person, a closed one, one closed with a correction awaiting
  // approval, one with no flow, a document approved, one awaiting approval, a correction the signed-in user may approve
  // and one in another of their teams (which tells them to switch), a document that moves after every read (out of
  // date), a current and a superseded knowledge node, a plugin with an evaluation, one never profiled, one vendored and
  // never run, and a skill in each of its views.
  detailRoutes: [
    '/teams/atlas',
    '/teams/dune',
    '/initiatives/atlas/2026-09-28-search-relevance',
    '/initiatives/cinder/2026-08-20-incident-runbooks',
    '/initiatives/beacon/2026-09-22-payout-schedule',
    '/initiatives/atlas/2026-09-05-research-notes',
    '/initiatives/atlas/2026-09-28-search-relevance/spec.md',
    '/initiatives/atlas/2026-09-28-search-relevance/plan.md',
    '/initiatives/atlas/2026-09-12-onboarding-revamp/review.md',
    '/initiatives/beacon/2026-09-22-payout-schedule/review.md',
    '/initiatives/atlas/2026-10-02-query-latency/spec.md',
    '/knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md',
    '/knowledge/atlas/nodes/0004-rank-by-recency-first.md',
    '/plugins/sdlc',
    '/plugins/zz-access',
    '/plugins/research-kit',
    '/plugins/sdlc/sdlc-spec',
    '/plugins/sdlc/sdlc-spec?view=read',
    '/plugins/sdlc/sdlc-spec?view=references',
    '/plugins/research-kit/research-scan',
  ],
  // The presses approve, revoke and archive whatever a page offers; they reach the fake gateway, never the deployment.
  fakeApi: { script: 'scripts/fake-gateway/server.ts', env: 'ZZ_GATEWAY' },
};

export default config;

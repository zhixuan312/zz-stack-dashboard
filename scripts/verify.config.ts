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
   * Limits verify enforces. `htmlKb` caps a route's uncompressed HTML, through the end of the streamed response; it has
   * no default, and there is no point setting one without a measurement behind it.
   */
  budgets?: { htmlKb?: Record<string, number> };
  /**
   * One check for every route in the rail. `--full` and `--perf` fail on a rail route that has none; the default smoke
   * reports its data and interaction as not configured. Probes never write.
   */
  navigationChecks?: {
    path: string;
    title: string;
    readySelector: string;
    readyText?: string;
    probe: 'dialog' | 'filter' | 'sort' | 'toggle' | 'link';
    controlSelector: string;
    resultSelector: string;
  }[];
  /**
   * Routes that cannot be prerendered, each with the reason. `node scripts/route-policy.ts`, which verify runs after its
   * production build, fails any non-API route that is neither static nor partial unless it is named here.
   */
  requestDependentRoutes?: { path: string; reason: string }[];
  /**
   * The product's own browser checks, beside Meridian's audit, presses and keyboard walk: scripts verify runs with
   * `--base <url>` against the built app, failing when one exits non-zero.
   */
  browserChecks?: string[];
};

const config: VerifyConfig = {
  /**
   * Measured on 2026-10-11, served against the fake gateway: the list pages are the console's heaviest uncompressed
   * HTML, `/initiatives` at 65 KiB and `/people` at 63, against 36 on `/` and 45 on `/settings`. The caps hold roughly
   * a fifth above what they measure, which is room for a column and not for a second table.
   */
  budgets: { htmlKb: { '/initiatives': 80, '/people': 80 } },
  /**
   * The three routes the default smoke visits — the landing route and the next two in the rail. Each selector was read
   * off the built app served against the fake gateway on 2026-10-11, not guessed: `/` draws 26 table rows and one
   * `aria-haspopup="dialog"` control, `/teams` 4 rows and one search field, `/initiatives` 11 rows and one.
   *
   * The probe is the one that changes something unambiguous. On `/teams` and `/initiatives` a search field filters the
   * rows it is beside; on `/` there is no search field, and its radios are two segmented groups whose checked item
   * simply moves, so the dialog is the change this can read.
   */
  navigationChecks: [
    { path: '/', title: 'Overview', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
    { path: '/teams', title: 'Teams', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/initiatives', title: 'Initiatives', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
  ],
  /**
   * Every non-API route whose rendering `scripts/route-policy.ts` cannot read, with why.
   *
   * Six of these are genuinely request-dependent: their path is keyed by a team, an initiative, a plugin or a knowledge
   * path that lives in the gateway's data, so a build has nothing to enumerate.
   *
   * The other eighteen ARE prerendered — all of them appear in the build's `prerender-manifest.json`, as
   * `pnpm verify` reported before this list existed. They are here because that check reads each route's
   * `renderingMode`, and Next only writes that field when `cacheComponents` is on. This console cannot turn it on (see
   * docs/brief.md, and `cache-components-config` in the 0.13.0 update session): the release's own answer is a server
   * promise per piece of chrome, which needs the access seam this console does not have. Declaring them keeps the
   * check's verdict honest — "not known to be prerendered" — instead of claiming they read a request they never touch.
   */
  requestDependentRoutes: [
    { path: '/initiatives/[team]/[slug]', reason: 'the initiative only exists in the gateway’s data; the build cannot enumerate it.' },
    { path: '/initiatives/[team]/[slug]/[...path]', reason: 'a document inside that initiative: same reason, one level deeper.' },
    { path: '/knowledge/[team]/[...path]', reason: 'a knowledge node’s path is its own slug, recorded at runtime.' },
    { path: '/plugins/[plugin]', reason: 'the plugin estate is the platform’s, not this repository’s.' },
    { path: '/plugins/[plugin]/[skill]', reason: 'a skill inside that plugin: same reason.' },
    { path: '/teams/[slug]', reason: 'a team is a row in the platform’s database.' },
    { path: '/_global-error', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/_not-found', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/activity', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/apple-icon.png', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/enrol', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/icon.png', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/initiatives', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/knowledge', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/knowledge/ask', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/knowledge/log', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/login', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/people', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/plugins', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/runs', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/settings', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/signed-out', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
    { path: '/teams', reason: 'prerendered; listed because route-policy cannot read a build without cacheComponents.' },
  ],
  // One per state worth seeing, taken from the fake gateway's own records (scripts/fake-gateway): a team with
  // work and one with none, an initiative waiting on a person, a closed one, one closed with a correction awaiting
  // approval, one with no flow, a document approved, one awaiting approval, a correction the signed-in user may approve
  // and one in another of their teams (which tells them to switch), a document that moves after every read (out of
  // date), one whose record of being shown is refused (Approve unavailable), a current and a superseded knowledge
  // node, a plugin with an evaluation, one never profiled, one vendored and never run, and a skill in each of its
  // views.
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
    '/initiatives/atlas/2026-10-04-index-rebuild/spec.md',
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
  // The Approve banner a load cannot reach — a document that changed while it was being read needs a refetch — and a
  // check that the refused record's banner is what its detail route draws.
  browserChecks: ['scripts/approve-banners.ts'],
};

export default config;

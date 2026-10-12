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
   * The product's own browser checks, beside Meridian's audit, presses and keyboard walk: scripts verify runs with
   * `--base <url>` against the built app, failing when one exits non-zero.
   */
  browserChecks?: string[];
};

const config: VerifyConfig = {
  /**
   * Measured on 2026-10-12, served against the fake gateway: the list pages are the console's heaviest uncompressed
   * HTML, `/initiatives` at 90 KiB and `/people` at 88, against 61 on `/` and 75 on `/settings`. The caps hold roughly
   * a fifth above what they measure, which is room for a column and not for a second table.
   *
   * They were 65 and 63 the day before, and the 25 KiB between is one thing: the layout now asks, on each request,
   * whether the console has an assistant (`connection()` in `app/(dash)/layout.tsx`, as Meridian's guide writes it), so
   * every page has a request-time part and Next sends the page's flight payload a second time beside the prerendered
   * one. It is the same text twice, so it compresses away: `/initiatives` is 11,229 bytes gzipped without it and 11,966
   * with it. The cap measures uncompressed bytes, which is why it moved and the page a person downloads barely did.
   */
  budgets: { htmlKb: { '/initiatives': 108, '/people': 108 } },
  /**
   * One for every route in the rail, which is what `--full` and `--perf` require. Each selector was read off the built
   * app served against the fake gateway on 2026-10-11, not guessed: `/` draws 26 table rows and one
   * `aria-haspopup="dialog"` control, `/teams` 4 rows beside a search field, `/initiatives` 11, `/knowledge` 10,
   * `/people` 7, `/plugins` 4 with no search field, `/runs` 16, `/activity` 20, `/settings` 13.
   *
   * The probe is the one that changes something unambiguous. On `/teams` and `/initiatives` a search field filters the
   * rows it is beside; on `/` there is no search field, and its radios are two segmented groups whose checked item
   * simply moves, so the dialog is the change this can read.
   */
  navigationChecks: [
    { path: '/', title: 'Overview', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
    { path: '/teams', title: 'Teams', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/initiatives', title: 'Initiatives', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/knowledge', title: 'Knowledge', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/people', title: 'People', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    // No search field on these four, so the dialog is the change the check can read. Every one of them draws a table,
    // so `main table tbody tr` is what says the data arrived.
    { path: '/plugins', title: 'Plugins', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
    { path: '/runs', title: 'Runs', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
    { path: '/activity', title: 'Activity', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
    { path: '/settings', title: 'Settings', readySelector: 'main table tbody tr', probe: 'dialog', controlSelector: 'main button[aria-haspopup="dialog"]', resultSelector: '[role="dialog"]' },
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
  // `selection-check` is the one Meridian's presses suite cannot make: it asks whether a press changed SOMETHING,
  // which the address alone satisfies, and this asks whether the control shows the thing that was pressed.
  // `hydration-check` makes a race occur that the audit can only catch when it happens to: it slows the main thread
  // until every read a page shares with the shell has answered before the page hydrates, and fails on React's error.
  browserChecks: ['scripts/approve-banners.ts', 'scripts/live-check.ts', 'scripts/selection-check.ts', 'scripts/hydration-check.ts'],
};

export default config;

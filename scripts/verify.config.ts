/**
 * What `pnpm verify` needs to know about this project that it cannot discover from `app/`. Edit it; verify reads it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { refusal } from '../src/app.config.ts';
import { PLATFORM_STATUS } from './fake-gateway/platform-status.ts';
import { documentDetail, initiativeDetail } from './fake-gateway/work.ts';

/** The figure `/platform` draws from the fake gateway's last whole week, as the page writes it: one decimal place. */
const STATUS_FIGURE = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.last!.figure.value!.toFixed(1);

/**
 * Another team's initiative and one of its documents, which both people are refused: Work's detail routes are the active
 * team's, the superadmin's too (reconciliations 31 and 39), and both act for atlas. Each probe is a name the record
 * itself carries, read off the fake gateway's fixture: the person who approved its documents, and the document's
 * stakeholder, neither of whom is in atlas.
 */
const OTHER_TEAMS = {
  '/initiatives/beacon/2026-09-22-payout-schedule': initiativeDetail('beacon', '2026-09-22-payout-schedule')!.documents.find((d) => d.approved_by)!.approved_by!,
  '/initiatives/beacon/2026-09-22-payout-schedule/review.md': documentDetail('beacon', '2026-09-22-payout-schedule', 'review.md')!.stakeholder!,
};

type DeviceBudget = { desktop: number; phone: number };
type ReadinessBudget = { shellMs: DeviceBudget; dataMs: DeviceBudget; interactiveMs: DeviceBudget };
/** What "this route is ready" means, and one harmless control to press on it. */
type NavigationCheck = {
  /** The rail route this describes. */
  path: string;
  /** Text the page's heading shows as soon as the shell has arrived. */
  title: string;
  /** The element that appears only when the page's data has, and (optionally) the text it must hold. */
  readySelector: string;
  readyText?: string;
  /** What pressing the control does: open a dialog, filter or sort the data, flip a toggle, or follow a link. */
  probe: 'dialog' | 'filter' | 'sort' | 'toggle' | 'link';
  /** A control that opens, sorts, filters, toggles or follows and never writes. Name it by role or aria, not by class. */
  controlSelector: string;
  /** What changes when the control works: the probe reads the whole text of each element it matches. */
  resultSelector: string;
  /**
   * Where this route's own reading is over the shared budget: its own figure for that metric and that device, with the
   * measurement that earned it beside it. Nothing it does not name moves, and leaving it out holds the route to
   * `budgets.navigation` like every other.
   */
  budget?: Partial<{ [K in keyof ReadinessBudget]: Partial<DeviceBudget> }>;
};

/** One way `pnpm verify --as` signs the browser in: the cookie that names the person, and what that person is expected to see. */
type Persona = {
  /** The cookie every browser suite carries, set before the first request; its value names one of the fake gateway's people. */
  cookie: { name: string; value: string };
  /** The rail routes this person may open, written by hand and never derived from the rail or the policy under test. */
  expectedRoutes: readonly string[];
  /** For each route this person may NOT open: one protected string that must not appear on the refused answer. */
  deniedProbe?: Record<string, string>;
};

/** Every field of this file that `scripts/verify.ts` reads, as ZZ Meridian 0.18.0's own configuration declares them. */
export type VerifyConfig = {
  /**
   * Detail pages checked beside every static route, one per state worth seeing (a normal record, a failed one, a missing
   * one). `pnpm verify --full` checks them with every static route.
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
   * In a project that adopted Meridian, verify refuses to run until it knows its presses cannot reach a live backend:
   * name a `fakeApi`, or set this to true when the pages read and write nothing outside this repository. Never set it to
   * make verify run against an API.
   */
  noLiveApi?: true;
  /**
   * Environment variables naming a data store, besides `DATABASE_URL`, which verify always reads. verify refuses to
   * start when one of them resolves to a host that is not this machine.
   */
  dataUrls?: string[];
  /** Run verify against a remote data URL anyway. Set it only when you know what the presses reach. */
  allowRemoteData?: true;
  /**
   * Limits verify enforces. Leave a key out for Meridian's default: first-load JS 820 KiB per route and 5% growth over
   * `scripts/verify.baseline.json`, the warm, cold and after-live navigation times, a desktop prefetch of 80 KiB from the
   * landing page and none on a closed phone drawer. `htmlKb` caps a page's HTML, the whole streamed
   * response gzipped, in KiB; it has no default, and every page is held to its own baseline without it.
   * `firstLoadKb` and `firstLoadGrowthPct` are declared together because overriding the cap without knowing the ratchet
   * beside it is how a cap stops meaning anything.
   */
  budgets?: {
    navigation?: { warm?: ReadinessBudget; cold?: ReadinessBudget; afterLive?: ReadinessBudget };
    firstLoadKb?: number;
    firstLoadGrowthPct?: number;
    htmlKb?: Record<string, number>;
    prefetchKb?: { desktop: number; phoneClosed: number };
  };
  /**
   * One check for every route in the rail. `--full`, `--timed` and `--perf` fail on a rail route that has none; the
   * default smoke reports its data and interaction as not configured. Probes never write.
   */
  navigationChecks?: NavigationCheck[];
  /**
   * The product's own browser checks, beside Meridian's audit, presses and keyboard walk: scripts verify runs with
   * `--base <url>` against the built app, failing when one exits non-zero. They run under `--full`, beside one another,
   * so none of them judges a time.
   */
  browserChecks?: string[];
  /**
   * The product's own browser checks that judge a time, run by `pnpm verify --timed` alone and one at a time, after the
   * live data and before Web Vitals, each with `--base <url>` like `browserChecks`. A check that judges a time under the
   * load of `--full` judges the load; move it here, and keep in `browserChecks` the half that judges no time.
   */
  timedChecks?: string[];
  /**
   * Questions the fake model answers with a call to one of the product's own tools, so a journey can check what the
   * assistant cites. `when` is a case-insensitive regular expression's source, matched against the user's message before
   * the fake model's own branches; the model then calls `tool` with `input` when the request hands that tool, and answers
   * with the tool's result. verify hands the steps to the fake model on its command line.
   */
  fakeModel?: { when: string; tool: string; input: Record<string, unknown> }[];
  /**
   * Routes that cannot be prerendered, each with the reason. `node scripts/route-policy.ts`, which verify runs after its
   * production build, fails any non-API route that is neither static nor partial unless it is named here.
   */
  requestDependentRoutes?: { path: string; reason: string }[];
  /** The up to three rail routes the default smoke visits. Without it: the landing route and the next two rail routes. */
  smokeRoutes?: string[];
  /**
   * The people `pnpm verify --as <persona>` can sign the browser in as, by name. Each carries the cookie a suite sets
   * before its first request, the routes that person is expected to see (written by hand), and, for the routes that
   * person may not open, one protected string that must not appear on the page.
   */
  personas?: Record<string, Persona>;
  /**
   * What a route a persona may not open is expected to draw: the product's `refusal`, read from src/app.config.ts where it
   * is declared, never written here. `explain` expects the no-access page (`[data-no-access]`), `absent` the missing page
   * (`[data-missing-page]`) and no no-access page; the `deniedProbe` strings must be absent under both.
   */
  refusal?: 'explain' | 'absent';
};

/** The Work guide's task 4 phrase, from an old plan, as tests/fixtures/guide-tasks.json keeps it. */
const WORK_4_PHRASE = (JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'tests', 'fixtures', 'guide-tasks.json'), 'utf8')) as { tasks: { id: string; phrase?: string }[] })
  .tasks.find((t) => t.id === 'work-4')!.phrase!;

/** A table's rows: the record's own list. */
const TABLE = 'main table tbody tr';
/** A document's text: the renderer's blocks, or the same words as plain text while the renderer's chunk is on its way (src/console/reading.tsx). */
const BODY = 'main div.text-ink-2.break-words > *, main [data-split="2/3"] > .card:first-child pre';
/** A skill's cost record: its figures. */
const FIGURES = 'main .t-figure';
/** A skill the active team never ran: the page's sentence saying so is its record, since the figures are the team's. */
const NEVER_RUN = 'main [data-never-run]';

/**
 * What counts as each detail route's primary data, read off the built app served against the fake gateway on
 * 2026-10-14: what scripts/primary-data.ts times and scripts/states-check.ts reads as the page's content. COUPLED:
 * `detailRoutes` below; an address there with no entry here fails both.
 */
export const DETAIL: Record<string, string> = {
  '/platform/releases/0.97.0': BODY,
  '/platform/releases/0.95.0': BODY,
  '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01': 'main [data-report-detail]',
  '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d02': 'main [data-report-detail]',
  '/platform/teams/atlas': TABLE,
  // No initiative yet, which the page says; its members are the table.
  '/platform/teams/dune': TABLE,
  '/initiatives/atlas/2026-09-28-search-relevance': TABLE,
  '/initiatives/atlas/2026-08-02-ingest-pipeline': TABLE,
  '/initiatives/atlas/2026-09-12-onboarding-revamp': TABLE,
  '/initiatives/atlas/2026-09-05-research-notes': TABLE,
  '/initiatives/atlas/2026-09-28-search-relevance/spec.md': BODY,
  '/initiatives/atlas/2026-09-28-search-relevance/plan.md': BODY,
  '/initiatives/atlas/2026-09-12-onboarding-revamp/review.md': BODY,
  // Another team's, which both people are refused (`deniedProbe`): what it would draw if it opened.
  '/initiatives/beacon/2026-09-22-payout-schedule': TABLE,
  '/initiatives/beacon/2026-09-22-payout-schedule/review.md': BODY,
  '/initiatives/atlas/2026-10-02-query-latency/spec.md': BODY,
  '/initiatives/atlas/2026-10-04-index-rebuild/spec.md': BODY,
  '/knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md': BODY,
  '/knowledge/atlas/nodes/0004-rank-by-recency-first.md': BODY,
  '/plugins/sdlc': TABLE,
  '/plugins/zz-access': TABLE,
  '/plugins/research-kit': TABLE,
  '/plugins/sdlc/sdlc-spec': FIGURES,
  '/plugins/sdlc/sdlc-spec?view=read': BODY,
  '/plugins/sdlc/sdlc-spec?view=references': TABLE,
  '/plugins/research-kit/research-scan': NEVER_RUN,
};

/** How far a route's first-load JS may grow over its own baseline before verify fails it: Meridian's default, said. */
const FIRST_LOAD_GROWTH_PCT = 5;
/** The one absolute first-load cap Meridian's check requires, in KiB: the baseline's largest page plus
 *  `FIRST_LOAD_GROWTH_PCT`, rounded up, so no route is held to anything tighter than its own allowance. */
const FIRST_LOAD_CAP_KIB = (() => {
  const { routes } = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'verify.baseline.json'), 'utf8')) as { routes: Record<string, number> };
  return Math.ceil((Math.max(...Object.values(routes)) * (1 + FIRST_LOAD_GROWTH_PCT / 100)) / 1024);
})();

const config: VerifyConfig = {
  /**
   * Every page's HTML is held to its own gzipped figure in `scripts/verify.baseline.json`, as first-load JS is (ZZ Meridian
   * 0.19.0, its issue #57): the owner's decision of 2026-10-19 that a hand-written cap per page is the wrong ruler, since
   * every page is different. No `htmlKb` is set. A growth that is accepted is recorded with
   * `node scripts/sizes.ts --write-baseline --base <the running build>`, never by writing a number here. What the
   * uncompressed bytes were made of on 2026-10-19 (Task I-146) is in the plan's Phase 7 as built.
   */
  budgets: {
    /**
     * Every route's first-load JS is held to its own baseline, `FIRST_LOAD_GROWTH_PCT` over it, as its HTML is: the
     * owner's rule that a size cap is a page's own measured figure, never a hand-written number. ZZ Meridian's check
     * (the managed `firstLoadProblems` in scripts/lib/sizes.ts) also holds every route to one absolute cap, its default
     * 820 KiB, and offers no way to leave it out, so the cap is derived, not written: the baseline's largest page plus
     * the same 5%, rounded up to a whole KiB. It moves when the baseline is rewritten, and it binds only a page the
     * baseline does not hold. The hand-written 850 it replaces failed `/record` at 852 KiB on 2026-10-20 while `/record`
     * stood within its own 5% (verify #4345).
     */
    firstLoadKb: FIRST_LOAD_CAP_KIB,
    firstLoadGrowthPct: FIRST_LOAD_GROWTH_PCT,
  },
  /**
   * One for every route of both rails, in the rails' order (the destinations table's), which is what `--full` and
   * `--perf` require and the order scripts/primary-data.ts measures them in. Each page reads its primary data on the
   * console's server (reconciliation 65), and its selector is the one its page task read off the built app served
   * against the fake gateway: Home's paired figures, Record's lead figure, a list's own table, a page of figures its
   * tiles once their read answered (`data-figures="read"`), Access's tokens.
   *
   * The probe is the one that changes something unambiguous. A search field filters the rows it is beside (Initiatives,
   * Teams, People); where there is none, or a search runs on submit, a tile's info button opens the tooltip that says
   * what the tile counts. Knowledge's log, `/knowledge/log`, is a tab of Knowledge and on no rail, so it has no entry
   * here.
   */
  navigationChecks: [
    // Home's primary data is its paired figures; the one control the check presses is a tile's info button, whose
    // tooltip says what the tile counts.
    { path: '/', title: 'Home', readySelector: 'main [data-figures] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    // Record leads with one figure, the retained text's estimate, in its Featured metric.
    { path: '/record', title: 'Record', readySelector: 'main [data-figure] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    // Initiatives draws a second table in `main`, its chart's data for a screen reader, so both selectors name the list.
    { path: '/initiatives', title: 'Initiatives', readySelector: 'main [data-protagonist="Initiatives"] table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main [data-protagonist="Initiatives"] table tbody tr' },
    { path: '/approvals', title: 'Approvals', readySelector: 'main [data-protagonist="Approvals"] table tbody tr', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    // Knowledge's search runs on submit, so typing changes nothing; its data is the tiles.
    { path: '/knowledge', title: 'Knowledge', readySelector: 'main [data-figures="read"] .t-figure', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    // Activity's and Runs' primary data is their three tiles.
    { path: '/activity', title: 'Activity', readySelector: 'main [data-figures="read"] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/runs', title: 'Runs', readySelector: 'main [data-figures="read"] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/plugins', title: 'Plugins', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    // Access's primary data is its tokens; the probe is a live token's Revoke, whose first press only asks in place, so
    // it writes nothing. The press is read in the token's row, where the confirm appears in its last cell: the probe
    // reads the whole text of each row it matches (ZZ Meridian 0.18.0, issue #52).
    { path: '/access', title: 'Access', readySelector: 'main [data-protagonist="Tokens"] table tbody tr', probe: 'toggle', controlSelector: 'main [data-protagonist="Tokens"] tbody tr button', resultSelector: 'main [data-protagonist="Tokens"] tbody tr' },
    // Status leads with what needs attention and the paired figures: its data is the Featured metric's first figure, the
    // last whole week's malformed calls per 1,000 (`.t-figure` is the team's tiles now). The one control is a team
    // tile's info button, whose tooltip says what the figure counts. Read off the source on 2026-10-17.
    { path: '/platform', title: 'Status', readySelector: 'main [data-figures] [data-value]', readyText: STATUS_FIGURE, probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/platform/releases', title: 'Releases', readySelector: 'main [data-protagonist="Releases"] table tbody tr', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/platform/bugs', title: 'Bugs', readySelector: 'main table tbody tr', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/platform/evaluation', title: 'Evaluation', readySelector: 'main [data-figures="read"] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    { path: '/platform/teams', title: 'Teams', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/platform/people', title: 'People', readySelector: 'main table tbody tr', probe: 'filter', controlSelector: 'main input[type="search"]', resultSelector: 'main table tbody tr' },
    { path: '/platform/usage', title: 'Usage', readySelector: 'main [data-figures="read"] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
    // Audit's toggle crosses a server re-read: an unselected tab of the feed reads the events table.
    { path: '/platform/audit', title: 'Audit', readySelector: 'main [data-feed="read"] ol > li', probe: 'toggle', controlSelector: 'main [role="tab"][aria-selected="false"]', resultSelector: 'main [data-events="read"] table tbody tr' },
    { path: '/platform/knowledge', title: 'Knowledge health', readySelector: 'main [data-figures="read"] [data-value]', probe: 'toggle', controlSelector: 'main button[aria-label^="About "]', resultSelector: '[role="tooltip"]' },
  ],

  // One per state worth seeing, taken from the fake gateway's own records (scripts/fake-gateway): a team with
  // work and one with none, an initiative waiting on a person, a closed one, one closed with a correction awaiting
  // approval, one with no flow, a document approved, one awaiting approval, a correction the signed-in user may approve,
  // a document that moves after every read (out of date), one whose record of being shown is refused (Approve
  // unavailable), a current and a superseded knowledge node, a plugin with an evaluation, one never profiled, one
  // vendored and never run, and a skill in each of its views. Work's are atlas's, the team both people act for; another
  // team's initiative and document are walked as the not-found both are answered (`OTHER_TEAMS`, in each persona's
  // `deniedProbe`).
  detailRoutes: [
    '/platform/releases/0.97.0',
    '/platform/releases/0.95.0',
    // An open report, which draws the resolve form, and a closed duplicate, the one report that links its original.
    '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01',
    '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d02',
    '/platform/teams/atlas',
    '/platform/teams/dune',
    '/initiatives/atlas/2026-09-28-search-relevance',
    '/initiatives/atlas/2026-08-02-ingest-pipeline',
    '/initiatives/atlas/2026-09-12-onboarding-revamp',
    '/initiatives/atlas/2026-09-05-research-notes',
    '/initiatives/atlas/2026-09-28-search-relevance/spec.md',
    '/initiatives/atlas/2026-09-28-search-relevance/plan.md',
    '/initiatives/atlas/2026-09-12-onboarding-revamp/review.md',
    '/initiatives/atlas/2026-10-02-query-latency/spec.md',
    '/initiatives/atlas/2026-10-04-index-rebuild/spec.md',
    ...Object.keys(OTHER_TEAMS),
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
  // `workspace-switch` walks the workspace menu as each persona: Work to Platform, the figure, and back.
  // `states-check` draws every rail and detail route as each persona in each of the spec's five states and in `extreme`,
  // a busy platform past every ceiling, where no table draws more than ten rows a page or ten with no total. Each state
  // is asked for per request by the session value, so the suites beside it read the normal state throughout
  // (reconciliation 79). In `slow` it judges that an explicit state is reached, never when: the bound is states-timed's.
  // `journeys` carries out the guides' eighteen tasks to try as the person each names, in journey sessions whose writes
  // the fake gateway keeps for that session alone, so the suites beside it read the same data throughout
  // (reconciliation 80). Work's task 4 asks the assistant, which `fakeModel` below answers.
  // None of them judges a time: they run beside the audit, the presses and the keyboard walk, under their load.
  browserChecks: ['scripts/approve-banners.ts', 'scripts/live-check.ts', 'scripts/selection-check.ts', 'scripts/hydration-check.ts', 'scripts/workspace-switch.ts', 'scripts/states-check.ts', 'scripts/journeys.ts'],
  // The checks that judge a time, which `pnpm verify --timed` runs alone and one at a time. Wave 2's acceptance showed
  // why: beside the other suites two `slow` rows reached their state at 5.1 to 5.8 s (Harbormaster #3482), and alone
  // all 88 within 4.53 s (#3486).
  // `primary-data` times each route's own data beside its largest paint, as each persona, on the timed suites' phone,
  // against the 1.0 s budget, and holds a delayed read to a state bounded at five seconds.
  // `states-timed` draws every rail and detail route as each persona in `slow` and fails a row whose explicit state
  // arrives after five seconds.
  timedChecks: ['scripts/primary-data.ts', 'scripts/states-timed.ts'],
  // Work's task 4, "Find a decision": the phrase from an old plan asked of the assistant on Knowledge, whose answer cites
  // the search's first result, which scripts/journeys.ts compares with the page's first hit. Anchored, so it answers the
  // phrase alone and none of the assistant walk-through's own questions. COUPLED: the search view's tool as the
  // assistant hands it, `view_<name>` of `searchTool` in src/views/tools/search.ts (tests/verify-tiers.test.ts).
  fakeModel: [{ when: `^${WORK_4_PHRASE.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')}$`, tool: 'view_search', input: { q: WORK_4_PHRASE } }],
  /**
   * The fake gateway's two people (scripts/fake-gateway/people.ts), each by the value of the `zz_console` cookie it
   * reads. A run without `--as` sends no cookie, and the fake gateway answers that as the superadmin.
   *
   * The routes are the rail each is shown, written out, across both workspaces in the rails' order: Work's nine, then
   * Platform's. The superadmin is shown all eighteen; the member, one person in one team, `atlas`, every Work
   * destination and Platform's six public ones, and is refused Teams, People and Audit, and a bug's own report. The name of a team they are not in is on Teams for a superadmin, and the name of a person in no
   * team of theirs on People; neither may reach the page a member is refused.
   */
  personas: {
    superadmin: {
      cookie: { name: 'zz_console', value: 'superadmin' },
      expectedRoutes: [
        '/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access',
        '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/teams', '/platform/people', '/platform/usage', '/platform/audit', '/platform/knowledge',
      ],
      deniedProbe: OTHER_TEAMS,
    },
    member: {
      cookie: { name: 'zz_console', value: 'member' },
      expectedRoutes: [
        '/', '/record', '/initiatives', '/approvals', '/knowledge', '/activity', '/runs', '/plugins', '/access',
        '/platform', '/platform/releases', '/platform/bugs', '/platform/evaluation', '/platform/usage', '/platform/knowledge',
      ],
      deniedProbe: { '/platform/teams': 'Beacon Payments', '/platform/people': 'Jonas Weber', '/platform/audit': 'archived team cinder', '/platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01': 'document_approve refuses a stakeholder the frontmatter names', ...OTHER_TEAMS },
    },
  },
  refusal,
};

export default config;

# Customising a Meridian project

The order that keeps a build calm: data, navigation, pages, extras, clean-up. Read the files named here before changing
them; each starts with a comment that explains its job. In an adopted project `@/` is the team's own alias, so the
presets' `@/components/…` and `@/lib/…` imports become `@meridian/components/…` and `@meridian/lib/…` when you copy them.

## Data: `optional:src/data/`

`optional:src/data/` is the product's own seam: pages and views import data from it and nowhere else. Write `src/data/<product>.ts`. The template's
sample, ZZ Meridian's own dashboard, lives in `optional:src/system/fixtures/`; your pages never import it, but
`optional:src/data/collections.ts` does, so it stays until each collection's `rows` come from your data (see "The assistant").

- **Types from the person's world.** Turn their schema, CSV headers or API into TypeScript types (`Order`, `Shipment`,
  `Invoice`). Name fields the way their team says them.
- **Deterministic sample data** until their API is wired: a seeded generator and a fixed clock (`DEMO_NOW`), never
  `Math.random()` or `new Date()` in render, or the server and the client disagree and React reports a hydration error
  (the audit fails on it). With a real API, "now" is read once on the server, where the data is read, and passed down;
  a client component never reads its own clock in render.
- **Daily series** for anything a Metric tile or chart shows over time: the Meridian cursor reads one value per day.
- **Freshness** from when data arrived (`DEMO_UPDATED_AT`), never from now.
- **null for "not measured"**: the formatters in `src/lib/format.ts` render it as a dash. A quantity Meridian has no
  formatter for (weight, distance) gets one in a file of the product's own (`example:src/data/format.ts`), passed as a
  tile's or table's `format`, never written inline; `src/lib/format.ts` is Meridian's, and an edit there becomes a
  merge at the next update. Money follows `app.currency`.
- **Helpers a server page calls** (summaries, derived sentences) go in `optional:src/data/` or `src/lib/`, never in a
  `'use client'` view file: a server component cannot call a function exported from a client module.
- **Read on the server when you can**: a server component that awaits its data sends a page with the numbers in it.
  If a page must fetch in the browser (a client hook against an existing API), its reads start only after the
  JavaScript has loaded and run, about 2.5 s on a mid-range phone, which puts LCP past the limit. Call
  `preload(url, { as: 'fetch', crossOrigin: 'anonymous' })` from `react-dom` inside the read hook: the server render
  writes a preload into the HTML, and the read starts with the page (ZZ Console measured about 170 ms instead).
  `pnpm verify --full` measures LCP on that phone profile (`scripts/vitals.ts`).
- **The access seam**: who may do what lives in `optional:src/data/`, and a page never answers it on its own. Three files
  hold the rules and one holds the member boundary.
  - `optional:src/data/roles.ts` is the role table. `MAIN_ROLES`, `ADD_ONS` and `GRANTS`; `effective(role, addOns)` unions a
    member's main role with their add-ons (no wildcard, no deny), `whoCan(need)` names the roles that satisfy a need alone,
    and `roleLabel(member)` is how a member reads ("Member + Key manager"). Edit the table, not a page: every sentence the
    NoAccess view writes is read off it.
  - `optional:src/data/features.ts` is one table of what each page needs (`FEATURES`) and what each control needs
    (`ACTIONS`), keyed by `FeatureId` and `ActionId`. A nav item, a page, a view tool and an action name their need here **by
    reference** (`needs: FEATURES.<id>.needs`); a need is never written twice, and a test fails a surface that restates one.
  - `optional:src/data/access.ts` is the policy. `current` says who the request is, `allows` says what the scope may do,
    `gate(feature)` is what a page opens with before it reads (`requireNeed(need)` is the view tool's), and `chromeAccess()`
    is what the rail draws. Replace the demo's `current` with your session and delete the demo's View as —
    `optional:src/data/view-as.ts` and its `zz_meridian_view_as` cookie — so nothing signs in as a sample person.
  - `optional:src/data/member-mutations.ts` is the member boundary. `membersFor(scope)` binds the collection so every create,
    update and remove passes it, and `assignMemberRole({ id, role, addOns })` is the one role change; the Owner, self and
    last-active-Owner rules hold for a page, the assistant and an MCP server alike. The demo runs one write at a time per
    workspace in a promise queue: put yours in a database transaction, so two concurrent changes cannot both pass on a stale
    count.

## Navigation: `src/app.config.ts`

`app` holds the name, workspace, accent, timezone, currency and the signed-in user the rail shows (all set by
`scripts/brand.ts`); `slug`, `domain` and `toolPrefix` derive from the name. `nav` is the rail and the command
palette: groups of `{ href, label, icon, needs }`, plus a `workspace` while the workspaces stay (icons from `lucide-react`, 1.75 stroke is applied by the rail). A badge
is a short string, used only for something that needs attention ("1").

`needs` is required, and in a created project it is a feature's own need **by reference** — `needs: FEATURES.overview.needs`,
from `optional:src/data/features.ts` — never a grant written a second time: the rail and the palette draw only the
destinations the signed-in person satisfies, and a test fails an item that restates a need. That filtering is
presentation, not the gate: every page refuses on its own (see "Data" above). An adopted project has no `features.ts`: `adopt` writes
`needs: 'public'` on every item. `'public'` is the need any signed-in, Active person satisfies (`satisfies` in
`optional:src/data/access.ts`), so the item is drawn for everyone who is signed in and no role decides it; it is right for a
destination every member may open, and an item moves to a feature of its own once the project has a role table.

A project made by `create` (or a clone) starts with the sample's three workspaces: `workspaces` in `src/app.config.ts` (Main,
Business, Engineering), a `workspace` on every `nav` entry, and a layout that draws `WorkspaceRail` and `WorkspacePalette`.
`navOf` keeps only the entries whose `workspace` matches, so an entry added without one is drawn by no rail and no palette.
`adopt` writes no `workspaces`. Decide before adding pages, by what the person asked for: when they asked for several
places to look (by audience, by team, by job), keep the workspaces; when they did not say, take them out, since one
navigation is what a product has until somebody asks for more.

**Keep the workspaces** when the destinations fall into a few places to look. Each has a `label`, an `audience` sentence
and a `homeHref`; give every `nav` entry a `workspace` naming one. Rewrite each `audience` sentence (the Overview,
Operations and Analytics pages print `workspaces.<id>.audience` in their description) and move the homes to your own pages. Keep `optional:src/views/workspaces.ts` (`navOf` derives a workspace's
navigation, `workspaceOf` says which workspace an address belongs to) and `optional:src/views/workspace-chrome.tsx`
(`WorkspaceRail` and `WorkspacePalette`). The address alone decides the workspace; nothing is stored, and a workspace
chooses what the rail lists, never what a person may open. Keep a workspace with the key `main`: the adapter and the
refusal page fall back to it for an address no entry owns. The sample's browser journeys (`optional:journeys/workspaces.ts`)
also name `business` and `engineering`, so `verify --full` fails on a renamed workspace until the journeys are changed
with it or removed. `optional:docs/product-workspaces.md` is the sample's own guide
to all of this.

**Take them out** when the product has one navigation. In `src/app.config.ts` delete `workspaces`, `WorkspaceId` and the
`workspace` field of `NavItem` and of every entry. Then, so the gate stays green:

- In `optional:app/(dashboard)/layout.tsx` draw `ConsoleRail` and `ConsolePalette` from `src/views/console-chrome.tsx` in
  place of `WorkspaceRail` and `WorkspacePalette`, with the same `access`.
- Delete `optional:src/views/workspace-chrome.tsx`, `optional:src/views/workspaces.ts` and `optional:journeys/workspaces.ts`
  (its entry in `browserChecks` in `scripts/verify.config.ts` goes with it).
- In `optional:src/views/no-access.tsx` the refusal page's way out reads `navOf` and `workspaces.main`: make it the first
  destination of `nav` the person may open, or `/`, and rewrite the two cases of `optional:tests/no-access.test.tsx` that
  expect a workspace's first destination and Main's home.
- Take `${workspaces.<id>.audience}` out of the descriptions of the Overview, Operations and Analytics pages, or delete
  the pages.
- Delete `optional:tests/workspaces.test.ts`, `optional:tests/workspace-access.test.ts` and
  `optional:tests/workspace-chrome.test.tsx`. In `optional:tests/shell-alerts.test.ts` drop the `workspaceOf` check, and in
  `optional:tests/workspace-overview.test.tsx` the test that reads `workspaces.main.audience`, with the two imports only
  it uses.
- A clone that keeps the Atlas also changes `optional:src/system/atlas-shell.tsx`, which lists the workspaces; a created project
  has no Atlas.

`grep -rn "workspaces\.\|WorkspaceId\|views/workspaces\|workspace-chrome" app src tests journeys` finds what is left.

## Pages: presets to start from

| They need | Copy and adapt | Its protagonist |
|---|---|---|
| A summary with one leading figure | `optional:app/(dashboard)/(overview)/page.tsx` + `optional:src/views/overview.tsx` | Featured metric with its trend |
| A list of records with filters | `optional:app/(dashboard)/requests/` + `optional:src/views/requests.tsx` | Data table with filter bar |
| Summary tiles over a list people only read (what ran, what is going out) | `optional:app/(dashboard)/tests/`, `optional:app/(dashboard)/releases/` + `optional:src/views/tests.tsx`, `optional:src/views/releases.tsx` | Data table under three tiles |
| One record | `optional:app/(dashboard)/requests/[id]/` + `optional:src/views/request.tsx` | Detail head and key facts |
| Four figures for a period, then breakdowns and patterns over time | `optional:app/(dashboard)/analytics/` + `optional:src/views/analytics.tsx` | The four figures, then the heatmap |
| Systems and incidents (Operations, at `/health`) | `optional:app/(dashboard)/health/` + `optional:src/views/health.tsx` | Status summary |
| Customers, accounts, people | `optional:app/(dashboard)/customers/` + `optional:src/views/customers.tsx` | Data table, a usage sparkline in each row |
| Keys, tokens, secrets | `optional:app/(dashboard)/keys/` + `optional:src/views/keys.tsx` | Table with masked values |
| Records people add, edit and remove (also what the assistant reads) | `optional:app/(dashboard)/members/`, `optional:app/(dashboard)/keys/` + `optional:src/views/members.tsx`, `optional:src/views/keys.tsx` | Data table over a collection |
| Work people create and move along, through a write boundary | `optional:app/(dashboard)/operations-tickets/` + `optional:src/views/tickets.tsx` and `optional:src/data/ticket-mutations.ts` | Data table with New ticket and a row menu |
| Settings (a sample: keep only if asked; its Assistant section holds the assistant's switch) | `optional:app/(dashboard)/settings/` + `optional:src/views/settings.tsx` | Form sections |
| Sign in, not found | `optional:app/sign-in/` (`page.tsx` + `panel.tsx`), `optional:app/not-found.tsx` + `optional:src/views/standalone.tsx` | One sentence at display size |

The Operations preset assumes software services. For other things that are up or not (warehouses, branches, sites), pass
`StatusList` a `noun`, a `measure` ("on time") and a `metric`, and `UptimeBars` a `measure`. A Metric tile says what
its change compares with in `compare` ("vs the 3 days before") and takes a `note` where no comparison fits.

A copied sample page does not do what a product would assume of it. Its writes are held in memory: a ticket, a member or a
key lives in the running server and is lost when it restarts, until your own database stands behind the collection. Its
figures that are fixed (Analytics' weekday-and-hour grid, hours and regions, the endpoints, the Overview's response split)
are not worked out from the request log and do not follow the period chosen. Nothing runs a suite or ships a version
behind Tests and verification and Releases, no message is sent, and the bell only lists what needs a person when the page
is read. `optional:docs/product-workspaces.md` lists each limit.

Rules that make every page look like it belongs:

- **`PageFrame`** with `kicker` (where it sits: "Product · Workspace" or the parent record), `title`, one-sentence
  `description`, then `meta` (Freshness) and `actions` (one primary at most). A dashboard page leaves `width` alone:
  `data` fills the canvas, so a wider screen shows more. A page that is mostly a form takes `width="form"`, whose band
  fills the canvas until the canvas is wider than a form needs and then centres — a field never stretches across a wide
  screen, and the remainder splits evenly instead of leaving a strip at one side. A page that is one long document takes
  `width="reading"`. A `loading.tsx` passes the same `width` its page does, or the skeleton moves the page when it arrives.
- **`Stack` of `Row`s.** Splits are `full`, `1/2`, `2/3`, `1/3` and `tiles`. Cards in a row are the same height; one card
  per cell (a column of tiles is fine in a 1/3 cell).
- **One protagonist.** At most one `FeaturedMetric` per page; everything else is a `MetricTile` or a `Card`.
- **Charts on one page share one `Meridian`** (wrap the rows in `<Meridian dates={...}>`), so pointing at a day reads it
  everywhere. Two measures of a different size are two charts, never one chart with two axes.
- **A list of records** is the records template: `Records` from `src/components/templates/records` puts optional summary
  tiles (`summary`) over the Data table and its Filter bar, and keeps no state and reads no data. Its loading twin,
  `RecordsSkeleton` (`tiles`, `rows`, `filters`), goes inside the page's `LoadingPage`, so the page and its skeleton are
  spaced the same way.
- **Tables**: mark one column `grow` (the lead), numbers `numeric`, low-value columns `hideBelow`; give `rowHref` so rows
  open their record. A `DataTable` under 640px wide (a phone, or a half-width row on a wide screen) becomes a card list by itself — a markdown table inside `Prose` does not: it keeps its columns and scrolls sideways, so a document meant to be read on a phone wants a list, not a table.
- **Every state**: loading (`loading.tsx` is a `LoadingPage` from `src/components/patterns/page-loading`, with `name`,
  `title` and the page's `width`, around skeletons shaped like the page: `TilesSkeleton`, `ChartSkeleton`,
  `TableSkeleton` or `RecordsSkeleton`; read through `read()` so the page is
  in its prerendered shell and the skeleton is rarely seen, since a request-time read waits at least 300 ms behind it:
  `cache.md`), empty (Empty state with the one action), error (`error.tsx`, what failed and Retry).
- **A file picker** is a visible `Button` that calls `input.click()` on an `<input type="file">` with `tabIndex={-1}`
  and `aria-hidden`, so the keyboard reaches the button and never the hidden input; give the press a state of its own
  ("Choosing the files…") until the change event arrives. The presses count a file chooser that opens as an answer.
- **A page spec** next to each route (`README.md`: summary, Structure, States, Surfaces, Agents), so the next person, or
  agent, knows what the page is for. `node scripts/check.ts` requires Structure and States, and under `## Agents` a
  `### What the agent reads` part for every page in `optional:app/(dashboard)/` and `optional:app/embed/`. A created project
  carries none of the template's to copy, so start from this shape:

  ```md
  # Late pickups

  The orders still waiting after their pickup time, longest wait first, so a shop calls the right customer next.

  ## Structure
  PageFrame (kicker, title, one sentence, Freshness), then the late list as the protagonist, one row per order.

  ## States
  Loading: a skeleton shaped like the list. Empty: "No late pickups" with the time it was checked. Error: what did not
  load, and Retry. Long names truncate with the full name in a tooltip.

  ## Surfaces
  Console; at 390px the list is a card list.

  ## Agents
  ### What the agent reads
  The shared context: the period, how many are late, the longest wait, and the five longest with their shops.
  ```
- **A form reports unsaved changes** so the shell can ask before a person leaves: a `FormSection` does it from its `dirty`
  prop, and any other component calls `useUnsavedChanges(dirty)` from `src/components/base/shell`. Code that navigates
  on its own (a button, a menu, a palette command) goes through `useLeave()`, which runs the move at once when nothing
  is unsaved and otherwise only if the person chooses to leave. A link needs nothing, and Back and Forward are the
  browser's.
- **A shared context** for each page (decision 0011): a pure function beside the view builds it from the page's data
  (copy `optional:src/views/overview-context.ts`: scope, freshness, each figure with its unit, change and definition,
  what `optional:src/lib/insight.ts` finds, what the data cannot say), within 2,600 characters, lists cut at 25 with a
  count of the rest (`listed`), and the view passes it to `useShareView`; a
  server page with no client view places `<ShareContext context={…} />` among its cards instead. Both
  agents read it: an MCP host and the console's assistant. Add the page's tool to `optional:src/views/tools.ts` so the
  assistant can open it at an address.

## The assistant

The dashboard carries an assistant panel (`src/components/patterns/assistant/`, mounted by `AppShell`). It is off until
the variables are set, read per request, so no rebuild is needed: `ASSISTANT_PROVIDER` (`anthropic` or
`openai-compatible`), `ASSISTANT_API_KEY` and `ASSISTANT_MODEL` are required, and `ASSISTANT_BASE_URL` is required for
`openai-compatible`. `example:docs/assistant.md` in the template has the full guide.

The layout hands the shell whether it is on as a promise it does not await, `assistant={connection().then(() => assistantConfig(process.env) !== null)}`, so the request never blocks the frame; `AppShell` resolves it behind its own boundaries, and `useAssistantAvailable()` returns the same promise.

- **Collections** live in `optional:src/data/collections.ts`: one `arrayCollection` per kind of record, with `rows`, the `fields`
  schema, `allow` (which of create, update and remove the assistant may propose) and `hidden` fields. Replace each
  `rows` with the person's API and `clock` with `new Date()`; the assistant reads and proposes changes only through them.
  A new collection is read by nobody until the policy binds it and a role is granted it. In the sample's policy that is
  three places: its entry in `DEMO_COLLECTIONS` in `optional:src/data/access.ts`, `<name>:read` for the roles that may read
  it in `GRANTS` in `optional:src/data/roles.ts`, and, for a page, a feature with that need in `optional:src/data/features.ts`.
  Without the first, `read()` refuses everybody and the assistant is given no tool for it. A product's own policy binds
  the collection in `policy.bind` and decides the grant in `policy.allows`.
  **When `rows` becomes a real database, read through `read()`** (`optional:src/data/read.ts`): a page asks for the same
  records from several places (the layout's alerts read, a page strip, the page and its freshness stamp), and `read()`
  caches per caller's scope and refreshes exactly the tenant a write touched, so do not wrap the read in a second cache;
  writes call `updateTag` after the commit (`cache.md`). Raise the pool's idle timeout too: `pg` drops an idle connection after 10s, and a remote Postgres with TLS
  costs hundreds of milliseconds to reconnect. Issue #7 has the numbers. A pool that keeps connections idle must also
  listen for their loss: `pool.on('error', (e) => console.error('db: an idle connection closed', e))`. Without it, the
  database or its pooler closing an idle connection is an uncaught `error` event and the server exits (issue #16); the
  pool has already dropped the broken client, so logging is enough. Set `connectionTimeoutMillis` too, so a database
  that does not answer fails a read instead of hanging it.
- **Sign-in check** goes in three places, the same check: `optional:app/(dashboard)/layout.tsx`, `optional:app/api/assistant/route.ts` and every server action (each `actions.ts`), because a server action is a public endpoint the layout does not guard
  (before the model is reached).
- **The switch** ("Show the assistant") is in `optional:src/views/settings.tsx`. A product that deletes Settings moves it, or the
  person can no longer hide the panel.

## Brand beyond the accent

To change the brand of an adopted or created project, run `npx zz-meridian@<installed version> brand [brand flags]` (the
flags are the ones `adopt` takes, for example `--hex '#2E6BE4'` or `--name "Acme Ops"`). It rewrites the brand outputs
under `tokens/` and `src/styles/` and `src/app.config.ts`, and records the new brand and the new baseline hashes in
`optional:.meridian/manifest.json` together, so a later `update` replays the brand you chose. It needs a clean git tree, and it
changes nothing and says why when an update is in progress, the version differs from the manifest's, a brand output was
edited by hand, or `src/app.config.ts` is not in the shape `scripts/brand.ts` reads. The product's own `pnpm brand`
stays a local edit: it is not recorded, so a later `update` would replay the old brand over it. A project register that
names its own brand route follows it instead of `brand` (`standard.md`, "The register").

Branding is configuration, not source patching: `scripts/brand.ts` edits `src/app.config.ts` and the token files, and
never `src/lib/preferences.ts`, which reads the accent and theme defaults from the app configuration.
Logo: set `logo: '/logo.svg'` in `src/app.config.ts`, a root-relative local SVG served from `public/`. `AppMark` renders it
at 20, 24, 28 and 32 pixels with an empty alt beside the app name, and with the app name as alt when given a `label`.
Any other value renders the default mark.
Theme default: `npx zz-meridian@<the manifest's version> brand --theme dark|light` sets `theme` in `src/app.config.ts`; it applies before paint and
in `Providers` until a person chooses another in Settings. With no `theme`, the system theme applies. Density: users pick it in the rail's appearance menu and the
command palette; compact suits operators who scan many rows.

## MCP App views (only if asked)

Each `app/embed/<view>/` route is an MCP App: a `ui://` resource an MCP server returns beside a tool result. Copy
`optional:app/embed/overview/` for a summary or `optional:app/embed/requests/` for a list; wrap the content in `EmbedFrame`; call
`useShareView(context)` with the page's context (copy `optional:src/views/overview-context.ts`) so the model knows what is on screen; put `AskAbout` on cards worth asking about; agent
writes go through `Proposal` (see `optional:app/embed/proposal/`). Read `agents.md` next to this file for the server side.

## Clean-up before validation

Delete the sample pages, views and embed views the product does not use, with their nav lines. Do not delete
`optional:src/system/fixtures/` or `optional:src/system/sample-cells.tsx` yet: `optional:src/data/collections.ts` and `optional:src/data/sample.ts`
import the fixtures. Once your collections' `rows` and `clock`, and the clock in the quiet bell of `optional:src/views/shell-alerts.tsx`
(`DEMO_NOW`), come from your own data and nothing imports them, delete them (with the Atlas kept, the previews read them: leave them, and remove the
pages' entries in `PAGES` in `example:src/system/content.ts`). Keep `optional:src/data/collections.ts`, `optional:src/lib/collection.ts`,
`src/lib/assistant/`, `optional:app/api/assistant/` and the assistant panel, unless the person does not want the assistant (it
then stays off without them). Then fix what still points at the sample:

- `optional:src/views/sample-footer.tsx`: the footer status line and its link to `/health`, which `optional:app/not-found.tsx`
  and the sign-in page draw.
- `optional:src/data/alerts.ts`: `readAlerts` works the bell's alerts out of the sample's incidents, customers, verification
  runs and tickets. Write your own exceptions the same way, each from a read the caller may make and linked to the page
  that handles it; the layout hands the read's promise to `ShellAlerts` (`optional:src/views/shell-alerts.tsx`) without
  awaiting it.
- `optional:src/app.config.ts`: each `audience` sentence in `workspaces` describes the sample and prints on a home's
  masthead; rewrite it, or take the workspaces out ("Navigation").
- `optional:app/sign-in/page.tsx`: the headline and lead describe the sample product.
- `example:src/system/content.ts`: `PAGES` names a sample request id route.
- Each page `README.md`: its States rows must describe what your view renders; `check.ts` only checks that the section
  exists.

This finds what is left:

```sh
grep -rn "/health\|/requests\|/customers\|/keys\|/settings\|/members\|/analytics\|/operations-tickets\|/tests\|/releases\|fixtures/sample\|sample-cells" \
  app src/views src/components --include=*.tsx --include=*.ts | grep -v preview.tsx
```

Then `node scripts/registry.ts` and `pnpm verify --full`.

## Renaming a thing

Routes, API paths, tool names (`query_enhancements` → `query_initiatives`), seeds and tables are yours to rename. The
assistant walk-through (`scripts/assistant.ts`) checks what every product shares on your own rail, and drives the
template's sample Overview, Members, API keys and Settings only while their files are there: replace one and its steps
print `n/a` with the reason, never a failure, so you never edit Meridian's scripts to rename your pages. The live checks
(`scripts/live.ts`) work the same way with the sample Members page. `scripts/verify.config.ts`'s `detailRoutes` name ids from the sample, and its `navigationChecks` and `smokeRoutes` name routes and titles, so they move too.

## Things that render nothing (and fail the gate)

Meridian resets Tailwind's own scales, so only its names exist: `font-regular|medium|semibold`, `rounded-xs…xl|full`,
`shadow-card|raise|overlay|control|accent|halo`, `text-2xs…2xl|page|hero|display`, and colour roles such as `bg-surface`,
`text-ink-2`, `border-line`, `text-accent-ink`. `font-bold`, `rounded-2xl`, `shadow-lg`, `bg-white`, `text-gray-500` emit
no CSS. Spacing is the 4px multiplier (`p-6` is 24px).

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
- **Daily series** for anything a Metric tile or chart shows over time: the Meridian cursor reads one value per date it holds.
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
    (`ACTIONS`), keyed by a feature's id and an action's id. A nav item, a page, a view tool and an action name their need
    here **by reference** (`needs: FEATURES.<id>.needs`); a need is never written twice, and a test fails a surface that
    restates one.
    An action is its feature, its label and its need, and nothing else: it carries no sentence about who can run it.
  - `optional:src/data/access.ts` is the policy. `current` says who the request is, `allows` says what the scope may do,
    `gate(feature)` is what a page opens with before it reads (`requireNeed(need)` is the view tool's), and `chromeAccess()`
    is what the rail draws. For a person who may not use the feature, `gate` draws what the product's `refusal` says (see
    "Navigation" below), and `gatedMetadata(feature, metadata)` is what every gated page's `generateMetadata` returns, so
    the tab says the same: a page keeps no static `metadata`. Replace the demo's `current` with your session and delete the demo's View as —
    `optional:src/data/view-as.ts` and its `zz_meridian_view_as` cookie — so nothing signs in as a sample person. Until your sign-in
    exists, keep the demo and point it at your own people: `DEFAULT_MEMBER` and `PERSONAS` in `optional:src/data/access.ts`, and
    `personas` in `scripts/verify.config.ts`, name the sample's member ids.
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

`needs` is required, and in a created project it is a feature's own need **by reference** — `needs: FEATURES.home.needs`,
from `optional:src/data/features.ts` — never a grant written a second time: the rail and the palette draw only the
destinations the signed-in person satisfies, and a test fails an item that restates a need. That filtering is
presentation, not the gate: every page refuses on its own (see "Data" above). An adopted project has no `features.ts`: `adopt` writes
`needs: 'public'` on every item. `'public'` is the need any signed-in, Active person satisfies (`satisfies` in
`optional:src/data/access.ts`), so the item is drawn for everyone who is signed in and no role decides it; it is right for a
destination every member may open, and an item moves to a feature of its own once the project has a role table.
Where several features share one need, as every `public` one does, the item also names its feature
(`feature: 'settings'`): the assistant reads from it what the page shows, whatever the item is labelled.

`refusal` is what an address a person may not open draws, the product's choice, declared once here and read by `gate`.
`'explain'` draws the no-access page: the page's title, who can open it, who to ask and one way out. `'absent'` draws
exactly what an address that names nothing draws: the console's missing page in the shell, at 200, with "Not found" in the
tab and the address walked back past every page the person may not open, so nothing names the page, a role or who to ask.
Every gated route's loading state then names no page for anyone (`gatedLoading`), and the standalone missing page walks
an address below a refused page back past it too.
`pnpm verify --as` expects whichever the product chose on every route a persona may not open
(`scripts/verify.config.ts` reads it from here), and a view tool's refusal is the same under both.

A project made by `create` (or a clone) starts with the sample's three workspaces: `workspaces` in `src/app.config.ts` (Main,
Business, Engineering), a `workspace` on every `nav` entry, and a layout that draws `WorkspaceRail` and `WorkspacePalette`.
`navOf` keeps only the entries whose `workspace` matches, so an entry added without one is drawn by no rail and no palette.
`adopt` writes no `workspaces`. Decide before adding pages, by what the person asked for: when they asked for several
places to look (by audience, by team, by job), keep the workspaces; when they did not say, take them out, since one
navigation is what a product has until somebody asks for more.

**Keep the workspaces** when the destinations fall into a few places to look. Each has a `label`, an `audience` sentence
and a `homeHref`; give every `nav` entry a `workspace` naming one. Rewrite each `audience` sentence (the Home page, the two
workspace homes, Revenue and Now, and Usage print `workspaces.<id>.audience` in their description) and move the homes to your own pages. Keep `optional:src/views/workspaces.ts` (`navOf` derives a workspace's
navigation, `workspaceOf` says which workspace an address belongs to) and `optional:src/views/workspace-chrome.tsx`
(`WorkspaceRail` and `WorkspacePalette`). The address alone decides the workspace; nothing is stored, and a workspace
chooses what the rail lists, never what a person may open. Keep a workspace with the key `main`: the adapter and the
refusal page fall back to it for an address no entry owns. The sample's browser journeys (`optional:journeys/workspaces.ts`)
also name `business` and `engineering`, so `verify --full` fails on a renamed workspace until the journeys are changed
with it or removed, and the gate fails on the tests that hold the sample's three until you rewrite them for yours:
`optional:tests/workspaces.test.ts`, `optional:tests/workspace-access.test.ts`, `optional:tests/workspace-chrome.test.tsx`,
`optional:tests/workspace-menu-access.test.tsx` and `optional:tests/no-access.test.tsx`. `optional:docs/product-workspaces.md` is the sample's own guide
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
- Take `${workspaces.<id>.audience}` out of the descriptions of the Home, Revenue, Usage and Now pages, or delete
  the pages.
- Delete `optional:tests/workspaces.test.ts`, `optional:tests/workspace-access.test.ts`,
  `optional:tests/workspace-chrome.test.tsx` and `optional:tests/workspace-menu-access.test.tsx`. In `optional:tests/shell-alerts.test.ts` drop the `workspaceOf` check, and in
  `optional:tests/workspace-home.test.tsx` the test that reads `workspaces.main.audience`, with the two imports only
  it uses.
- A clone that keeps the Atlas also changes `optional:src/system/atlas-shell.tsx` and `optional:src/system/strata.tsx`, which
  list the workspaces, and `optional:tests/atlas-layers.test.ts`, which expects three; a created project has no Atlas.

`grep -rn "workspaces\.\|WorkspaceId\|views/workspaces\|workspace-chrome" app src tests journeys` finds what is left.

## Pages: presets to start from

| They need | Copy and adapt | Its protagonist |
|---|---|---|
| A summary with one leading figure | `optional:app/(dashboard)/(home)/page.tsx` + `optional:src/views/home.tsx` | Featured metric with its trend |
| A list of records with filters | `optional:app/(dashboard)/requests/` + `optional:src/views/requests.tsx` | Data table with filter bar |
| Summary tiles over a list people only read (what ran, what is going out) | `optional:app/(dashboard)/tests/`, `optional:app/(dashboard)/releases/` + `optional:src/views/tests.tsx`, `optional:src/views/releases.tsx` | Data table under three tiles |
| One record | `optional:app/(dashboard)/requests/[id]/` + `optional:src/views/request.tsx` | Detail head and key facts |
| A count over a period, its facts, then breakdowns and patterns over time | `optional:app/(dashboard)/usage/` + `optional:src/views/usage.tsx` | Featured metric of the period's requests with requests a day, then a year of days |
| Systems and incidents (Services, at `/services`) | `optional:app/(dashboard)/services/` + `optional:src/views/services.tsx` | Featured metric of uptime over 90 days, then a Status list with each service's run beside one list of incidents |
| Customers, accounts, people | `optional:app/(dashboard)/customers/` + `optional:src/views/customers.tsx` | Data table, a usage sparkline in each row |
| Keys, tokens, secrets | `optional:app/(dashboard)/keys/` + `optional:src/views/keys.tsx` | Table with masked values |
| Records people add, edit and remove (also what the assistant reads) | `optional:app/(dashboard)/members/`, `optional:app/(dashboard)/keys/` + `optional:src/views/members.tsx`, `optional:src/views/keys.tsx` | Data table over a collection |
| Work people create and move along, through a write boundary | `optional:app/(dashboard)/operations-tickets/` + `optional:src/views/tickets.tsx` and `optional:src/data/ticket-mutations.ts` | Data table with New ticket and a row menu |
| Settings (a sample: keep only if asked; its Assistant section holds the assistant's switch) | `optional:app/(dashboard)/settings/` + `optional:src/views/settings.tsx` | Form sections |
| Sign in, not found | `optional:app/sign-in/` (`page.tsx` + `panel.tsx`), `optional:app/not-found.tsx` + `optional:src/views/standalone.tsx` | One sentence at display size |

The Services preset assumes software services. For other things that are up or not (warehouses, branches, sites), pass
`StatusList` a `noun`, a `measure` ("on time") and a `metric`, and `UptimeBars` a `measure`. A Metric tile says what
its change compares with in `compare` ("vs the 3 days before") and takes a `note` where no comparison fits.

A copied sample page does not do what a product would assume of it. Its writes are held in memory: a ticket, a member or a
key lives in the running server and is lost when it restarts, until your own database stands behind the collection. Its
figures that are fixed (Usage' weekday-and-hour grid, hours and regions, its endpoints and its responses by status
class) cover the last 30 complete days: they are not worked out from the request log and do not follow the period chosen. A period is complete days counted
back from yesterday, `all` is every complete day kept and has no period before it, and the last row of each daily collection may be a day still in
progress, which `readDays` in `optional:src/data/metrics.ts` hands over on its own and counts in nothing. Nothing runs a suite or ships a version
behind Tests and Releases, no message is sent, and the bell only lists what needs a person when the page
is read. `optional:docs/product-workspaces.md` lists each limit.

Rules that make every page look like it belongs:

- **`PageFrame`** with `kicker` (where it sits: "Product · Workspace" or the parent record), `title`, one-sentence
  `description`, then `meta` (Freshness) and `actions` (one primary at most). A page that leads with figures passes
  its `name` too and a `title` that is a sentence ("A title that states the figures" below). A dashboard page leaves `width` alone:
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
  `title` and the page's `width`, and `sentence` when the page is headed by one, around skeletons shaped like the page: `TilesSkeleton`, `ChartSkeleton`,
  `TableSkeleton` or `RecordsSkeleton`; read through `read()` so the page is
  in its prerendered shell and the skeleton is rarely seen, since a request-time read waits at least 300 ms behind it:
  `cache.md`), empty (Empty state with the one action), error (`error.tsx`, what failed and Retry), and partial (a
  part whose read failed keeps its card and its title and says what could not be read, in its own place, while the rest
  of the page stands; a tile shows a dash). A loading state holds the room of the masthead its page will have, or the
  body drops when the page arrives: give `LoadingPage` the page's own `kicker` and `meta` when they read no data, `lead`
  when the sentence under the title is a long one (a line of figures and who the page is for), and `actions` in the
  controls' own width; the page draws that sentence inside the same `LeadRoom` and gives its own fallbacks the same
  room. A shorter line keeps a room of its own, and the loading state passes that room as `description`: One
  customer's line of figures does (`FactsRoom` in `optional:src/views/customer.tsx`). Home and Revenue do all of it
  (`optional:app/(dashboard)/(home)/loading.tsx`, `optional:app/(dashboard)/business/loading.tsx`,
  `optional:src/views/period-actions.tsx`). The room is the standard, whatever a page holds. A route that opens with
  `gate` passes what names its page (`name`, `title`, and a `kicker` or `description` of its own words) through
  `gatedLoading({ … })` from `optional:src/data/refusal.ts`, which reads only the configuration: the loading state is prerendered before the gate answers,
  so under `refusal: 'absent'` it names nothing for anyone, and under `explain` the page's own words stand.
- **A file picker** is a visible `Button` that calls `input.click()` on an `<input type="file">` with `tabIndex={-1}`
  and `aria-hidden`, so the keyboard reaches the button and never the hidden input; give the press a state of its own
  ("Choosing the files…") until the change event arrives. The presses count a file chooser that opens as an answer.
- **A page spec** next to each route (`README.md`: summary, Structure, States, Surfaces, Agents), so the next person, or
  agent, knows what the page is for. `node scripts/check.ts` requires Structure and States, and under `## Agents` a
  `### What the agent reads` part for every page in `optional:app/(dashboard)/` and `optional:app/embed/`. A page with a
  view tool also needs `### What the agent does here`: a line `Protagonist: <name>.` naming the card worth asking
  about, then at least three items `- "<question>" — <what the prepared query is asked>`, each a question a person on
  the page asks that its context does not answer alone; `node scripts/check.ts` fails the spec without it or its form,
  and `node scripts/ask.ts` asks the questions of a served product. The page marks that card
  `data-protagonist="<name>"` on a wrapper whose display is `contents` (in a `2/3` or `1/3` row, where the row gives its first or last card the wider span, the wrapper is itself that grid item, `flex min-w-0 flex-col` with its card stretched to fill it: a `contents` wrapper draws no box, so the span would land on nothing), and gives it an Ask. Settings and the embed
  views carry none. A created project carries none of the template's to copy, so start from this shape:

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

  ### What the agent does here
  Protagonist: Late pickups.

  - "Which shop had the most late pickups this week?" — the late orders over 7 complete days, by shop
  - "Are pickups later on weekends?" — the late orders' average wait over 30 complete days, by weekday
  - "Which late orders waited over an hour, and where do I open them?" — the late orders whose wait is over 60 minutes, with up to 20 of them, each with its order's address
  ```
- **A form reports unsaved changes** so the shell can ask before a person leaves: a `FormSection` does it from its `dirty`
  prop, and any other component calls `useUnsavedChanges(dirty)` from `src/components/base/shell`. Code that navigates
  on its own (a button, a menu, a palette command) goes through `useLeave()`, which runs the move at once when nothing
  is unsaved and otherwise only if the person chooses to leave. A link needs nothing, and Back and Forward are the
  browser's.
- **A shared context** for each page (decision 0011): a pure function beside the view builds it from the page's data
  (copy `optional:src/views/home-context.ts`: scope, freshness, each figure with its unit, change and definition,
  what `optional:src/lib/insight.ts` finds, what the data cannot say), within 2,600 characters with four to eight
  times the sample's records and pointed at any day: each list it states keeps the first items its page shows, up to
  a count that holds the budget, and says how many more there are ("and 9 more resolved"; `listed` writes it). The
  view passes it to `useShareView`; a
  server page with no client view places `<ShareContext context={…} />` among its cards instead. Both
  agents read it: an MCP host and the console's assistant. Add the page's tool to `optional:src/views/tools.ts` so the
  assistant can open it at an address.

## A title that states the figures, and the facts beside it

A page that leads with figures is headed by what they say, and states what its records show as facts. Part of this is
Meridian's standard, which a product keeps whatever it sells. Part is the sample's, written for a company that sells
tokens, which a product replaces with its own words and values. Replace all of the second list's parts, words and
values, and keep the standard a bullet of it says its parts show: a title that still says "requests" on a page about
orders is the sample's, not the product's.

**The standard. Keep it.**

- **A page that leads with figures is headed by a sentence, with its name kept in the heading.** `PageFrame` takes the
  page's `name` beside a `title` that is the sentence. The heading reads the name, out of sight, then the sentence; the
  top bar and the document's title stay the name; the frame holds the sentence's block while the sentence arrives, so
  nothing under it moves (the Shell's specification, `optional:src/components/base/shell/README.md`, "The title"). A list, a form and Settings keep a name.
- **A title is worked out, never written.** A function beside the page's view takes plain figures and returns the
  sentence, with a branch for each thing it may say and a test for every branch. It says what is wrong today in the
  same sentence where its rule has a clause for it, and a page that cannot work its title out is headed by its name.
- **A fact is stated by a rule with a guard.** The rules are in `src/lib/facts.ts`, which an update brings: `record`
  (the highest period yet, once enough history is kept), `first` (the first day a threshold was passed, when the
  records begin below it), `all` (every member of a set, written N of N), `total` (everything recorded, with its first
  day and its latest), `run` (how long a state has held, its longest only when no run kept is longer, worked out by
  `runOf`, which the Status list draws) and `steady` (how many complete days were inside a band, and the days outside
  it by date). A rule returns its fact with the one line it wrote, or nothing, and nothing weaker stands in for a fact
  that stopped holding. `optional:tests/facts.test.ts` and `optional:tests/facts-engineering.test.ts` hold the rules
  and stay with them.
- **No word of praise**, in a title or in a fact: the figure is what is said. The rules' test refuses twelve words.
- **The title is shared.** The page's context leads its insights with the sentence the page is headed by, word for
  word, and each fact follows as the rule's own line (`factInsight` and `headInsights` in
  `optional:src/views/fact-insight.ts`). The history a record, a first, a total or the days inside the band are
  worked out from is read on the server; the page's client is handed the sentences (`head` on the view's data) and
  never the history. A title that cannot read one of its clauses states the rest, and the context says what was not
  read.
- **The day in progress is in no figure a title or a fact states.**
- **A figure only some roles read is asked of the policy, not left to fail.** A view's read asks
  `can(await resolveAccess(), '<collection>', 'read')` once, the question `read()` and the assistant's query ask, and
  reads the collection only on a yes. For anyone else the view's data has no key for the figure, the page has no tile
  in its place and the context and the line under the title say nothing of it: not a dash, not a null. Home does this
  for what compute cost (`costs`), so a Member and a Viewer see neither Compute cost nor Gross margin.
- **A rule may say more of its own fact, never a second rule.** `record` takes the `day` its latest value is about,
  and names it in its line ("on 01 Oct 2026", or "in the week to" it with `week`); `total` takes a `share`, a part of
  each day's figure, and adds the part's share of the sum ("99.62% of them without an error"). Both are optional, so
  a call without them says what it said before, and both facts carry the date they are about (`day`). `first` takes
  a `period`, how many of the latest days a page's period covers, and adds how many of them passed the threshold ("and
  26 of the last 30 days passed it"); it is still given every day kept, never the period's days alone, which would
  make a day inside the period the first ever.
- **A count reads at a glance at every size.** `formatCompact` (`src/lib/format.ts`, which an update brings) steps
  from K to M, B and T, and a count that rounds up to a thousand of one step is written in the next: 999,960,000,000
  is "1.0T", not "1000.0B".
- **The share of revenue that makes a customer worth knowing is configured.** `facts.concentrationAt` in
  `src/app.config.ts` is read when the read runs, never captured when a module loads; the key is the standard, and a
  page that states concentration reads it.
- **The share that puts a customer close to the next plan is configured.** `facts.nextPlanAt` in `src/app.config.ts`
  is read when the read runs, as `concentrationAt` is; the key is the standard, and a page that says a customer is
  close to a plan reads it.
- **A ranked list's row opens the record it names.** Give a Bar list's row an `href` when it names a record that has a
  page (a customer, a model): its label is then the one link to it, the bar and the figure are not a second way
  there, and the folded "N others" row opens nothing. A row that names no record (a region, a status class) stays text.
- **Every record a page names opens its page.** Wherever a record that has a page is named (a table's cell, a detail
  page's head and its facts, a tile of a wall, a line worth a look, an alert of the bell), its name is the link to it.
  The address is worked out on the server: a record that keeps another's name, as a request keeps its customer's, is
  joined to it by name when it is read (`customerIds` in `optional:src/data/requests.ts`), and a name nothing holds
  stays text. A link in a table's cell is followed as itself and does not also open the row. Where the whole row is one
  control (the Requests embed's list) or a link would navigate a host's frame (an embed's table), the name stays text.
- **An incident names its ticket.** An incident's record names the ticket its work is tracked in by id, and the
  Incident card takes a title and an address: `readIncidents()` in `optional:src/data/metrics.ts` reads the tickets the
  incidents name, by their ids, and joins each to its title and the address your tickets page finds it at. A ticket
  the person may not read, or a read of them that fails, leaves the incident standing without its line, never the page
  failing. Point the address at your own tickets page.
- **The reader's own work is marked on the server.** A list of work marks what is the reader's own from
  `resolveAccess().subjectId`, read where the data is read, so nobody else's read marks a record theirs and no id of
  the reader reaches the browser to be compared there.
- **No page says who can use a control it withholds.** A page asks `may(ACTIONS[<id>].needs)` and draws the control
  only on a yes; for anyone else the control is absent and nothing names a role, a person or a grant in its place. A
  read-only Form section passes `readOnly` (a boolean) and reads "Read-only" beside its lock, and the Records template
  draws a read-only page as its table with nothing that creates. A row the member boundary refuses gives a reason only
  when the row is the caller's own. A change forced past the page is still refused by the boundary with its own
  sentence (`REFUSALS` in `optional:src/data/member-mutations.ts`), and the roles table on Members, a reference of what
  each role holds, stays.
- **What a refused address draws is the product's choice, declared once.** `refusal` in `src/app.config.ts` is the one
  place it is said; `gate` reads it on every page, every gated page titles itself through `gatedMetadata`, and every
  gated route's loading state passes its words through `gatedLoading` (`optional:src/data/refusal.ts`). Neither
  choice throws `notFound()` or answers anything but 200, and a person with no session is sent to sign-in under both.
- **Each page's protagonist hands itself to the agent.** The card worth asking about, the one the page spec names on
  its `Protagonist:` line, is marked `data-protagonist` with that name, on a wrapper whose display is `contents` so the
  row's grid is unchanged (or, as the wide card of a `2/3` or `1/3` row, on a wrapper that is that grid item), and carries an Ask in its header actions or its Filter bar whose question names what the
  card shows for the period, the filters and the day in view (`AskPeriod` in `optional:src/views/ask-period.tsx` for a
  card over time, `AskAbout` otherwise). The Ask renders only when the assistant is on.
- **Every context is held to the budget.** Every view's context fits 2,600 characters and names its address as each
  person who may read it, at every period, for every record, pointed at every day of a view that takes one, and with
  four to eight times the records there are today. Each list a context states is capped and counted, and the cap is
  never below what the page states with the product's own records. Meridian holds its sample to this with a test of
  its own; a product holds its contexts with cases beside the budget cases of `optional:tests/shared-context.test.tsx`.
- **The cards' forms are the standard, and an update brings them.** Every card lives in `src/components/`, so what a
  card can draw is Meridian's whatever a page shows with it: the Column chart's `parts` (each column a whole),
  `running`, values at rest, `height="fill"` and its one Tab stop; the Trend chart's `running` and `stacked`; the
  Heatmap's calendar form (`days`, joined to the page's Meridian with `meridian`) and its `scale`; the Featured metric's
  `points`, `finding`, `foot`, `peer`, `compare` and `pointLabel`; the Metric tile's `points`, a `finding` that names
  its `tone`, and `size="compact"`; the Incident card's updates timed from the incident's start, its `owner` and its
  `ticket`; the Status list's `run`; Uptime bars' `endLabel`; and the Composition bar's `stacked`.
  `example:docs/data-display.md` says when each is the form to draw.

**The sample's. Replace it.**

- **The company the sample is**: one company that sells tokens, priced once: its models and their prices, its plans,
  its customers, its regions and its days, worked out in `optional:src/system/fixtures/company.ts` from the names, the
  shapes and the clock in `optional:src/system/fixtures/sample.ts`, and served by `optional:src/data/collections.ts` as
  each collection's `rows`; `PLANS` and `REGION_NAMES` in `optional:src/data/sample.ts` are its plans and its regions.
  Replace each collection's `rows` with your data ("Data" above).
- **The three workspaces**: Main, Business and Engineering, their `audience` sentences and their homes (Home at `/`,
  Revenue at `/business`, Now at `/engineering`). "Navigation" above says how to declare your own or take them out.
- **The checks of the sample's pages**: `optional:journeys/workspaces.ts`, which walks every destination of the three
  workspaces as an Owner and as a Viewer, the `navigationChecks`, `detailRoutes`, `browserChecks` and `personas` in
  `scripts/verify.config.ts` that name the sample's routes and people, and the shipped tests that hold the sample (the
  next item). Give each rail page of your own its `navigationChecks`
  entry (`pnpm verify --full` fails a rail route without one) and take the sample's out with its pages.
  `optional:journeys/workspaces.ts` expects of a refused destination what your `refusal` chooses, as `pnpm verify --as`
  does, and gates each step on the destinations it walks.
- **The shipped tests that hold the sample**: a test under `optional:tests/` holds the sample when it imports a sample
  page, view or fixture, and also when it reads the sample through a module you keep (`optional:src/data/collections.ts`,
  `optional:src/data/read.ts`, `optional:src/data/access.ts`, the assistant and live routes) and names the sample's
  clock, collections, records, people or routes. The gate fails on each once you replace what it names. Keep what each
  holds for your own data: rewrite its cases for your collections, people and records, and delete a case about a
  collection, page or person you dropped. Among them, by what they hold:
  - The clock and the collections of the company: `optional:tests/day-in-progress.test.ts` (today is 03 Oct 2026; four
    usage rows, four compute rows and one cost row a day; 361 days kept) and `optional:tests/data-model.test.ts` (the
    collections models, usage, compute and costs with their keys and fields, the four model ids and the routes they
    serve, what each persona may read). What they hold is the product's: the day in progress is counted in no period, a
    read of all history pages past the 500 rows one read returns, a collection holds the fields its pages read and only
    the roles the table names read it.
  - The people of the demo, by member id (`members_1` is Maya Chen, the Owner; `members_12` is Grace Liu, a Viewer):
    `optional:tests/demo-policy.test.ts`, `optional:tests/view-as.test.ts`, `optional:tests/sign-in-persona.test.ts`,
    `optional:tests/sign-in-honest.test.tsx`, `optional:tests/verify-personas.test.ts`,
    `optional:tests/member-mutations.test.ts`, `optional:tests/data-access.test.ts`, `optional:tests/data-write.test.ts`,
    `optional:tests/assistant-tools.test.ts` (the members collection's write schema) and
    `optional:tests/assistant-prompt-truth.test.ts`. While the demo signs in as your own people
    (`PERSONAS`), write their ids into these cases; once your sign-in replaces the demo, delete the first four with
    `optional:src/data/view-as.ts` and the sign-in page, and rewrite the rest for your sign-in's people.
  - The records and routes of the company: `optional:tests/shell-alerts.test.ts` (more than one past-due customer, one
    of them Lumen Studio at `/customers/lumen-studio`, a high-priority ticket nobody has, the failing verifications:
    rewrite it for the exceptions your `readAlerts` raises), `optional:tests/feature-access.test.ts` (the sample's
    seventeen features by id and each action's need), `optional:tests/data-read.test.ts`,
    `optional:tests/live-route.test.ts` and `optional:tests/live-actions.test.ts` (the members and keys collections),
    `optional:tests/assistant-guard.test.ts` (the members collection), `optional:tests/engineering-records.test.ts`
    (tickets, verification runs and releases, and who of the demo's people writes them) and `optional:tests/requests-summary-newest.test.ts` (the requests
    collection).

  The sample's own figures, pages and answers are in `cli-*` tests, which a created project does not receive. A shipped
  test that still fails after this names something of the sample's too: change it the same way.
- **The choice `explain`**: the sample answers an address a person may not open with the no-access page, which names the
  page and who to ask. Choose `absent` when a product must not tell a person that a page they may not open exists.
- **The counts each context's lists are capped at**: six services, two open incidents and three resolved on Services,
  one open incident on Now, eight keys, 24 members and the rest in `optional:src/views/*-context.ts`. They hold the
  sample's lists within the budget; a product sets its own, at least what its pages state with its own records.
- **The six title functions and their words**: `homeTitle`, `usageTitle`, `revenueTitle`, `customerTitle`, `nowTitle`
  and `servicesTitle`, each in its view's context file under `optional:src/views/`, with the functions that call the
  rules for them (`revenueHead`, `titleOf`, `nowHead`, `servicesHead`, Usage's `usageHead` in
  `optional:src/views/usage-parts.ts` and Home's `homeHead` in `optional:src/views/home-parts.ts`) and Home's line under its title (`homeLine`). Write your pages' own, in your
  product's nouns: a release "in testing" is the sample's word for its own releases. A run's "without a mark" is
  written by `run` itself (`src/lib/facts.ts`), so it stays wherever a page states a run.
- **Home's nine parts and their words**: the head, the revenue card, the three tiles beside it, the row of the days
  inside the band, compute in use, compute cost and gross margin, the year's card, "A year, counted", revenue a period
  beside "What we sell", the Business and Engineering cards, and "Worth knowing across the company": what `homeData`
  in `optional:src/views/home-parts.ts` works out for them, how `optional:src/views/home.tsx` draws them and how
  `homeContext` says it. They are the figures of a company that sells tokens, and the titles, labels and lines are
  its words. Keep the standard they show: one Featured metric, a part's title alone in its element, a list that holds
  to its stated number whatever the data, the four states, every row of tiles one column on a phone, and the cost
  rule. Write your own company's parts.
- **Revenue's eight parts and their words**: the head and its line, the Featured metric that leads it (the period's
  revenue, its record as its finding, revenue a day as its chart) beside three tiles (Against a year ago, Best day yet,
  Past due), revenue a day by plan beside "Who pays", revenue a period by plan, the wall of "Every customer,
  the last 14 days" with its three orders, the ladder "From a trial to Enterprise" with its stages, "Worth a look", and
  "What they buy" beside "Where they are": what `revenueData` in `optional:src/views/revenue-parts.ts` works out for
  them, how `optional:src/views/revenue.tsx` draws them and how `revenueContext` says it. The plans, the stages and the
  wording of a customer close to the next plan are the sample company's. Keep the standard they show: each part about
  customers names its window, every customer a part names opens its page, the period moves only what the daily
  records answer, and the four states. Write your own.
- **Usage's parts and their words**: the head and its line (requests a day, the share of errors and the median day's
  p95), the Featured metric that leads it (the period's requests, its record as its finding, requests a day as its
  chart), "A year of requests, a day a cell" with its busiest day, "The period, counted" with at most three
  facts, "When they come" with its two choices, "Where from" beside "What is asked for", and "How it was answered":
  what `usageData` and `usageHead` in `optional:src/views/usage-parts.ts` work out for them, how
  `optional:src/views/usage.tsx` draws them and how `usageContext` says it. The endpoints, regions and status classes
  are the sample company's. Keep the standard they show: a part that does not follow the period names its window, the
  calendar is every day kept and joins the page's Meridian, a ranked list holds to its stated number, status classes
  take status colours, and the four states. Write your own.
- **One customer's parts and their words**: the head (the trail of Business and Customers, the title, and the line of
  its plan, what it paid in 30 days with its share of revenue, and its requests), the card of where it stands and since
  when with its owner on our side, the three tiles (Requests, Paid, Error rate), "What it asks for" and "Its latest
  requests": what `readCustomer` in `optional:src/views/tools.ts` reads for them, how `optional:src/views/customer.tsx`
  draws them and how `customerContext` says it. Keep the standard they show: no period control and every window named,
  a part whose read failed says so in its place, one the reader may not read is absent, and the missing-record page for
  an id that names nobody. Write your own record's page.
- **Now's parts and their words**: the line under its title, the Featured metric that leads it (the days inside the
  band, the steady fact as its finding, each complete day's p95 as its chart), the services, the open incidents, the days inside the
  band with their four facts, the models over the last 30 complete days, compute in use a region on the latest complete
  day, what ships, the work, the slowest endpoints, the four figures of the last 30 complete days, the runs a day and
  the latest changes: what `nowData` in `optional:src/views/now-parts.ts` works out for them from what `nowTool` in
  `optional:src/views/tools.ts` reads, each collection apart, how `optional:src/views/now.tsx` draws them, in thirteen
  parts, and how `nowContext` says it. The parts, their titles and words, the models, the regions, the tickets'
  priorities, the tiles, the eight services a list holds whole and the three longest runs it keeps past that are the
  sample company's. Keep the standard they show: each figure names its window, a tile's line fits in 32 characters,
  the day in progress is counted in nothing but the runs a day, the facts Home also states are written by Home's own
  functions, and a part whose read failed is null, says so in its own place and is named in the context's unknowns; a
  list that never folds is handed what the page's rule keeps (`servicesShown` in `optional:src/views/now-context.ts`)
  beside a link that counts every one; an incident names its owner and opens its ticket; the reader's own record is
  marked "Yours", worked out on the server from who is reading; a part that changes while it is read registers its
  collection with `useLive`; nothing arrived is one card and the page headed by its name. Write your own engineering
  home.
- **Services' parts and their words**: the Featured metric that leads it (uptime over 90 days, the run fact as its
  finding, the share of services operational a day as its chart), "Each service, 90 days" and "Incidents", the page's
  one sentence, the services,
  their order and their incidents: what `servicesTool` in `optional:src/views/tools.ts` reads, how
  `optional:src/views/services.tsx` draws them and how `servicesContext` in `optional:src/views/services-context.ts`
  says it. The six services, their 90 days and the rule an uptime is worked out by are the sample company's. Keep the
  standard they show: the services in the order the team reads its stack, each with its run (the Status list's `run`);
  one list of incidents, the open ones first in the Incident card's card form with how long each has lasted so far,
  then the resolved in its row form with how long each lasted; an uptime under one never written as a whole one, and
  exactly one written "100%"; incidents that cannot be read leave their part saying so while every service stands; and
  no service yet is one card with the page headed by its name. The masthead's freshness reads the sample's clock
  (`DEMO_UPDATED_AT`), as Now's does: a product passes when its own data last arrived. Write your own.
- **`optional:tests/titles.test.ts`** and **`optional:tests/titles-engineering.test.ts`**, which hold the sample's
  words branch by branch; **`optional:tests/facts-config.test.ts`**, which holds the sample's values of `facts`; and
  the cases of `optional:tests/shared-context.test.tsx` that read the sample's headings and facts. Rewrite their cases
  for your titles and your values: a title no test holds is a sentence nobody checked.
- **The values of `facts` in `src/app.config.ts`**: `firsts.requestsADay` (10, 25 and 50 million requests a day),
  `recordNeedsPeriods` (six periods), `band` (a p95 under 350 ms and an error rate under 1%), `nextPlanAt` (three
  quarters of what the next plan's smallest customer pays) and `concentrationAt` (a tenth of the revenue of the last
  30 complete days). They are the sample company's sizes. Keep the keys your pages
  pass to a rule, set your own values, and delete a key nothing reads.
- **The facts the sample's contexts state**: on Home the facts of a year (the requests answered with the share answered
  without an error, what customers were billed, the busiest day yet, the first day requests passed a threshold and the
  weekday average when it is the highest yet), on Usage the facts of the period (the busiest day yet, the first day
  requests passed a threshold with how many of the period's days passed it, and the weekday average when it is the
  highest yet), and the days inside the band on Now and on Services. State the facts your own records hold, from the
  same rules.

`grep -rn "Title(\|Head(\|facts as rules" src/views src/data app` finds every title, head and reader of the configuration.

## The assistant

The dashboard carries an assistant panel (`src/components/patterns/assistant/`, mounted by `AppShell`). It is off until
the variables are set, read per request, so no rebuild is needed: `ASSISTANT_PROVIDER` (`anthropic` or
`openai-compatible`), `ASSISTANT_API_KEY` and `ASSISTANT_MODEL` are required, and `ASSISTANT_BASE_URL` is required for
`openai-compatible`. `example:docs/assistant.md` in the template has the full guide.

The layout hands the shell whether it is on as a promise it does not await, `assistant={connection().then(() => assistantConfig(process.env) !== null)}`, so the request never blocks the frame; `AppShell` resolves it behind its own boundaries, and `useAssistantAvailable()` returns the same promise.

- **Collections** live in `optional:src/data/collections.ts`: one `arrayCollection` per kind of record, with `rows`, the `fields`
  schema, `allow` (which of create, update and remove the assistant may propose) and `hidden` fields. Replace each
  `rows` with the person's API and `clock` with `new Date()`; the assistant reads them through the views and each page's
  prepared query, and proposes changes only through them, on the page whose prepared query reads them.
  A new collection is read by nobody until the policy binds it and a role is granted it. In the sample's policy that is
  three places: its entry in `DEMO_COLLECTIONS` in `optional:src/data/access.ts`, `<name>:read` for the roles that may read
  it in `GRANTS` in `optional:src/data/roles.ts`, and, for a page, a feature with that need in `optional:src/data/features.ts`.
  Without the first, `read()` refuses everybody and the assistant is given no tool for it. A grant need not be every
  role's: the sample's `costs` collection (what compute cost a day) is read under `costs:read`, which only the Owner and
  the Admin carry, so a Member and a Viewer are refused it by a page, a tool and the assistant alike. A product's own
  policy binds the collection in `policy.bind` and decides the grant in `policy.allows`. A collection written by hand,
  not through `arrayCollection`, has an `aggregate` as well as a `query`: `aggregateRows(rows, query)` from
  `optional:src/lib/collection.ts` over the rows it holds, or one grouped query for a database.
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
`optional:app/embed/home/` for a summary or `optional:app/embed/requests/` for a list; wrap the content in `EmbedFrame`; call
`useShareView(context)` with the page's context (copy `optional:src/views/home-context.ts`) so the model knows what is on screen; put `AskAbout` on cards worth asking about; agent
writes go through `Proposal` (see `optional:app/embed/proposal/`). Read `agents.md` next to this file for the server side.

## Clean-up before validation

Delete the sample pages, views, embed views and API routes (`optional:app/api/export/requests/`) the product does not use, with their nav lines and the tests that import them, and change the tests that read the sample through a module you keep ("The shipped tests that hold the sample" above). Do not delete
`optional:src/system/fixtures/` or `optional:src/system/sample-cells.tsx` yet: `optional:src/data/collections.ts`, `optional:src/data/sample.ts`
and `optional:src/data/sign-in.ts` (the 30 days the sign-in page draws) import the fixtures. Once your collections' `rows` and `clock`, and the clock in the quiet bell of `optional:src/views/shell-alerts.tsx`
(`DEMO_NOW`), come from your own data and nothing imports them, delete them and `optional:src/data/sample.ts` (with the Atlas kept, the previews read them: leave them, and remove the
pages' entries in `PAGES` in `example:src/system/content.ts`). Keep `optional:src/data/collections.ts`, `optional:src/lib/collection.ts`, `optional:src/lib/explore.ts`,
`src/lib/assistant/`, `optional:app/api/assistant/` and the assistant panel, unless the person does not want the assistant (it
then stays off without them). Then fix what still points at the sample:

- `optional:src/views/sample-footer.tsx`: the footer status line and its link to `/services`, which `optional:app/not-found.tsx`
  and the sign-in page draw.
- `optional:src/data/alerts.ts`: `readAlerts` works the bell's alerts out of the sample's incidents, customers, verification
  runs and tickets. Write your own exceptions the same way, each from a read the caller may make and linked to the page
  that handles it; the layout hands the read's promise to `ShellAlerts` (`optional:src/views/shell-alerts.tsx`) without
  awaiting it.
- `optional:src/app.config.ts`: each `audience` sentence in `workspaces` describes the sample and prints on a page's
  masthead; rewrite it, or take the workspaces out ("Navigation").
- `optional:app/sign-in/page.tsx`: the headline and lead describe the sample product, and the root layout's
  `description` (`optional:app/layout.tsx`) does too.
- `optional:src/data/README.md`: it describes the sample's collections; describe your own.
- What only a deleted page read: `node scripts/check.ts` fails an export of `optional:src/data/` that nothing but a test
  imports, so with Members gone the page side of `optional:src/data/member-mutations.ts` (`memberAccess`,
  `invitableRoles`, `assignMemberRole`) and `GRANTS` in `optional:src/data/roles.ts` go, or stop being exported.
- `example:src/system/content.ts`: `PAGES` names a sample request id route.
- Each page `README.md`: its States rows must describe what your view renders; `check.ts` only checks that the section
  exists.

This finds what is left:

```sh
grep -rn "/services\|/requests\|/customers\|/keys\|/settings\|/members\|/usage\|/operations-tickets\|/tests\|/releases\|fixtures/sample\|sample-cells" \
  app src/views src/components --include=*.tsx --include=*.ts | grep -v preview.tsx
```

Then `pnpm verify --full`, after `node scripts/registry.ts` in a clone that keeps the Atlas (a created project has no
cards' previews, and there it writes a registry of none).

## Renaming a thing

Routes, API paths, tool names (`explore_enhancements` → `explore_initiatives`), seeds and tables are yours to rename. The
assistant walk-through (`scripts/assistant.ts`) checks what every product shares on your own rail, and drives the
template's sample Home, Now, Members (its lookups through `explore_members`), API keys (a revocation found through
`explore_keys`) and Settings, and asks its Usage and Tests through their prepared queries, only while their files are there: replace one and its steps
print `n/a` with the reason, never a failure, so you never edit Meridian's scripts to rename your pages. The live checks
(`scripts/live.ts`) work the same way with the sample Members page. `scripts/verify.config.ts`'s `detailRoutes` name ids from the sample, and its `navigationChecks` and `smokeRoutes` name routes and titles, so they move too.

## Things that render nothing (and fail the gate)

Meridian resets Tailwind's own scales, so only its names exist: `font-regular|medium|semibold`, `rounded-xs…xl|full`,
`shadow-card|raise|overlay|control|accent|halo`, `text-2xs…2xl|page|hero|display`, and colour roles such as `bg-surface`,
`text-ink-2`, `border-line`, `text-accent-ink`. `font-bold`, `rounded-2xl`, `shadow-lg`, `bg-white`, `text-gray-500` emit
no CSS. Spacing is the 4px multiplier (`p-6` is 24px).

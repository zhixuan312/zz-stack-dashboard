# Update 0.14.1 to 0.15.0

- Source: 0.14.1
- Target: 0.15.0
- Route: adopt
- Session: 20261014T015655983Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.15.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.15.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.15.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:dependency:jsdom

jsdom ^30.1.2 is newer than the tested ^30.1.1

Paths: `package.json`

Meridian is tested against jsdom ^30.1.1; your ^30.1.2 is newer and was left as it is. Run the project's gate and build with it, and read the jsdom release notes for breaking changes before relying on it.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:dependency:jsdom",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-ae724d13f64a9296964f54a392286307b5721f9e3ce1d63d1cc804011640211d"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `package.json`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 6
- kept/leave: 10
- team-preserved/write: 1
- untouched/leave: 110
- untouched/write: 48

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        write   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        write   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        leave   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        write   .agents/skills/zz-meridian/references/voice.md
untouched        write   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        write   .claude/skills/zz-meridian/references/cache.md
untouched        write   .claude/skills/zz-meridian/references/customize.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        write   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        leave   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        write   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        write   scripts/assistant.ts
kept             leave   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        write   scripts/interactions.ts
kept             leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
added            write   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/next-config.ts
untouched        write   scripts/lib/routes.ts
untouched        write   scripts/lib/sample.ts
added            write   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        write   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        write   scripts/rail.ts
untouched        write   scripts/registry.ts
untouched        write   scripts/route-policy.ts
untouched        write   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        write   scripts/tokens.ts
untouched        write   scripts/verify.ts
kept             leave   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        write   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
added            write   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        write   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        write   src/components/patterns/command-palette/index.tsx
untouched        write   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
added            write   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        write   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
added            write   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/index.tsx
kept             leave   src/components/patterns/prose/index.tsx
kept             leave   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/patterns/status-list/summarise.ts
added            write   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        write   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        write   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        write   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
kept             leave   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
kept             leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        write   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/format-date.ts
untouched        leave   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        leave   src/lib/insight.ts
kept             leave   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/styles/base.css
untouched        write   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        write   src/styles/tokens.css
untouched        write   src/views/console-chrome.tsx
untouched        write   tests/setup.ts
untouched        leave   tokens/accent.brand.tokens.json
untouched        leave   tokens/accent.cobalt.tokens.json
untouched        leave   tokens/accent.graphite.tokens.json
untouched        leave   tokens/accent.indigo.tokens.json
untouched        leave   tokens/accent.jade.tokens.json
untouched        leave   tokens/core.tokens.json
untouched        leave   tokens/density.compact.tokens.json
untouched        leave   tokens/palette.tokens.json
untouched        leave   tokens/theme.dark.tokens.json
untouched        leave   tokens/theme.light.tokens.json
untouched        leave   tokens/zz-meridian.resolver.json
```

</details>

## Verify

Finalizing runs the project gate and one build. To check by hand first:

```
pnpm run gate
node node_modules/next/dist/bin/next build
```

## Changelog

The target release's changelog sections above 0.14.1:

```markdown
## [0.15.0] · 2026-10-13

### Added

- **Records, the first page template.** A page template arranges patterns for a kind of page, at layer 4: `Records` puts an optional row of summary tiles over a table with its toolbar, and marks its root `data-template="records"`. Templates live in `src/components/templates/`, are listed in the Atlas under Pages as `template-<folder>` with a real preview, and import no data, view, system or config module, so an adopted project receives them like any component. Pass the tiles as `summary` and the table as its children. It is `draft`: its loading, error, partial and read-only states are not specified yet.
- **The console's rail and palette take a navigation.** `ConsoleRail` and `ConsolePalette` take an optional `nav`: a product that draws other destinations than the `nav` in `src/app.config.ts` passes them, and they are drawn in their own groups and order, filtered by what `access` says the person may open, with a group left empty dropped and an empty list left empty. Without it both behave as before. `visible(only?, sourceNav?)` is the one filter both use. `ChromeAccess.viewAs` is now optional: a product with one session leaves it out and its menu has no View as group, where it used to have to pass an empty one and got an empty group for it. Nothing that passes `viewAs` changes.
- **Page loading is a card.** `LoadingPage`, `Busy`, `TilesSkeleton`, `ChartSkeleton` and `TableSkeleton`, the frame and the shapes every route's loading state is composed from, were a file of the sample under `app/`; they are now `@/components/patterns/page-loading`, listed in the Atlas at `/system/patterns/page-loading`, so an adopted project is given them and a template can use them. `TilesSkeleton` takes a `count` (three when it is left out). The sample's `app/(dashboard)/_loading.tsx` is gone and the dashboard's `loading.tsx` files, twelve of them now, import the card. A project made from an earlier release keeps its own copy of that file: an update writes the card beside it and changes neither the file nor the pages that import it.
- **The records template is `beta`: every state has a specimen, and it owns its loading arrangement.** `RecordsSkeleton({ tiles?, rows?, filters? })` is the arrangement while its data is on its way, composed from the page-loading card; Customers' `loading.tsx` and its page's fallback draw it, with the same markup as before. The preview adds Loading, Error, Partial (a figure that could not be worked out reads Unavailable and says why) and Read-only, and the template's spec gives each of the seven states one disposition, `Covered:` by a named specimen or `Inapplicable:` with the reason. `tests/atlas-template-contracts.test.tsx` holds the spec and the preview to each other, and `CONTRIBUTING.md` says a template owes this before it is `beta`.
- **Tickets, verification runs and releases are collections.** `tickets`, `tests` and `releases` join the sample's data with the shapes a small engineering team keeps: a ticket against a service with a priority, a state and an assignee; a run of a verification suite against one endpoint of one release; and a release with the verifications it requires before it can go. Every main role reads all three. Owner, Admin and Member create and change tickets; nobody removes one, and nobody writes a run or a release. A ticket is written only through one boundary, `ticketsFor(scope)` in `src/data/ticket-mutations.ts`, which the page's actions and the assistant's `create_tickets` and `update_tickets` both pass: it sets the id, the state `open` and both times itself, checks the service and the assignee against the collections, and allows only the five steps between open, waiting and closed. **Breaking for a project that pins its grant table:** every main role gains `tickets:read`, `tests:read` and `releases:read`, and Owner, Admin and Member gain `tickets:create` and `tickets:update`; add them to the pinned lists.
- **Operations tickets, the page a team works its tickets in.** `/operations-tickets` is a records page: three tiles count every open, waiting and closed ticket, and a table with search and filters for state and priority (kept in the address) shows each ticket's service, priority, state, assignee and how long ago it was opened and last changed. Anyone but a Viewer opens a ticket from `New ticket` and moves one along from its row's menu, which offers only the steps its state allows; a refusal comes back as a sentence inside the open form, which keeps what was typed. A Viewer sees every ticket and who has it, and a line saying who can write. The page, its tiles and the assistant's `tickets` view tool all read through `readTickets()` in `src/data/tickets.ts`, which joins each assignee's name on the server, so a reader who may not read members is shown the names and never the roster. `createTicket` and `updateTicket` answer a value, not a throw.
- **Tests and verification, and Releases: what ran and what is live.** `/tests` lists every verification run with its verdict, how long it took and, for a failure, why, and links each run to its release and to the requests of its endpoint. `/releases` shows which version is live for each service and environment, which releases are ready to go out and which are still in testing, and for those, which required verification has no run, failed or was skipped. Both are records pages, both are read by every role, and neither offers an action: nothing here reruns, deploys or rolls back. Three rules are worked out in one place, `src/data/verification.ts`, which pages, client views and the assistant's `tests` and `releases` view tools share: the latest run of a verification (the one that started last), what a release still waits for, and the live version. `readAll(name)` in `src/data/read.ts` reads every row of a collection, for a count or a join that must not be of a first page.
- **The coverage review of the whole sample is finished.** `docs/atlas-scenario-coverage.md` has a row for every job, page, pattern, chart and removal, each pointing at its Atlas entry and at the check that exercises it; it says what the review found and decided, and lists the files the work added, changed and retired. The contribution guide says that an example built for a named scenario in the product counts as the page that needs it, and that a wrapper made to fill a layer does not.
- **The product's workspaces are written down.** `docs/product-workspaces.md` is the guide to the sample as a product: its three workspaces and who each is for, where each of the thirteen destinations lives, how a page finds its workspace, who can do what, eight tasks to try, the three meanings of the word, how a product declares its own workspaces or none, and what the sample does not do. `docs/surfaces.md` gains layer 5 and the rows layer 4 was missing.
- **The sample's journeys run in a browser.** `journeys/workspaces.ts` walks the product as a person does, against a running build, and fails with the step that broke: from Main into a request's own page, through the rail's menu to Engineering, a ticket created there and counted by Main, a refresh, Back and Forward, a second independent browser, an address opened directly, the Atlas and its way back, the workspace already in view, an unsaved change that asks before leaving, a navigation that has not arrived, and a Viewer who enters every workspace, writes nothing and is given a way out of Members. It is the product's script, named under `browserChecks` in `scripts/verify.config.ts`, so `pnpm verify --full` runs it beside the audit; every name it looks for is read from `src/app.config.ts`, and a step whose pages a product has removed says `n/a`.
- **Leaving a form with unsaved changes asks first.** The shell exports `useUnsavedChanges(dirty)`, which a component calls to say it holds unsaved changes, and `useLeave()`, which answers `leave(go)`: `go` runs at once when nothing is unsaved, and otherwise only if the person chooses Leave in the "Leave without saving?" dialog. `FormSection` reports its `dirty` itself, so a page built from it needs nothing. While something is unsaved the shell holds a plain click on a link anywhere on the page, in the rail and in the drawer, before the link's own handler runs, and asks; Stay changes nothing, Leave goes to the link's address, query and fragment included. The Rail's menu, the command palette and a table row that opens an address go through `leave`, and a product that navigates from its own code should too. A link opened with a modifier key, in another tab or as a download is never held; closing or reloading the tab gets the browser's own warning; Back and Forward are the browser's and are not held. The question is a chunk of its own, fetched when a form first becomes unsaved, so no page pays for it on first load. `AppShell` now asks for the router: a test of yours that draws the shell with a stand-in for `next/navigation` needs `useRouter` in it.
- **The records template takes its summary as a fragment.** `summary` was an array of keyed tiles or one node; a fragment now counts as its children, so a page writes its tiles as it writes any other markup and the row still sizes its columns by their count.
- **The console's rail takes who is signed in as a value, and its waiting frame is exported.** `ConsoleRail` and `ConsolePalette` took `access` only as a promise a server layout resolves. A product that learns who is signed in in the browser passes the value itself, `access={chrome}` (`null` for nobody), and it is drawn at once; `RailPending`, the frame the rail holds while it waits, is exported from `src/views/console-chrome.tsx` for the product to hold meanwhile and to draw in the fallback of a boundary around the shell (#24).
- **`queryRows`, the meaning of a query, for a collection over a real store.** `queryRows(rows, key, query)` in `src/lib/collection.ts` filters, orders and pages a list as `where`, `sort`, `limit` and `offset` mean in the sample: a missing value matches only `ne` and sorts last, `contains` ignores case, `total` counts before the page is cut. `arrayCollection` calls it, and a collection that reads an API and filters in memory calls it too, where it had to copy the rules (#24).
- **`useSearchDraft`, for a search box over a view kept in the address.** It was a helper inside the Requests view; it is exported from the data table. The box shows each key, and the address is written once the typing has stopped for 250 ms, or at once when the search is cleared, so a word is one navigation and not one a letter. Customers, Operations tickets, Tests and verification and Releases use it now, as Requests did (#24).
- **`update` says which managed files are off the release.** A project already on the running version was told "nothing to update" whatever state it was in. It is now also given the managed files that differ from the release and are in no keep register, with what to do about them; nothing else looked between releases, so a product drifted silently and the next update met edits nobody had recorded a reason for (#23). The gate is unchanged: it does not fail on them.
- **A new project keeps the sample's workspaces only when they were asked for.** The skill told an agent to choose between keeping the three workspaces a created project starts with and taking them out. It now says which: keep them when the person asked for several places to look, take them out when they did not say (`references/customize.md`, "Navigation", has the steps). `create` itself still writes them.
- **A guide for a product whose data source signs in the person.** `references/existing-project.md` has "When the data source signs in the person, not the server": pages that read in the browser, where the boundary around a table with filters goes, the chrome given a value, and the assistant's route reading as the person. Beside "Adding the assistant" it now says what the layout's promise does to a page's HTML size, where a product's own assistant handoff is checked (a journey of its own) and where a product's own test setup goes (#22, #24).

### Fixed

- **The workspace menu offers only where a person may go.** The menu listed every workspace, whatever the person could open in it, and a workspace's row always opened its home: a person with nothing to open in a workspace was offered it and landed on a refusal, and one who could open its second destination but not its first was sent to the refusal first. A workspace is listed when the person may open at least one of its destinations, and its row opens the home or, when the home is not one, the first destination they may open. With one workspace left the rail has its account menu and no switcher. The sample's roles never showed it, since every persona has something in each workspace; a product with an operator-only workspace would have (#25).
- **A toast is announced once.** The stack was a polite live region and every toast in it has a role that is a live region of its own, so a screen reader read each message twice and a critical one both politely and assertively. The stack is no longer one (#23).
- **The rail's marker follows the link when the link moves without a navigation.** It was measured when the address changed and never again, so a rail that was resized, a font that arrived late or a group that changed height left the marker where the link had been. The list is observed and the marker measured again when its size changes (#23).
- **The first page of a visit does not animate in after a long wait.** The arrival is feedback that the page came, and a reader who has watched a skeleton for longer than the arrival lasts gets none from it, only a later page: on a slow phone the rise held a page's own text back by its whole length, and where that text was the largest paint it was charged to LCP. A first page that took longer to arrive than its arrival lasts (`dur-grow` plus `dur-enter`) is drawn where it ends; a quick first load arrives as before (#21).
- **A filter keeps a key in the address it did not write.** `useQueryState` rebuilt each write from the router's copy of the address, which holds only what the router wrote: a key another part of the page kept there with `history.replaceState` could be dropped by the next filter. It rebuilds from the address the browser is at (#22).
- **The assistant says where a change is made when a page makes it.** A collection that implements no operation, because its pages write through their own calls, had the assistant tell a person that nobody could add a record, with the form on the page. An operation named in `pageOnly` is said to be done on its page whether or not the collection implements it (#24).
- **`Prose` parses its text once per text.** It parsed its whole input on every render of its parent; it is memoised on its props, which are strings (#24).
- **The gate asks every console page what the agent reads, under whatever route group the project keeps.** `scripts/check.ts` and the sample detection in `scripts/lib/sample.ts` looked only under `app/(dashboard)`, so in an adopted project that kept its own group the rule matched nothing and the assistant walk-through found no sample page. Both follow the route group at the top of the app folder, by any name (#23).
- **The keyboard walk judges a stop once it has stopped moving.** It waited two frames after a key, and on a loaded runner the focus style painted later, so a skip link still sliding in was reported hidden. A stop is judged when its box has held for three frames, or after twelve (#23).
- **A page that fails CLS says what moved.** `scripts/vitals.ts` printed the number; it adds the three elements whose shifts sum highest (#24).
- **The weekly consumer check tests the releases it is given.** `cli/scripts/smoke.ts` updated a rebranded project to a fixed version 0.5.1, which `update` has refused as a downgrade since 0.5.2, and it expected `src/app.config.ts` unchanged by an update that, since 0.13.0, reports the migration whose edit the script itself then makes there. It updates to the patch after the running version and expects that edit.
- **A dashboard created from the package passes its own gate again.** Two things a created project was given failed there, and nothing in this repository ran as one: `tests/card-stage-hydration.test.tsx` imports a module the Atlas removal takes, so the project's type check failed on a file it was right to lose; and three tests of the workspaces (`tests/workspaces.test.ts`, `tests/workspace-access.test.ts`, `tests/workspace-chrome.test.tsx`) expected the Atlas's two navigation entries and the template's own name. `brand --no-atlas`, which every `create` runs, now removes every shipped test of a module it removes, and `tests/cli-atlas-prune.test.ts` holds that list against the tests; the three tests read whether the project has an Atlas, and its name from the configuration. Found by running the packed `create` and its verify, which the release workflow runs and a local gate does not.
- **A count opens the records it counts, and one definition says what has no owner.** Found by the final review's readers and its first sweep. Main's "Failing now" and the bell's "verifications are failing" count the latest run of each verification, and their link opened every failed run, the replaced ones too (1 counted, 2 listed in the sample): the Tests page gains a Runs filter, "All" or "Latest of each" (`runs=latest` in the address, and on the `view_tests` tool), and both links use it. The bell's alert for an unowned high-priority ticket opened every high-priority ticket; it opens the list on that ticket. A ticket whose assignee had been removed from the workspace read as unowned on the page and to the assistant, and as owned to the bell, which stayed quiet: `unownedTickets` in `src/views/tickets-context.ts` is now the one answer for all three. Operations drew only the newest unresolved incident while Main and the bell named every one: `readIncidents()` answers `open` beside `current`, and the page lists the others under "Also open". The Overview's context tells the assistant the Business region's other three figures (customers by status and by plan, and their thirty-day spend), which the page drew and the context left out. The Customers page reads every customer (`readAll`) for its tiles, not a first page of a hundred.
- **One address, one member.** Inviting an address the workspace already had wrote a second member with it. The member boundary (`src/data/member-mutations.ts`) refuses it, comparing addresses without their case: "Somebody with that address is already in the workspace." Found by inviting the same person twice in a browser; the behaviour is older than this work.
- **A release's phone row says what did not pass.** On a phone the Verification cell is one line, and it counted every required verification that had not passed as "waiting": a run that failed or was skipped read as one still to come. It now counts each kind, "1 of 2 passed, 1 failed" or "2 not run", from `unresolvedCounts` in `src/views/releases-context.ts`; the wide table already named each one, and the tile's definition and the line the assistant is told now say "has not passed" where they said "waits for". Found by a second independent look at the renders, with two sentences that claimed more than the product does: Settings no longer says the workspace's address is "used in links you share" (nothing builds a link from it), and Requests says it lists the most recent calls, which is what the sample holds. A second look at the guides corrected them against the code in thirteen places, among them what a new collection needs before anybody can read it (`customize.md`, "The assistant"), the columns a row of tiles takes, and which pages stay fresh without a reload.
- **Leaving asks once.** After a person answered "Leave", the shell still asked the browser to warn before unloading, so a move that ended in a full page load (a sign-out, an address the router hands to the browser) raised a second question. The guard stands down once Leave is chosen and stands up again with the next unsaved change.
- **A ticket action shows the person only a sentence written for them.** `createTicket` and `updateTicket` returned the message of any error; they now return the boundary's own refusal (`TicketRefusal`, exported from `src/data/ticket-mutations.ts`) and "The change did not go through." for anything else. Saving the workspace keeps the trimmed name in the field, as it is stored.
- **A browser check leaves a page that holds unsaved changes.** A page with unsaved changes asks the browser to warn before it unloads, and the warning waits for an answer. `scripts/lib/chrome.ts` had nobody to give one, so the next `open()` of any suite timed out after 30 s (measured on Settings with a typed-in name, once the shell began asking). The helper now answers that one question, as a check that opens another address has chosen to leave; an alert or a confirm a page raises itself is still met as it is.
- **A metric tile's note keeps the whole of itself when the tile cuts it.** The line where the change would sit (`note`, and the tile's own "No earlier period to compare") is one line with an ellipsis and had no title, so on a narrow tile the rest of the sentence could not be read at all. Found by the audit of the records template's Partial specimen, where "The error counter did not answer." was cut in a tile a third of a phone wide. A note that is text now carries its whole line in its title; a node the caller crafted is left to its author.
- **A record's page has a shell again, and so does every other route with a parameter.** `AppShell` called `usePathname()` at its top. Under Cache Components a route whose parameter the build did not know has no pathname until the request, and a component that asks for one waits; with nothing between the shell and the document, everything waited with it. The build's shell for `/requests/[id]` was **a file of 0 bytes**: no frame, no rail, no skeleton was prerendered for any record the build had not listed, which in a product is every record. An adopter whose layout put a `Suspense` above the shell got the other face of the same fault, that boundary's fallback and nothing else. The shell no longer reads the address: the drawer, the mark that holds a navigated page still and the rail each do, behind their own boundaries. The Atlas's shell did the same thing and so did its pages, and has the same fix. After: `/requests/[id]` prerenders **17.7 KB** (the frame and the page's skeleton), and all thirteen such shells in the build are non-empty. `scripts/route-policy.ts`, which `pnpm verify` runs after its build, now fails a route counted as partial whose shell for an unknown parameter is empty.
- **A key value list keeps a cut value whole, and counts its columns from its own width.** The card's spec has always said a long value truncates "with the full value in the title", and the component set none; and its two columns began at the window's 640px, though a card beside another is narrow in a wide window. At a 1024px window the request page's facts read "03 Oct …", "GET /v…", "Northwi…" and "us-eas…", each value about 50px wide, with the whole of it nowhere on the page. A value that is text now titles itself, a value drawn as a node takes the item's new `title`, and two columns begin at 640px of the list's own width. Found by the audit the first time it asked whether cut text is kept anywhere, which is also how the same omission turned up in `Breadcrumb`, `CopyField` (which titles what it shows: for a masked secret the mask, never the secret), the request page's trace, and three Atlas specimens. `KeyValue` also stopped dropping the hairline under the second-to-last row of a one-column list with an even number of rows.
- **`audit.ts --atlas` measures the Atlas, and says what it reached.** 0.14.0 widened it to "every entry the Atlas serves" by importing the Atlas's content module, which imports `server-only`, a marker only Next's bundler resolves. Plain Node cannot, the failure was caught, and the run went on with the cards alone: 142 of 172 routes, every token view, page spec and guide unvisited, and a last line that read the same either way. The entries are read through `scripts/lib/atlas.ts`, which resolves the marker and fails the run when the module cannot be read; the first line of a run says what it reached by kind, and `--list` prints the routes without opening a browser.
- **The audit sees three things it could not, and the Atlas is held to the vitals floor.** An SVG's text was exempt from the contrast pass (it is painted by `fill`, which a check that reads `color` cannot see); it is now measured by its `fill` against the page and every filled shape the SVG paints under it. Text cut with an ellipsis must keep the whole of itself in a `title`. And two things in the same place fail: two pieces of text whose glyph boxes share a third of a line, and a stroked line that runs through one. Each has a planted defect and a corrected twin in `scripts/fixtures/deep/`; the previous audit passed all six planted pages. Tried over every route before becoming failures: the product's 22 and the Atlas's 172 reported the defects above and three rules that were too wide (a clamp's hidden lines, a line scrolled out of a list, the text of a closed disclosure), each kept as a passing case. `scripts/vitals.ts` measures the Atlas's front page and one card page with everything else, and `--atlas` measures every entry: 101 of 101 under the floor, the worst LCP 0.92 s and the worst CLS 0.061.
- **The presses and the audit wait for the shell's late chrome, as the keyboard walk does.** The assistant's launcher arrives when the request's own work ends. The keyboard walk had been anchored to the page's own signal for it; the other two still waited a fixed time, and a suite that only counts or only looks does not fail when a control arrives late, it reports a page without it. Planted and measured: a dead control arriving 3.6 s after the page was never pressed and the run read `0 controls pressed … 0 issues`; an unnamed one arriving at 2.6 s passed the audit at five widths in both themes. The wait is one module, `scripts/lib/settle.ts`, and all three use it.
- **Every check measures at 1x, by hand and inside `pnpm verify`.** `scripts/lib/chrome.ts` opened a page at 2x unless `DPR` said otherwise while `pnpm verify` set 1, so one suite gave two answers for one page: a table 368px wide in a 356px frame at 2x that fits at 1x. The default is 1 everywhere, and `scripts/shot.ts`, whose pictures are for the eye, asks for 2 itself.
- **A page that arrived whole no longer empties while its code loads.** `Providers` read the stored appearance choices on mount as an ordinary update, and that update sits above every part of a page whose code arrives after the page does (a `dynamic()` component, a lazy panel). React answers an urgent update above such a part by discarding the server's HTML for it and drawing its Suspense fallback until the code is there, so the part vanished and came back. On the Atlas every card page did this: the specimen left, the specification jumped up the page and back, and all ten card pages sampled measured **CLS 0.30 to 0.61 against the 0.1 floor** on the phone profile (`/system/patterns/data-table` 0.500, `/system/patterns/trend-chart` 0.611). The read is a transition now, which waits for the part to hydrate first; the pre-paint script has already put the choice on the root, so nothing a reader sees is later. The card stage had the same fault from a second direction, for a reader in the light theme or with another accent: it learns the page's look as it hydrates, renders again at once, and was handing the specimen a new element under a pane keyed by the theme. The specimen is one element for the life of the stage and the single pane stays mounted. Measured after, same profile: **CLS 0.000** on the same pages, for the default reader, a reader in the light theme, and one with a stored theme, accent and density. An adopter's own `dynamic()` part under `Providers` was open to the first fault and is covered by the same change.
- **A check leaves no browser and no profile behind, however it ends.** Two faults in `scripts/lib/chrome.ts`, both measured before they were touched. A script ended by SIGHUP (a closed terminal), SIGQUIT or SIGKILL (a harness's timeout, `kill -9`) left a whole headless Chrome running under launchd: only SIGINT and SIGTERM were caught, and nothing can catch a kill. A thrown error, a rejection and `process.exit` were already clean. And every check, on its ordinary way out, left its profile: the removal was started in the background and `page.close(); process.exit()` ended the process before it finished, so three runs left three profiles and two days of checks left 590 of them, 29 GB, in the temp folder. The four ending signals are caught; a small shell watches the script and kills the browser once the script is gone, and only a process whose command line still names that browser's own profile; and a removal still under way at exit is finished there. After: nine endings, none leaves a browser, and three close-and-exit runs leave no profile.
- **A live stream's open is one read, not two.** The client reads every collection when its stream opens, and the stream's first frame is always a `resync` of every collection; `src/lib/live.ts` answered both, so every open read everything twice. Measured on a built app, a cold load of `/`: **two** refresh actions and **two** router reads of the page, where one of each is the design. The first frame on a stream is now taken as the read the open already began; a `resync` that arrives later is the server reporting lost hints and is still read. After: **one** action and **one** router read. What this does not change, and what an earlier note misread as "the hidden phone drawer prefetches too": four rail routes still have their `/_tree` prefetch sent twice on a cold load. The drawer is not in the document while it is closed and a desktop page holds one link per route; the second request is Next prefetching its visible links again after the router read that the open makes, and it stays, inside the prefetch budget, for as long as an open reads.

### Changed

- **Requests, API keys and Members are built from the records template.** Their bodies were three hand-made stacks of the same arrangement; each is now `Records`, and each waits for its data in `RecordsSkeleton`. Nothing a reader sees changes, loaded or loading. API keys and Members keep their masthead in the view, because its button shares state with the sheets below it.
- **Customers works out its figures once.** The number of customers, their thirty-day spend and who is past due were added up twice, once for the tiles and once for what the assistant is told. `customerFigures(rows)` in `src/views/customers-context.ts` is now the one calculation both take, so the two cannot differ.
- **The sample's Health item no longer carries a count somebody typed.** `badge: '1'` sat in `src/app.config.ts` and said one incident was open whatever the incidents were. The Rail still draws a `badge` a product passes; pass one worked out from data.
- **The Atlas has six layers.** Layer 5, Product workspaces, is the product's guide, served at `/system/products/workspaces` and listed in the shelf under a 5. In layer 4 a page template is told from a page built on it: the shelf marks a template, an article names its layer ("Layer 4 · Page template" or "Layer 4 · Page"), a template lists the pages built from it, and a page links its template. The front door draws six layers and counts templates and pages apart. No address changed. `src/system/content.ts` gains `layerOf(entry)`, the kind `template` and an optional `template` on a page; a project that removes the Atlas now removes `tests/atlas-layers.test.ts` with it.
- **When traffic comes and where it comes from are rows.** Analytics' weekday-and-hour heatmap, its hours of the day and its regions were three constants returned behind a check of `requests:read`. They are now rows of two read-only collections, `hours` (168 rows) and `regions`, served to the tenant and asked under two new grants, `hours:read` and `regions:read`, which every main role holds beside the other dashboards' and which the Analytics page's need names in place of `requests:read`. A project that pins its own grant table adds the two grants to the roles that read Analytics. `analyticsFigures()` asks both and takes the tenant's own rows; the numbers Analytics draws are unchanged, and they are still the sample's own fixed shapes, not worked out from the request log. `demoHeatmap`, `requestsByHour` and `REGION_LATENCY` are no longer exported from `@/data/sample`: a page of yours that imported them reads the collections.
- **Settings shows nothing that nothing stands behind.** The sample's Settings loses its list of connected hosts with Disconnect, its Notifications section, the "Let assistants read dashboards" switch and its Danger zone with Delete workspace. The hosts and the switches kept their state only in the page, the sample sends no notification, and Delete workspace reported a deletion that never happened. Agents and MCP keeps the statement that every change an assistant proposes waits for approval. With the deletion go the things that existed only for it: the `delete-workspace` action, the Owner's `workspace:remove` grant, the `workspace` collection's remove operation and `workspaceRemove` in `SettingsMay`; `CONNECTED_HOSTS` is no longer exported from `@/data/sample`. A project that copied any of these keeps its own copy and loses nothing; one that really deletes a workspace adds the action, the grant and the operation with the record behind them. `scripts/verify.config.ts` finds `/settings` ready by the theme choice, where it looked for a switch.
- **Analytics opens with the period's four figures.** Business's home showed when traffic comes and from where, and neither spend nor a comparison. It now opens with Requests, Error rate, Latency p95 and Spend for the period chosen, each with its change against the period before and its daily shape, from the totals the Overview reads and under its labels (`OVERVIEW_METRICS`); one Meridian covers the page, so a day pointed at in a trend is read in the four figures, and the assistant is told the same four with the figure each is measured against. `AnalyticsData` gains `totals`, and the loading state gains four tiles.
- **The sample claims a period only for what follows it.** The weekday-and-hour heatmap, the regions, the endpoints and the Overview's response split are fixed figures, the same whatever the period. Analytics said they were "summed over the period" and "in the period", its context told the assistant so, and the Overview's cards and one of its findings said "in the period" and "the period's errors". The pages now claim no period for them, and Analytics' context says that they do not follow the one chosen.
- **Three more controls that reported what did not happen are gone.** Customers' Invite customer validated a form, said "Invitation sent" and wrote nothing; Operations' Subscribe to updates said updates would go to an address and kept nothing; the request's menu item Revoke the key only opened API keys, and is now Open API keys. `InviteCustomer` is no longer exported from `src/views/customers.tsx` and `SubscribeButton` from `src/views/health.tsx`; a page of yours that draws either keeps its own copy, with something behind it. Customers' two tiles lost a sparkline worked out from request trends by a constant: a tile draws a trend only where a series stands behind it.
- **The workspace record holds a name and an address, and the name has a reader.** Settings saved a time zone that nothing read (every date is cut on `app.timezone`) and a name it said the rail showed (the rail shows `app.name`). The time zone is gone from the Workspace section, from the `workspace` collection's fields, from `saveWorkspace`'s input and from `@/data/sample` (`TIMEZONES`). The Members page reads the record's name for a person who may read it and hands it to `MembersView` as `workspace`; the invitation sheet names the workspace by it, and no longer says an email is sent. Inviting writes a member with the status Invited and delivers nothing, so the sheet's button is Invite, its confirmation is "Invited {email}" with a line saying the member is listed as Invited, and a refusal's banner is "Not invited"; `scripts/live.ts`, which invites through the sheet, looks for the new words. Operations says its incidents were resolved in the last 90 days, where its context said "in the period" on a page with no period, and its navigation check in `scripts/verify.config.ts` points at the strip of days, since the masthead has no button. Settings' Address says it is not changed there, for everyone.
- **The guides describe the dashboard as it is.** The skill's customising guide says how a list page is arranged from the records template and its loading arrangement, where the page-loading shapes live, how a product declares workspaces (and that one navigation needs none), that the address alone decides the workspace, how a form reports unsaved changes to the shell, how a product writes its own alerts read, and what a copied sample page does not do. The skill, the adopter's guide and the starting guide no longer describe a layout that imports a clock and a typed list of alerts, a "health" page, or a context budget of 2,400 characters (it is 2,600). A project made by `create` starts with the sample's three workspaces, and the guide now says so and gives the two ways forward, keeping them or taking them out, with the list of what goes with them (run in a created project, whose checks pass after it). Also corrected against the code: `references/update.md` gains the `nav-needs` migration, whose own instruction named a section of the Start guide that does not exist; removing the Atlas from a clone is `node scripts/brand.ts --no-atlas`; `docs/surfaces.md` describes the Overview, Analytics, Requests and Settings as they are and lists Page loading; a Data table becomes cards under 640px of its own width, not below 768px of the window; `Freshness` takes a `Date`; `--workspace` names the environment line, not a navigation workspace; and what `needs: 'public'` means, which `adopt` writes. A project's own gate reads the installed skill and fails on a path the project does not have, so `tests/cli-skill-layouts.test.ts` now holds every path the skill names against what `create` leaves and what `adopt` gives: two paths written without `optional:` passed every check here and failed both consumers.
- **The sign-in page offers only what signs somebody in.** Its second panel took a work email, waited, and said "Check your inbox. We sent a sign-in link", and its SSO button said it was opening a company's sign-in; nothing was sent and nothing was opened, and the panel promised a free first workspace and named terms the product does not have. `SignInPanel` is removed from `app/sign-in/panel.tsx`. The page keeps the one way in that works, the people the console can be opened as (or the password panel when `DEMO_PASSWORD` is set), and says "Sign in as" and "Sign in" where it said "Open the demo". A product that emails a link or asks an identity provider adds that form with the action behind it. On a phone an unassigned ticket reads "Assigned to nobody", the word its table uses, and the sample's activity no longer names a workspace called "Workspace".
- **The Shell's preview asks the shell's own leave question.** It drew a copy of the dialog by hand; a button now opens `LeaveQuestion` itself, and the frame's drawing is labelled a diagram.
- **The Rail's preview draws the Rail.** Its hand-made list of item states is gone: the specimens are the real component, so rest and current are drawn in them and hover and focus are seen by using them.
- **Six layers, counted the same everywhere.** The README, the contribution guide, the package's description and the header of the generated tokens count six layers, numbered 0 to 5; the sixth, Product workspaces, is how a product is assembled from its pages, declared in the configuration and written down in its guide.
- **The sample's navigation is three workspaces, declared once.** `src/app.config.ts` exports `workspaces` (Main, Business and Engineering, each with a label, a sentence saying who it is for, and the entry it opens at) and each `nav` entry names its owner in an optional `workspace` field; `nav` is three groups with no label, one for each workspace, where it had `Operate` and `Workspace`. `src/views/workspaces.ts` derives each workspace's navigation from that one list and answers which workspace an address belongs to, from the address alone. A workspace is where a person looks, never what they may do: access is still each page's feature. Your own `src/app.config.ts` is yours and is not touched by an update; a navigation without the field compiles as before.
- **The sample's rail and palette follow the address into a workspace.** `src/views/workspace-chrome.tsx` is the product's adapter over the console chrome: `WorkspaceRail` and `WorkspacePalette` draw the destinations of the workspace the address is in, under its name, and the rail's menu goes to Main, Business or Engineering by opening that workspace's home; choosing the one in view does nothing, so a page and its filters stay. Nothing but the address says which workspace is in view: no cookie, no storage, no query. `ConsoleRail` and `ConsolePalette` are unchanged, and a product with one navigation keeps using them as it does.
- **A page a person may not open offers a way out.** `NoAccess` in the sample draws one link, to the first destination of the page's own workspace that the person may open, or to Main's home; it still says who can open the page and whom to ask.
- **The Atlas links back to the product by workspace.** Its shelf's foot had one link, "Open the template"; it now has "Back to Main" and a link into each other workspace.
- **Main's Overview summarises the whole product.** Below the traffic story the page has three quieter regions: Business (customers, how many of each status and plan, thirty-day spend), Operation (the services that are degraded or out and every unresolved incident, or that all is well) and Delivery (open and waiting tickets, failing verifications, and live, ready and in-testing releases). Every figure is of the whole collection and is worked out by the function its own page uses, so the two cannot differ; a figure whose page has a filter for it opens the list it counts. A region whose read fails says it is unavailable and the rest of the page still draws. The Overview's need now names every collection it reads, and the assistant is told the same figures under the labels their pages use. Each workspace's home says who the workspace is for, in its masthead.
- **The sample's page at `/health` is called Operations, as its entry is.** Its title, its loading state, its context, its view tool's title, its embed and its row in the Atlas say Operations; the address, the feature id and the tool's name do not change. A test or a script of yours that looks for the sample's title Health looks for Operations now.
- **`adopt` writes a configuration without the sample's workspaces.** A project that adopts Meridian gets its own pages as its navigation and none of the sample's workspace declaration; the function that writes it (`projectConfig`) is now tested on its own, where only the packed smoke ran it before.
- **The shell's alerts are worked out from reads.** The sample's bell showed a list somebody typed. `readAlerts()` in `src/data/alerts.ts` now tells every unresolved incident, every customer past due, how many verifications are failing and every high-priority ticket nobody has, by the functions the pages themselves use, each linked to the page that handles it; the layout hands the read to `ShellAlerts` unawaited, so the frame never waits for it, and a person who may not be told anything gets the tools with no alert. `src/data/sample.ts` no longer exports `ALERTS`: a product writes its own `readAlerts`.
- **The browser checks follow a rail that shows part of the navigation.** `scripts/navigate.ts` and `scripts/perf.ts` start each journey from the nearest route, in rail order, whose rail draws a link to the destination, and report a destination no other route's rail links to as a problem, never a pass; `scripts/rail.ts` reads the rail on every configured route no rail has linked to yet, so `pnpm verify --as` holds a persona against all of their routes; the assistant walk-through follows only links that are on screen. A product whose rail shows every destination on every page is measured exactly as before. In `scripts/navigate.ts`, `drawerRoutes` now answers `{ starts, drawn }` and `startFor` takes what each rail draws as a fourth argument.
- **The two write boundaries share their queue and their invalidation.** `src/data/write-boundary.ts` holds `writeQueue(name)` and `invalidate(tag)`, which the members boundary had to itself and the ticket boundary would have copied.
- **The Rail's page in the Atlas shows the rail, not a drawing of its menu.** Two of its specimens were a menu panel drawn by hand, because a menu mounts only while it is open. They are now the real rail: open the top row to see the account menu with one workspace, the switcher and its Show group with several (choosing one moves the check and the line under the product name), and the View as group with its personas. `brand --product` removes the test that holds this, as it removes the previews.
- **The Assistant card is `beta`, as it ships.** It was the one card still marked `draft` ("being specified; do not build from it") while the template shipped it, its spec covers every state and surface, and `pnpm verify --full` walks it in 23 steps. `stable` stays unused: it promises that changes are recorded per card and follows a review of each, which nobody has done.
- **The Prose card says where to render it, and what the other choice costs.** Prose has no client code of its own: rendered from a Server Component it costs a page no JavaScript, and imported into a client component it brings its renderer, a 143 KiB chunk a reading page then waits for before its text can paint. An adopter's document pages were reported at LCP 2.88 to 2.95 s that way. Nothing in the template does this (the one browser-side use is the assistant's panel, fetched when it is opened, and no prerendered page references the chunk), so this is a guide, in the card's spec: render Prose in the server page and pass it to a client view as `children`.
- **The default gate's tests cost a third of what they did.** Every test file started a process and a jsdom of its own, and that start was most of the tests' cost: 79 s of CPU for the 141 files `pnpm verify` runs, at the four workers the release runner has. `vitest.config.ts` now sets `pool: 'vmThreads'`, so a file is still a world of its own, as a context in a shared worker: 27 s of CPU, and 8 s on the clock where it was 20, with the same 698 cases passing. `tests/setup.ts` gives a jsdom context the web streams the assistant's client needs. The one test that waited 30 s for a browser that never answers is a test of the checks themselves and is now `tests/deep-chrome-cleanup.test.ts`, with the others no project is given. A project made earlier keeps its own `vitest.config.ts`; adding `pool: 'vmThreads'` to it is the whole change.

### Breaking

Three changes need a line from anyone updating a project. Each says what to do instead.

- **`resetCollections` is no longer exported from `src/lib/collection.ts`.** Nothing called it. A test of yours that did builds its collection with a tenant of its own, as the template's tests do.
- **The gate asks every page under the app folder's route group what the agent reads.** `scripts/check.ts` asked only under a folder named `(dashboard)`. In an adopted project that kept its own group, such as `app/(dash)/`, each page specification there is now asked for `### What the agent reads` under `## Agents`, as `references/customize.md`, "A page spec", describes. An update reports it as the `agent-reads-own-group` migration, naming the specifications that lack the part, so the project is told before its gate fails. A project that repeated the rule in `scripts/check.local.ts` for its own group can delete that copy.
- **The sample's helpers that did nothing are gone from the template.** `InviteCustomer`, `SubscribeButton`, `TIMEZONES` and `SignInPanel` are no longer in the sample's views, data and sign-in page, and `useSearchDraft` is exported from `src/components/patterns/data-table` and no longer from `src/views/requests.tsx`. These files are a project's own once it is created, and an update never touches them, so a created project keeps its copies; a clone of the template that imported any of them drops the import, or imports `useSearchDraft` from the data table.
```


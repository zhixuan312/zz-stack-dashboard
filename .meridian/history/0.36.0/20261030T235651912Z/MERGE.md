# Update 0.28.0 to 0.36.0

- Source: 0.28.0
- Target: 0.36.0
- Route: adopt
- Session: 20261030T235651912Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.36.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.36.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.36.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:app-description

The product describes itself in one sentence: `description` in the `app` object of `src/app.config.ts`.

Paths: `src/app.config.ts`

The release's `app/layout.tsx` shows `app.description` as the document's description — the line a search engine and a link preview put under the name — where it used to write a sentence of the template's own. `src/app.config.ts` is yours and an update does not touch it, so the key is missing there until you add it. Add `description: '<one sentence about your product>',` to the `app` object beside `name`. A project that keeps its own `app/layout.tsx` needs the key all the same, because the layout a project brings over from the release reads it.

Checks:

- `gate`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:app-description",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/app.config.ts": "sha256-004dfed93b0c24f6b7d7c97c78c7f2cfb78851332111fd6cca04e12fb914f51a"
  }
}
```

### migration:missing-routes

A route that answers an error or draws the not-found screen fails every browser suite unless it is declared in missingRoutes.

Paths: `scripts/verify.config.ts`

The audit, the presses, the keyboard walk, the vitals and `scripts/shot.ts` now read what a route answered: one that answered an error status or draws the not-found screen (`[data-missing-page]`) was measured as that screen and not as the route, so it fails. In `scripts/verify.config.ts`, which is yours, move every entry of `detailRoutes` that names a record that does not exist (the sample's `/requests/req_missing` and `/customers/missing`) into a new `missingRoutes` list; each must be the not-found screen, and one that renders a page fails. A not-found screen of your own carries `data-missing-page` on its root, as `MissingPage` does: inside a streamed shell a missing record has already answered 200.

Checks:

- `verify`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:missing-routes",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/verify.config.ts": "sha256-85dd7727471582c96dfc0c8ac542954a3d8b67f3f87a04eff25d789d19af6408"
  }
}
```

### migration:self-hosted-fonts

Meridian's faces ship with the release under `src/styles/fonts/`: a build loads them from there and fetches nothing from Google Fonts.

Paths: `app/layout.tsx`

Your `app/layout.tsx` is yours, so an update does not touch it, and yours hands `--font-face-sans` and `--font-face-mono` their faces through `next/font/google`, which `next build` fetches from fonts.googleapis.com: with that host unreachable and no build cache, the build fails (`Build error occurred`). The update has delivered the two faces, `src/styles/fonts/Geist-Variable.woff2` and `src/styles/fonts/GeistMono-Variable.woff2`, with their licence. In the layout, replace the `next/font/google` import with `import localFont from 'next/font/local';` and each face's call with `localFont({ src: '../src/styles/fonts/Geist-Variable.woff2', weight: '100 900', variable: '--font-face-sans', display: 'swap' })` and `localFont({ src: '../src/styles/fonts/GeistMono-Variable.woff2', weight: '100 900', variable: '--font-face-mono', display: 'swap' })`, keeping the class names on `<html>` as they are. A layout that gives the tokens faces of its own from Google Fonts is the same case: ship the files and load them with `next/font/local`.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:self-hosted-fonts",
  "status": "resolved",
  "reason": "",
  "files": {
    "app/layout.tsx": "sha256-eb32de2f67e796ddf503cee3f243470efcd9a34c8b567980cbf77dd195176916"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `app/layout.tsx`
- `scripts/verify.config.ts`
- `src/app.config.ts`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 16
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 66
- untouched/write: 126

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        write   .agents/skills/zz-meridian/references/agents.md
untouched        write   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
untouched        write   .agents/skills/zz-meridian/references/data-layers.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        write   .agents/skills/zz-meridian/references/live.md
untouched        write   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        write   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        write   .agents/skills/zz-meridian/references/voice.md
untouched        write   .claude/skills/zz-meridian/SKILL.md
untouched        write   .claude/skills/zz-meridian/references/agents.md
untouched        write   .claude/skills/zz-meridian/references/cache.md
untouched        write   .claude/skills/zz-meridian/references/customize.md
untouched        write   .claude/skills/zz-meridian/references/data-layers.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        write   .claude/skills/zz-meridian/references/live.md
untouched        write   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        write   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        write   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        write   scripts/ask.ts
untouched        write   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        write   scripts/fake-llm.ts
untouched        write   scripts/gate.ts
untouched        write   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
added            write   scripts/lib/answered.ts
added            write   scripts/lib/args.ts
untouched        write   scripts/lib/atlas.ts
untouched        write   scripts/lib/bin.ts
untouched        write   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
added            write   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        write   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        write   scripts/lib/coverage.ts
untouched        write   scripts/lib/data-url.ts
untouched        write   scripts/lib/deep.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        write   scripts/lib/journey.ts
untouched        write   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
added            write   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
untouched        write   scripts/lib/phone.ts
untouched        write   scripts/lib/routes.ts
untouched        write   scripts/lib/sample.ts
untouched        write   scripts/lib/settle.ts
untouched        leave   scripts/lib/shard.ts
untouched        write   scripts/lib/sizes.ts
untouched        leave   scripts/lib/slots.ts
added            write   scripts/lib/team-config.ts
untouched        write   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        write   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        write   scripts/rail.ts
untouched        write   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        write   scripts/shot.ts
untouched        write   scripts/sizes.ts
untouched        leave   scripts/tokens.ts
untouched        write   scripts/verify.ts
untouched        write   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        write   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        write   src/components/charts/bar-list/index.tsx
added            write   src/components/charts/bar-list/levels.tsx
added            write   src/components/charts/column-chart/grouped.tsx
untouched        write   src/components/charts/column-chart/index.tsx
added            write   src/components/charts/column-chart/shared.tsx
untouched        write   src/components/charts/composition-bar/index.tsx
added            write   src/components/charts/diverging-bars/index.tsx
untouched        write   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        write   src/components/charts/scale.ts
untouched        write   src/components/charts/sparkline/index.tsx
untouched        write   src/components/charts/trend-chart/index.tsx
untouched        write   src/components/charts/uptime-bars/index.tsx
added            write   src/components/charts/use-settled.ts
untouched        write   src/components/charts/use-size.ts
untouched        write   src/components/patterns/activity-feed/index.tsx
untouched        write   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        write   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        write   src/components/patterns/command-palette/index.tsx
untouched        write   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        write   src/components/patterns/detail-head/index.tsx
untouched        write   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        write   src/components/patterns/featured-metric/index.tsx
untouched        write   src/components/patterns/filter-bar/index.tsx
untouched        write   src/components/patterns/form-section/index.tsx
untouched        write   src/components/patterns/freshness/index.tsx
untouched        write   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
untouched        write   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        write   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/index.tsx
untouched        write   src/components/patterns/rail/index.tsx
added            write   src/components/patterns/rail/trail.ts
untouched        write   src/components/patterns/shell-tools/index.tsx
untouched        write   src/components/patterns/status-list/index.tsx
untouched        write   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        write   src/components/ui/avatar/index.tsx
untouched        write   src/components/ui/badge/index.tsx
untouched        write   src/components/ui/banner/index.tsx
untouched        write   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        write   src/components/ui/card/index.tsx
untouched        write   src/components/ui/checkbox/index.tsx
untouched        write   src/components/ui/copy-field/index.tsx
untouched        write   src/components/ui/delta/index.tsx
untouched        write   src/components/ui/dialog/index.tsx
added            write   src/components/ui/disclosure/index.tsx
untouched        write   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        write   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        write   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        write   src/components/ui/pagination/index.tsx
untouched        write   src/components/ui/popover/index.tsx
untouched        write   src/components/ui/progress/index.tsx
untouched        write   src/components/ui/radio-group/index.tsx
untouched        leave   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/index.tsx
untouched        write   src/components/ui/select/index.tsx
untouched        write   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        write   src/components/ui/status-dot/index.tsx
untouched        write   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        write   src/components/ui/tabs/index.tsx
untouched        write   src/components/ui/textarea/index.tsx
untouched        write   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/csv.ts
untouched        write   src/lib/explore.ts
untouched        write   src/lib/facts.ts
untouched        write   src/lib/format-date.ts
untouched        write   src/lib/format.ts
untouched        write   src/lib/host.ts
untouched        leave   src/lib/insight.ts
untouched        write   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        write   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
added            write   src/lib/sort.ts
untouched        leave   src/logic/after-start.ts
untouched        write   src/logic/derivations.ts
untouched        leave   src/logic/summarise.ts
untouched        write   src/styles/base.css
added            write   src/styles/fonts/Geist-Variable.woff2
added            write   src/styles/fonts/GeistMono-Variable.woff2
added            write   src/styles/fonts/LICENSE.txt
untouched        leave   src/styles/motion.css
untouched        write   src/styles/theme.css
untouched        write   src/styles/tokens.css
untouched        leave   src/views/console-chrome.tsx
untouched        write   tests/setup.ts
untouched        leave   tokens/accent.brand.tokens.json
untouched        leave   tokens/accent.cobalt.tokens.json
untouched        leave   tokens/accent.graphite.tokens.json
untouched        leave   tokens/accent.indigo.tokens.json
untouched        write   tokens/accent.jade.tokens.json
untouched        write   tokens/core.tokens.json
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

The target release's changelog sections above 0.28.0:

```markdown
## [0.36.0] · 2026-10-30

A pass over the whole template and the CLI. `verify` no longer takes a remote IPv6 backend or a schemeless DSN with an `@` for local, and the demo gate's persona survives a browser restart. `update` reads a team's own files through the project's tsconfig aliases, reads a `NavItem` type whole, and names the sample files a release's tests no longer pass. Cards and the Atlas hold at 320px, and `audit --atlas` measures it. Many smaller behaviours are corrected below. The breaking changes come first; each says what to do instead.

### Breaking

- **The API keys actions answer a result instead of throwing.** `createKey` returns `{ ok: true, key } | { ok: false, error }` and `revokeKey` `{ ok: true } | { ok: false, error }`, as every other action of the template does, because a production build replaces a thrown action's message with a generic one, and the reason ("Give the key at least one scope.", a lost permission) never reached the person. A page that passes its own actions to `KeysView` returns those shapes instead of throwing.
- **The error screens take Next's `retry`, not `reset`.** `app/(dashboard)/error.tsx` and `app/embed/error.tsx` call `retry`, which fetches the page again; `reset` re-rendered the payload that held the failed read, so Retry drew the same error. A caller that renders `DashboardError` itself passes `retry`.
- **A `NavItem` type declares `under` and `prefetch`.** The rail and its trail read both on every item; they tested for each with `in`, so a project whose own `src/app.config.ts` lacked them compiled. `update` reports `migration:nav-item-fields` for such a type: add `prefetch?: true; under?: string` to it.
- **A `Progress` without a `label` requires `aria-label`.** A bar with no label row, as `sm` in a table cell, was an unnamed progressbar and had no way to be named; one without either is a type error.
- **`PopoverContent` requires a name.** Pass `aria-label` or `aria-labelledby`: a Popover's content is a dialog, and Radix gives it no name of its own, so a screen reader announced an unnamed dialog. A Popover without either is a type error.
- **A server-paged `DataTable` (`manual`) draws no rows-per-page menu.** Its page size is the server's, so the menu changed nothing the server sent; pass `pageSize`, and drop a one-item `pageSizes` kept only to hide the menu.
- **`totalsOf` and `Totals` live in `@/lib/totals`.** A period's totals were computed in `src/data/metrics.ts` and again by the sample's fixtures; the one pure function moved, so a logic file can total a period without importing a reading module. Import both from `@/lib/totals`; `@/data/metrics` and `@/data/sample` no longer carry them.
- **`.meridian/manifest.json` lists its files by code unit.** `create`, `adopt`, `update` and the brand step each sorted it with their own copy, one by the machine's collation; the next `update` or brand rewrites an existing manifest once in the new order, a reordered diff with no change of content.
- **`requestContext` takes `payloadChars`**, not `payloadBytes`: the sizes were always string lengths, and the context prints them as characters.
- **`memberAccess` takes every row's id and answers by id.** The Members page asked it once a row, and each ask re-resolved the caller and read the roster twice; `memberAccess(ids)` resolves the caller once. Call `memberAccess(members.map((m) => m.id))` and read `access[id]`.
- **The template's server actions answer one `ActionResult`, from `@/lib/collection`.** The members, settings, tickets, keys and replay actions each declared the same `{ ok: true } | { ok: false, error }` under four names, one of them exported by a client view; `Result` (from `@/views/members`), `TicketResult`, `KeyResult` and `ReplayResult` are gone. Import `ActionResult`, and pass what the action hands back as its parameter (`ActionResult<{ id: string; status: number }>`). `@/views/requests` no longer re-exports `REQUEST_METHODS`; import it from `@/data/request-methods`.
- **`VIEW_AS_COOKIE` lives in `@/lib/demo-gate`**, beside the session cookie it is now renewed with, so `proxy.ts` can name it without loading the data layer. Import it from `@/lib/demo-gate`; `@/data/access` no longer exports it.
- **`workspaceHomes` lives in `scripts/lib/journey.ts` and takes the command's arguments.** `scripts/perf.ts` read it from `scripts/navigate.ts`, and so took `--homes` through another command's argument list; import it from `scripts/lib/journey.ts` and call `workspaceHomes(process.argv.slice(2))`. `update` reports a file that imports it from `scripts/navigate.ts` as `migration:workspace-homes-moved`.

### Added

- **`AssistantPanel` takes `draft` and `onDraft`**, so the column keeps an unsent message across a close; without them the panel keeps its own.
- **The command palette exports `usePaletteKey()`**, its keystroke as the reader's keyboard names it (`⌘K` or `Ctrl K`), for a page that shows the shortcut.
- **Badge exports `TONE_FILL`**, the one tone-to-fill map, which Progress now reads.
- **`page-loading` exports `LinesSkeleton`**, a card of lines under a title, four unless told; Home, Revenue and Now each drew their own.
- **`page-loading` exports `FeaturedSkeleton`**, the Featured metric's loading shape, `beside` when three tiles stand beside it; five loading pages drew their own copy.
- **`@/lib/format` exports `inWords`**, a list in a sentence ("a, b and c"), which the Now, Home and fact contexts and the no-access page each wrote; the Customers past-due tile reads it too, so two customers are "Brightline and Acme", not "Brightline, Acme".
- **`@/logic/derivations` exports `MOST_PARTS`**, the most parts a stacked chart draws before it folds the rest into one, which the Composition bar now folds at as the Column chart does.
- **`Sparkline` takes `format`**, the figure's own formatter, which its range title reads; without it the range is a count.
- **`@/lib/sort` exports `compareValues`**, a managed helper like the rest of `src/lib/`, the order a `DataTable` sorts a column by (text by a collator, case and accents aside, numbers inside text by value); the Customers context lists its rows in it, so a name in lower case sits where the table shows it.
- **`src/lib/collection.ts` exports `p95(values)`**, the nearest-rank 95th percentile a prepared query's `p95` answers; the Requests tiles read it too.
- **`src/lib/collection.ts` exports `storedRows(tenantId, name)`**, the rows a tenant's array collection keeps in this process, for a test that grows one past a page; `read-every-row` and two other tests used a copy of the store's private key and shape.
- **`@/lib/format` exports `changeOf` and `capitalise`**: a change against the figure before as a fraction (null against none or zero), and a word as a label starts. Home, Revenue and Usage each wrote the first, Releases, Tests and Tickets the second.
- **The MIT licence text ships.** The package carries it as `payload/LICENSE`, and a project `create` makes gets it as `LICENSE`; before, both manifests said MIT and no text existed.
- **A persona in `scripts/verify.config.ts` takes `pressRoutes`**, the routes `verify --as` presses as that person. The leg pressed four of the sample's routes written into `verify.ts`, so a product whose role-dependent pages are others had none of them pressed; a persona without the field now has every route it expects pressed. The template's personas name the sample's four.

- **`update` names a created project's sample files that the release's tests no longer pass.** A project `create` made holds the sample (its pages, views, data, figures, their helpers and the demo gate in `proxy.ts`) as its own files, which an update never touches, while the shipped tests that pin them arrive with it; this release changed both, so an untouched sample failed its own gate after the update (33 tests in 17 files from 0.35.0). The update now reports `migration:sample-with-its-tests` with each sample file that differs from the release's, and `src/lib/totals.ts`, which the release added. The sample footer's Design system link now follows the navigation's `/system` entry instead of being cut out by the brand step, so a footer nobody changed matches the release's.
  - **What a team does.** Write the release's copies with `npx zz-meridian@<version> create <scratch folder> --no-install` and copy each named file your team never changed, and each added module, over your own; for a file you made your own, change the shipped tests that pin it, or delete them and name them in `.meridian/keep.json`.

### Changed

- **Shipped tests that held only the sample's own records are Meridian's own now**, as the sample's figures already were: `tests/logic-layer.test.ts`, `tests/logic-alerts.test.ts` and `tests/moved-paths-documented.test.ts`, the record of a finished move whose rules a project keeps through `scripts/check.ts`'s four layers; `tests/sample.test.ts` and `tests/sample-company.test.ts`, the sample company's records; and `tests/bypasses.test.ts`, its collections. An update removes a copy nobody changed.
- **Shipped tests read the project's own navigation, pages, tools and personas** where they counted or named the sample's: the gated pages, the view tools, the personas `verify --as` names, the rail's first destinations and the not-found page's nearest entry. The facts' configured band and thresholds are no longer pinned, and the customize guide gives the command that lists every shipped test holding the sample's people, fixtures, pages or views, and names six more with what each holds.

- **A created project's test helpers are Meridian's, like the tests that import them.** `tests/served.tsx` (a page as served, every boundary resolved) and `tests/explore-io.ts` (a prepared query's reads from rows in memory) replace copies eight shipped tests each wrote for themselves; `update` delivers them with the tests.

### Fixed

- **Security.** `verify` refuses a remote IPv6 backend (`[2001:db8::1]`) and a schemeless DSN whose query holds an `@`, which it had taken for local. The demo gate leaves open only `/icon`, `/apple-icon` and `/favicon.ico`, not every address that begins like one (`/icons`). Copy as cURL quotes each word for the shell, so a body's own quote or `$(…)` runs nothing. A masked secret in a Copy field keeps only a word prefix (`sk_live_`), hides a value under 16 characters whole, and is never revealed in an embed. The replay action refuses, on the server, a request that did not fail, as the page does. The assistant route stops reading a body once it passes 2 MB, where it held the whole body before refusing it.
- **The checks run by hand answer `--help` and refuse a flag they do not read.** `audit`, `shot`, `vitals`, `keyboard`, `interactions`, `navigate`, `rail`, `perf`, `live`, `ask`, `assistant` and `sizes` name their flags and stop; `node scripts/audit.ts --help` used to start a twenty-minute audit of whatever answered the default address. `brand` does too, before it writes anything: `--hu 25` for `--hue 25` branded the rest and dropped the hue without a word.
- **The Atlas's error state names its page** ("Error state"), as the loading state does; it was a client page, which cannot export a title.
- **The proposal embed says Not applied when its tool refuses.** It said Applied, while it told the model nothing changed.
- **A failed request reads "None, it failed" for its tokens and cost**, not "None, refused", which is kept for a 4xx; a request that took 0 ms keeps its trace bars at the start instead of losing them to `NaN%`.
- **A member cannot be changed to an address another member has**, compared without its case, as an invite already checked; one address for several members at once is refused too.
- **A demo signed in as one persona reopens as that persona after a browser restart.** The persona cookie had no lifetime, so it ended with the browser while the 30-day session went on, and the console reopened as Maya Chen, an Owner; it now lasts as long as the session and is renewed with it.
- **Undo on a removal the page already sent says so** ("{name}'s removal was already sent"), instead of bringing back a member the server no longer has.
- **`update`'s refusals and `--resume`, `--finalize` and `--abort` order sessions by version number**, so a project holding 0.9.0 and 0.10.0 names 0.9.0 first; as text, 0.10.0 sorted first.
- **`/requests?sort=constructor`** (or any name every object inherits) falls back to the default sort instead of throwing.
- **Every view's context names `app.timezone`**, where Request, Requests, Services, Home and Revenue printed their times in it and labelled them UTC. Now's verification runs a day names it too.
- **A date written without a time prints as the day it names** in `formatDate`, `formatShortDate` and `formatDay`, as the calendar formatters already did: a product whose `app.timezone` is west of UTC printed `2026-10-01` as 30 Sept.
- **The Requests tiles' Latency p95 is the figure the agent is told for the same requests.** The tiles took the value at rank floor(0.95 × (n − 1)) and a prepared query the nearest rank, which differ for most small sets, such as a five-minute bucket.
- **A period is compared only with a whole period before it.** A product keeping 120 days compared its 90 days with the 30 before them and printed requests and revenue "up 200%"; `readDays` now answers no previous period where fewer days than the period's own are kept, so the tile draws no change.
- **A request's More actions leads to API keys only for someone who may open them.** A Viewer was offered Open API keys and landed on the refusal page; `RequestView` takes `mayOpenKeys`.
- **Usage's context names no busiest hour when no request was counted.** A fresh product's every hour ties at zero, and the first was named the busiest ("Monday 00:00, 0 requests"); it says no request was counted by hour.
- **A collection's description names the reporting timezone.** `days`, `usage`, `compute`, `costs` and `hours` told the assistant their days and hours were UTC whatever `app.timezone` said; they name `app.timezone`.
- **`update` reports a team file that reads `.current` off `useSize()`'s ref** as `migration:use-size-callback-ref`, from any release before 0.33.0, when `useSize` became a callback ref; it finalized into a type error with no line (#101). Every migration now reads an import through the project's own tsconfig aliases (an adopted project's `@meridian/*` as Meridian's modules, its `@/*` as its own), where it took `@/*` for Meridian's in every project and never read `@meridian/*`, and reads a team's own file under a managed folder, such as a chart of its own in `src/components/`, which the manifest does not record.
- **Cards hold at 320px, as their contract says, and `audit --atlas` measures 320 too.** The Atlas audit measured previews at 1440 and 390 only, and a run at every width found, at 320: Detail head's actions ran off the card (they wrap now); an inline Empty state squeezed its title to a word a line beside its action (the action takes a line of its own); a Heatmap readout with a long timezone ran past the grid (it breaks between its value and its date first); the Assistant's heading and an inline Embed frame's title were cut with no `title` holding them. Three previews drew specimens wider than 320px. On a phone the Atlas's card, token and page stages now run to the screen's edges with the page's gutter inside, so a specimen gets the width a page gives it (a framed stage left it 42px less, and eleven entries spilled at 320); the space view's descriptions wrap under their token and its radii take two columns.
- **`update` reads a project's own `NavItem` type whole.** `nav-needs` stopped at the type's first `;`, so the type 0.12.3 wrote (`{ href: string; label: string; … }`) was never read and a type without `needs` went unreported; `nav-item-fields` read only a `= { … }` literal. Both now read a type over several lines, an intersection or an interface, without its comments, and a shape they cannot read whole is reported rather than passed: when your type already declares the fields, the item says there is nothing to change. `use-size-callback-ref` reads a file written without semicolons and a type annotation with semicolons.
- **`node scripts/check.ts` fails a page or loading file whose `navTrail('<href>', nav)` names another page's href**, as a sub page's trail left behind when its route moved (#102). It names its own route, or for a detail page the nearest nav item above it.
- **A field tabbed to far down a `FormSection` with a save bar stays above the bar.** The bar sticks to the bottom of the view, and focus scrolled a field to the bottom edge, under it; every field of a section with a save bar keeps 80px clear below it.
- **The keyboard walk no longer expects a disabled control that keeps a `tabindex` to be a stop**, as a save bar's Discard does while it saves; it reported such a page as "never reached: Discard".
- **`adopt` in a project already on Meridian refuses in one line** ("already on Meridian 0.35.0 … run npx zz-meridian@latest update") instead of listing every file the team has edited since as a conflict.
- **`create` on a path that is a file refuses in one line** ("… is a file: name a new folder") instead of a Node stack trace.
- **The Tests page's Ask names a release by its version**, not its internal id ("of releases_2").
- **An agent's Activity line joins three names as "A, B and C"**, and records the member's id when the policy names no one, not "You" for every reader.
- **The Requests embed's inline Ask asks what the console's Ask asks**: what stands out in the latest requests, or what the filtered ones have in common, not why requests are failing over rows that are mostly 2xx.
- **An assistant message reads the roster 33 times, not 89.** The route asked `may` once for each view tool and rail item, and each resolved the caller again; `mayEach` in `src/data/access.ts` asks them of one resolved member.
- **The bell's customers-past-due alert is timed by the latest to fall past due**, not "just now" on every open.
- **The Customers figure is defined as what it counts**, customers that have not left, not workspaces "with a live key".
- **A customer is not compared with an error rate the product never measured**, over days that hold no request; an active member who has never signed in is named among the quiet ones, as never seen. Where most customers have no errors, the customers' context names those that have some, not every customer as "at least twice the median" of 0.00%.
- **A prepared query's group line names each figure when it carries several**, and a count of one reads singular ("1 day").
- **An Atlas page whose first paragraph is wrapped keeps its status and body** (Base / Motion lost "Status: beta").
- **The shared request cells read the sample through `src/data`**, and the check now holds `src/system/sample-cells.tsx` to that rule, so replacing `src/data/sample.ts` replaces the clock they draw against.
- **A Data table sorts text as a reader expects**, case and accents aside, with the numbers inside it by value: by code unit, "acme" came after "Zeta" and "Émile" after "Zoë". Its select-all box reads "Select all entries on this page", from the noun as given; it cut a trailing "s", and named "every entrie" and "every people".
- **Dialogs and sheets.** A Dialog opens at its first field, not its close button; a Dialog or Sheet without a `description` is described by nothing, not by its own title read twice.
- **Form controls.** A Select's options are 44px tall under a coarse pointer. A read-only Input or Textarea looks read-only and stays invalid inside a Field. A Checkbox, Switch or Radio with a description is named by its label and described by its description, instead of the two joined into one name. A read-only or saving Form section disables what it holds without a `<form>` too.
- **A customer with no request in the sampled log says why**: "No sampled request is from Acme. The log keeps a sample of the requests, not every one.", so a quiet customer is not read as one the log missed.
- **A Copy field says when the browser refused the copy**, and selects the value to copy by hand, showing a masked secret first (never in an embed); it said nothing at all.
- **Feedback.** A toast waits while the pointer or focus is on it, and a held removal commits when its toast closes. An avatar takes whole initials and falls back to them when its picture does not load. A Key value row whose value is unknown (`null`, `undefined`, empty text) draws an em dash in `ink-3`, as its README says, where it drew a blank. The palette's no-match line asks for a page's name and names no page, where it suggested the sample's Requests in every product. The Search pill and the palette's footer name the palette's key as the reader's keyboard does, Ctrl K off an Apple keyboard, where both showed ⌘K on Windows and Linux; `usePaletteKey()` from the command palette reads it. A Banner puts its action under its text by its own width, not the window's, so one in the assistant's column no longer squeezes its title beside the action. Progress reads a missing value as a dash. A Progress past its whole fills its bar and says the share it is: 23 seats of 20 read 115%, not 100%. A change reads as no change only when its format rounds it to none. A Delta's format function is handed the size of the change, as its prop says: `` (n) => `$${n}` `` read "▼ $-23.73" for a fall. Stored appearance choices are applied only when known.
- **Navigation.** The tab indicator follows the active tab when only the tab grows. A folded breadcrumb level without an address is a named, disabled item, not a link to `#`. A breadcrumb whose ancestors are wider than its column truncates them after the current page, where they ran past it. A filter bar with no filters keeps its view control on a narrow bar. The phone's Filters count is the filters set in its sheet, not the search text too, and its name reads "Filters 1", not "Filters1". An opened alert stays read after a reload, for the tab's session.
- **The assistant.** The palette and the assistant leave an input method's Enter, Escape and arrows to it while it composes. The column keeps an unsent message across a close, and Clear stops a reply in flight and takes the last error, and its Retry of an empty thread, with it. A failed proposal offers Try again only where it can run again. A question reads the page once, not twice.
- **Charts.** Every chart's default count format is the product's (`FORMATTERS.count`), so a rounded-away negative reads `0`, not `-0`. A Bar list draws rows under 1 against its largest row, and prints a row's share of a `total` under 1 as its bar draws it (a row of 0.25 is 50.0% of 0.5, not 25.0%). An Uptime strip reads the day a tap lands on, as the Column and Trend charts do, and its tooltip stays inside its figure at either end, and a strip with no days says "No history yet". A strip of one day reads "1 day ago", not "1 days ago". A Status list names each strip by the days it holds. Charts build their screen-reader table once per data, not on every cursor move. A Trend chart announces the day its arrow keys move to, as the Column chart does; it told a screen reader to use them and said nothing. Its screen-reader table heads each row with the date as the chart reads it ("01 Oct 2026", or its `tick`), as a row header, where it read the raw ISO string in a plain cell. A stacked Composition bar folds past four parts as the stacked Column chart does, so a part keeps its colour across the two, and two parts of one label are drawn as two. A Sparkline's title reads its range in the format it is given, and a Metric tile gives its own: a margin tile read "0.62 to 0.71".
- **Specs and previews.** Card READMEs, preview notes and examples say what the components draw (container steps in rem with their 14px-rem widths, the Appearance menu's order, the required `nav` in the Rail and palette examples, the Proposal's lit edge, the chart roles, the Dialog's title size, the Data table's card width and first sort, the Checkbox's disabled outline, the Motion card's menus dropping into place, which Status dots pulse, how a Form section holds Save for an invalid field, the npm page's brand flags and its link into the repository), and preview controls do what they say. The Settings, Requests, API keys and proposal-embed READMEs say what their pages draw.
- **The CLI.** A flag it cannot read (`adopt --hexx`) is one line naming the flag and `zz-meridian --help`, not a stack trace. `create`'s closing step says `npm run verify -- --full --timed` on npm, which ran a plain verify without the `--`. After a failed brand, `create` says to delete the folder and run it again, and `adopt` says how to put the tree back, since running either again as it was refused. `update`'s summary counts a managed file the team edited as edited, not untouched, and a long gate, build or install it runs is read whole instead of killed past 1 MiB of output and reported as exit 1. The `verify-modes` migration names a team's own script under `scripts/` that still passes a removed flag, and `update` reads the team's sources once for all its migrations. `update --finalize` holds a framework the team declares with a range (`"next": "^16.4.2"`) to that range, as every other dependency is held: it demanded exactly 16.4.2 and failed an install that resolved 16.4.3. Update reads one kind of range everywhere, so a prerelease specification is compared by its version and a bare `16` is read as npm reads it.
- **The utility rules of the check read no comment line**, as the colour rule already did.
- **Data.** A failed request is one definition, every 5xx and the 429, so a 520 from a proxy is an error to the agent's "Errors and limits" measure as it is on the page. The live stream no longer opens with an EventSource `retry` that `src/lib/live.ts` cancels by reconnecting on its own clock. The Atlas front door draws the sample's own busiest routes, states no change in its first week, and draws the easing curves from the motion tokens.
- **Checks.** The presses report an error a press threw although the walk opened the route again after it; only the last load's errors were read. Route discovery finds a page written as `page.ts`, `page.jsx` or `page.js`, drops a parallel route's `@slot` from the address as it drops a route group, and leaves an intercepting route (`(.)photo`) out; before, a slot became a segment that answered 404. `rail.ts` (the rail `pnpm verify --as` compares) reads a rail drawn in an open shadow root, as the journey and the walk-through already did; it reported "the rail drew no links" on a web-component rail. The gate's "What the agent reads" rule, and the migration that lists the page specs without it, hold the heading to `## Agents`: a heading under any later section passed. `live.ts --only` reports every case it was not asked for as `not run` and exits 2, as a narrowed run is not a whole one, and refuses a name no case has; it exited 0 having run one case. The audit's last line counts pages and embeds apart, each at the widths it was measured at; it put the embeds under the page widths, and an `--embeds-only` run named no embed width. `ask.ts` asks nothing of a page that answered an error, redirected (to sign-in, say) or could not be fetched, and names why; it asked every question with the error page as the page. The link check fetches as the persona the page was opened as, so a route only that person may see is no longer reported as broken. A Chrome that closes its connection fails every waiting command at once with the reason, instead of each timing out after 30 s, and a socket that never opens fails after 30 s instead of hanging. A server that answers 5xx while it starts is asked again after a pause, not at once. The assistant walk and the live checks treat Members, API keys and Settings as the sample's only while their files still hold the people, copy and title the walk reads, so a product that kept a page and put in its own words gets `n/a`, not a failure that reads as a product bug.

## [0.35.0] · 2026-10-29

A third level in the rail: a navigation item can have sub pages, drawn in a branch under it, and the sample shows one (Traffic, Usage, Requests).

### Breaking

- **`PageFrame` draws its kicker in a `div`, not a `p`.** A kicker can now hold block content such as a `Breadcrumb`, which inside a `p` was invalid HTML and a hydration mismatch. The `t-kicker` class and the look are unchanged. A test of your own that asserts the kicker's tag name expects `DIV`, and a selector written as `p.t-kicker` is written `.t-kicker`.

### Added

- **A navigation item can have sub pages, drawn as a third level in the rail.** Set `under` on a `NavItem` to the `href` of another item of the same group, and the rail draws the item in that item's branch, on a guide line and without an icon. The parent stays a link to its own page, with a button beside it named `<label> pages` that opens and closes the branch. A branch is open on arrival when the current page is its parent or one of its sub pages, and a closed branch draws none of its links. A closed branch that holds the current page puts the pill on its parent, so the rail always shows where the person is. A sub page the person may not open is not drawn, and one whose parent they may not open is drawn as a plain item. No migration is needed: `under` is optional, and a navigation without it draws as before.
- **The gate refuses a sub page the rail cannot draw.** `node scripts/check.ts` refuses an `under` that names no item of the same group, the item itself, or an item that is itself under another (three levels, never four). It also refuses a sub page in another workspace than its parent, and more than 7 sub pages under one parent. Each refusal names the item's `href`.
- **The palette and the masthead say where a sub page sits.** The command palette's hint for a sub page is its parent's label, so typing a parent's label finds its sub pages. `navTrail(href, nav)` in `src/components/patterns/rail/trail.ts` derives a page's crumbs from the navigation: for a sub page, its parent as a link, then the page. The sample's Requests page draws it as its kicker, Usage then Requests.
- **The sample shows all three levels.** Business is now two labelled groups: Accounts (Revenue, Customers) and Traffic (Usage, with Requests under it). The Rail preview draws every branch state.

## [0.34.0] · 2026-10-29

### Changed

- **A build fetches nothing: the typefaces ship with the template.** Geist and Geist Mono came from Google Fonts through `next/font/google`, which `next build` fetches at build time, so with fonts.googleapis.com unreachable and no build cache the build failed (`Build error occurred`, exit 1), as the first 0.33.0 release run's update of a created project did (issue #100). The two variable faces are under `src/styles/fonts/` (from `geist@1.8.2`, with their SIL Open Font License), managed, and `app/layout.tsx` loads them with `next/font/local`. Each face is now one whole file, where Google served its Latin glyphs in a subset of their own.
  - **What a team does.** `app/layout.tsx` is yours, so an update does not change it: run `update`, which delivers the faces and reports `migration:self-hosted-fonts` for a layout that still hands `--font-face-sans` and `--font-face-mono` their faces from Google Fonts, and load each with `next/font/local` as the release's layout does.

### Fixed

- **A Bar list's axis draws behind its rows.** Its gridlines, positioned before the rows, painted over every label that is not a link, the meta and each figure, and, under reduced motion, over the bars: the words and the bars now stand over them, and the words over the bars, so a linked label's target under a finger still takes a tap on its bar.
- **A row or a part below zero draws nothing, never the whole track.** A Bar list row below zero set a negative width, which a browser drops, so its bar filled the track; it draws an empty bar, its figure the value it holds and its share of `total` `0.0%`. A Composition bar summed its signed parts into its whole, so a negative part turned every other share negative; the whole is the sum of the parts above zero (`compositionTotal`), and a part below zero draws as a part of zero, its share `0%`, and adds nothing to Other, as a Bar list row below zero adds nothing to its "N others". A share above none too small for one decimal reads `<0.1%`, never `0.0%`. `tests/chart-semantics.test.tsx` now catches a size below zero where React sets it, which jsdom, like a browser, dropped before any check could read it.
- **A grouped Column chart's group with no data keeps its cut word in its title.** "No data" cut to a 36 to 45px column was held whole nowhere; the group's title holds it, as a plain column's does. The Column chart's README names the grouped form's ring and readout where it named the stacked form's alone.

## [0.33.0] · 2026-10-28

The charts and parts a monitoring page needs (issue #99): bars in the order given, on a held and labelled scale, two values a row, signed rows about zero, straight and step lines with a dot per reading, grouped columns, a hatch for an estimate, a section that opens in place and a dialog wide enough for a table.

### Breaking

- **A stacked Column chart's caption names its highlight as ringed.** Its table read `Accented:` for a highlighted column that wears the `ink` ring; it reads `Ringed:`, as the grouped form does. A plain column still reads `Accented:`. A test or a reader that looked for `Accented:` on a stacked chart looks for `Ringed:`.
- **A stacked column's parts are filled with `background-color`.** They were filled with the `background` shorthand, which would clear the estimate's hatch. The colours are unchanged; a test that read a part's `style.background` reads `style.backgroundColor`.
- **`useSize` returns a callback ref.** It returned a ref object and observed only the element present at mount, so a Trend chart's widening line that appeared later, when live data first crossed its `domain`, was never measured. `useSize()[0]` is now a callback that measures whatever element it is attached to, whenever it is attached, and stops when that element leaves: pass it only to a `ref` prop, and read the element some other way if code read its `.current`.

### Added

- **A Bar list keeps the order given, holds its scale and reads two values a row.** `order="given"` keeps the rows in the order passed, for readings in time or cumulative shares. `max` holds the scale at a stated top, and a row past it widens the scale and is named: `Scale widened to 112% to show Beta`. `axis` draws the levels and their gridlines under the bars, in `text-2xs` and `ink-3`; a level word that would touch the word beside it is not drawn, and its gridline stays. `pair` reads each row against its `compare` value, drawn as an outline on the same scale under a legend. `estimate: true` on a row hatches its bar and writes `Hatched: estimate` once.
- **Diverging bars: signed rows about one zero line.** A new chart card for a change by category where some rose and some fell, on a scale symmetric about zero: `domain` holds it and a value past it widens it in words, the figure stands beyond each bar on the side away from zero, one `highlight` row with its `highlightLabel`, linked labels, hatched estimates, and every figure as text in a labelled list, so no table is needed behind it.
- **A Trend chart draws straight and step lines, a dot per reading, on a held scale.** `curve="linear"` or `"step"` draws a series (its stacked parts and its running stretch too) straight or held level between readings; `points` draws a dot on each reading, none on a running point; `domain={[min, max]}` holds the plot to a stated range so charts side by side share it, and a value outside it widens the levels and says so above the plot and in the table's caption: `Scale widened from 90.0%–100.0% to 80.0%–100.0%`. A line wrapped to two on a phone card moves the plot down. `domain` and `floor` are not passed together.
- **A Sparkline takes `curve` and `domain`.** `curve="linear"` or `"step"` draws it straight or in steps, as the Trend chart does. `domain` holds its scale so sparklines side by side compare, and the title names the range drawn: the domain, `0 to 100`, while every value is inside it; widened, when a value is outside it, `0 to 150, scale widened from 0–100`.
- **A Column chart groups its parts.** `grouped` with two or three `parts` stands each column's parts side by side, each an identity in its categorical slot: a legend, a value above each bar of 36px or more, a part under zero hanging from the zero line, a part with no data keeping its slot with the dashed no-data hairline, and no Total in the readout or the table. A highlighted or pointed group wears the `ink` ring. The grouped form is loaded only by a chart that passes `grouped`, so no other route's first load grows.
- **A Column chart marks an estimate.** `estimate: true` on a plain, stacked or grouped column hatches its fill, says "estimate" in the readout, the announcement and the table, and writes `Hatched: estimate` once under the labels.
- **The hatch: an estimate without a hue.** `[data-estimate]` is a base role: diagonal stripes in the surface's colour over the mark's own fill, so an estimated mark spends no colour or tone. Under forced colours (Windows' contrast themes) it keeps its stripes in `CanvasText` over `Canvas`, so an estimate never reads as a measured figure.
- **A section opens in place: the Disclosure.** `Disclosure` (`summary`, `defaultOpen`, `className`) is the native `<details>` with a summary row and a chevron that turns, so the browser owns the press, the keyboard and the open state and no client code ships. Use it for what a reader opens on purpose, such as the readings behind a figure; never for the figure itself.
- **A dialog wide enough for a table.** `DialogContent size="xl"` is 960px on a desk and the same bottom sheet on a phone. A table of up to six columns goes in an `xl` dialog; past that, or when the reader needs the page beside it, it goes on its own page.
- **The scale helpers behind them.** `heldTicks(min, max)` in `src/components/charts/scale.ts` gives levels that end exactly at both ends of a held range, and `linearPath` and `stepPath` draw the straight and step lines beside `monotonePath`.
- **`docs/data-display.md` names each new form** in "Choose the form first": bars in the order given, two values a row, signed rows, grouped columns, straight and step lines, a held scale and an estimate, each with its rule.

### Changed

- **The first-load cap is 830 KiB.** It was 820 KiB; `/engineering`, which draws the Trend chart, Column chart, Bar list and Sparkline together, is 823 KiB with this release's forms. `FIRST_LOAD_CAP_KB` in `scripts/lib/budgets.ts` and the `## Budgets` row of `docs/testing.md` say 830; a project that set its own cap keeps it.

### Fixed

- **A page too tall to capture whole says so.** `node scripts/shot.ts --full` died on a bare `Page.captureScreenshot timed out` when a page was taller than Chrome captures at once (the Column chart's preview, 12,047px at 1440 and 2x), and took the rest of the run with it. The shot prints the route, width, theme and the page's height in CSS and device pixels, and says to shoot it without `--full` or one part with `--press` or a narrower route; the browser stuck on that capture is closed, the run goes on in a fresh one, and it exits 1.

## [0.32.0] · 2026-10-27

### Breaking

- **A chart's `color` is a palette slot, `SeriesSlot` (1 to 6).** `ColumnPart`, a Composition bar's `Part`, `Sparkline` and a Trend chart's series took any number, and a slot past six drew nothing. A caller that computes a slot types it `SeriesSlot` or folds the parts past the palette.
- **The `tracking-caps` token is removed.** Nothing in Meridian sets text in spaced capitals any more. A product's own `tracking-(--tracking-caps)` renders nothing: write the letter-spacing it wants, or drop the capitals.
- **A detail route that answers an error fails.** `detailRoutes` held the missing record beside the real ones; it now goes in `missingRoutes`. The `Page` type of `scripts/lib/chrome.ts` has a `status()` member, so a stub of it in a project's own test adds one.
- **`trendTotals` returns `(number | null)[]`.** A day no band has a value for is `null`, not `0`. A caller that adds or formats the totals handles `null` as a day with no total.
- **Figures read differently at their edges.** A share that is not zero but rounds to zero reads `<0.1%` (`<0.01%`, `<1%` at two and no places), not `0.0%`; a duration reads in the unit its rounded figure belongs to (`1.0s`, not `1000ms`; `1m`, not `60.0s`) and past two days in days (`21.0d`); an axis tick of 999,999 reads `1M`; money takes `app.currency`'s own decimals (`¥1,235`, `KWD1,234.568`). A product's own test that holds the old text of a figure at one of these edges holds the new one.
- **The filter bar wraps under 24rem.** Below 336px of its own width the search takes a line of its own and Filters and Ask the line under it, on a 390px phone too. A product's own screenshot or layout test of a list on a phone expects the two lines.

### Added

- **`Records` takes `empty`.** There are no records at all, not none that match a filter: the summary tiles are not drawn, and the table's empty state is the page's one word.
- **`--rate <n>` slows the phone n times beyond the host's own rate.** The timed suites calibrate the phone by a JavaScript benchmark, and a machine of the same benchmark can be slower at style and layout: the weekly runner measured about 1.6 times this laptop's times at the same rate, so a frame or a budget only the week saw red passed here. `pnpm verify --rate 1.6`, or `--rate 1.6` on `scripts/navigate.ts`, `scripts/vitals.ts` or `scripts/perf.ts`, reproduces it; the `phone:` line says the rate was scaled, and a rate under 1 is refused before the gate.
- **A time that passes by a hair says so.** A navigation time judged under `--timed`, LCP, INP, CLS or the longest frame that passes leaving less than a fifth of its limit prints `warn`, and its phase in `pnpm verify` reads `warn`: a pass at 95% of a budget here was a red on the runner, and nothing said how near the line a green run had been. `scripts/navigate.ts` ends with the run's least headroom, each vitals line gives its longest frame, and a product's own check that prints a line starting `warn` makes its phase `warn` too. A warn holds nothing; `docs/testing.md` `Headroom` says it is the cue to run the suite again with `--rate 1.6`.
- **The gate names a managed file a team changed and kept nowhere.** Nothing compared a project's managed files with the hashes `.meridian/manifest.json` records between releases, so an edit nobody recorded a reason for was first met as a question in the next update. `node scripts/check.ts` prints `drift: <n> managed files differ from the release and are not in .meridian/keep.json: <paths>`, the gate repeats it after its last line and `pnpm verify` under the gate. It fails nothing; restore the file, or keep it with its reason.
- **The Postgres code the references hand a team runs against a real Postgres, weekly.** `references/live.md`'s LISTEN and NOTIFY adapter and the pool and pooler guidance of `references/existing-project.md` were compiled and run by nothing, and each database finding reached Meridian from an adopter's production (#16, #17). `scripts/fixtures/postgres/postgres.test.ts` runs the adapter as the reference has it (a committed change reaches its tenant and collection only, a rollback sends nothing, a connection the database ends comes back and resyncs, the last subscriber leaving closes it), holds the pool to what the reference says happens with its error listener and without it, and holds a PgBouncer in transaction mode to refusing a session setting, honouring `SET LOCAL` and not keeping a session advisory lock. The weekly job `postgres` runs it, by its own config, against service containers; nothing else collects it. All nine held as written.
- **The week audits the Design Atlas.** No verify depth audits the Atlas, where each card's specimens draw its extreme shapes, so the two defects above were found only when someone looked. The weekly job `atlas` builds, serves and runs `node scripts/audit.ts --atlas` at the pixel ratio verify measures.

### Changed

- **Labels are words, not code.** The kicker (`t-kicker`), the eyebrow (`t-eyebrow`) and a Featured metric's foot labels were monospace capitals, every award site's label; they are the text's own face and case at 12px, medium, in `ink-3`. Monospace is left to identifiers: ids, keys, routes, hashes. The Atlas's numbered `01`–`05` labels are gone, and an API key's environment badge reads `Live` or `Test`.
- **A row of tiles is one instrument.** `Row split="tiles"` drew its tiles as equal cards side by side; it draws one band with the card's edge and fill, the tiles divided by its hairline at every width. A tile has no fill of its own inside it: the surface is translucent, and two layers lifted the ground under the captions. The Atlas's five rules read as a list rather than five equal tiles.
- **The audit measures 320px.** WCAG's reflow asks content to hold at 320 CSS px, a small phone or a desktop at 400% zoom, and the narrowest width the audit measured was 390. It measures every page at 2560, 1440, 1024, 768, 390 and 320px; `verify --full` takes about a fifth longer.

### Fixed

- **A narrowed audit measures an embed as an embed.** `node scripts/audit.ts --routes /,/embed/home` measured the embed as a page, on no host's ground, so its ink failed contrast against a transparent page (1.13:1), and it ran every other embed beside it. An embed in `--routes` is measured on its host's ground, only the embeds it names run, and `--list` marks each `(embed)`.
- **A tile's figure fits its tile.** Its size was set for the viewport, so a long figure ran past the tile's edge: `100.00%` in a row of four at 1440, `$91,367.01` beside its sparkline on a phone. The figure keeps its size until its characters would not fit the column it sits in, then steps down with it; a tile sized by its content keeps the width its figure and note need. The line under the figure is `data-tile-line`, which the tile's tests read by name.
- **The alerts panel's preview fits a phone.** It fixed the panel at 352px inside a narrower column, so "Mark all read" ran past the panel's edge on the Atlas page at 390px; the bell's own popover was right.
- **A list with nothing in it says so once.** Customers, Tickets, Tests, Releases and Requests drew their row of summary tiles as zeros above the table's "No customers yet": `Revenue, last 30 days $0`, `Open tickets 0`, figures drawn as if there were records. A page with no records at all passes `empty` to `Records`, and the summary is not drawn; a filter that matches nothing keeps its summary of the matching set. `tests/cli-views-without-data.test.tsx` draws every view with an empty product and Home, Usage, Revenue and Now with nothing readable.
- **A part past the palette has a colour.** The categorical palette has six slots, and a Composition bar of more parts named `--series-7` and on, which no theme defines: the part drew transparent, its share gone from the bar and its swatch blank in the key, while the percentages still added up. Past six parts it draws the first five and "Other", their sum, in the neutral; the Atlas draws it with twelve.
- **A link to a record names that record, whatever its id holds.** The sample's ids are slugs, and every link to a customer or a request was written `/customers/${id}`: an id holding a slash, a hash, a question mark or a space named another address (`/customers/acme/eu` is no page, `/requests/r#2` is `/requests/r`), on the page and in the addresses handed to an agent. `customerAddress` and the new `requestAddress` encode the id, and every link goes through them; the page reads its segment decoded.
- **A list's cut line keeps its whole in the title it sits under.** Releases cut "Inference API · Staging" at 320px under a title that read "staging", and Tests cut "Smoke" under "smoke on …": the title named the raw value where the line drew its label, so the whole of the cut line was nowhere. The titles name what the line draws.
- **A write that never answers is told, and the page stays.** A refusal answers with its reason, and every write said it; a write that never answered (a dropped connection) throws instead, and two did not catch it: Replay threw inside its transition and took the request's page to its error screen, and saving the workspace in Settings stayed on Saving for good. Each now says the change did not reach the server, the way the other writes do, and the form keeps what was typed.
- **A long name or address never holds its column past the table.** Members' email, API keys' creator and a ticket's assignee were held on one line, so a company's long domain or a person's long name widened the column until the table ran past its frame: Members by 2px at 1440 with `@northwind-global-payments-reconciliation.example`. A name breaks at its spaces and an address before its @ when its column has no room, and reads whole on one line when it has. `tests/cli-views-keep-cut-text.test.tsx` draws them with names and domains as long as real ones run.
- **An amount is written to its currency's minor unit.** Every amount had two decimals whatever `app.currency` named, so a product in yen read `¥1,234.57` for an amount with no fraction to show, and one in dinars lost a digit of every amount. `formatCost` and the money axis take the currency's own places (0 for the yen and the won, 3 for the dinar, 2 for the dollar and the euro), and an amount under one minor unit keeps two places more, so it still never reads as zero (`¥0.40`, `$0.0040`). `tests/format-currency.test.ts` draws the dollar, the yen and the dinar.
- **A chosen item is told apart under forced colours.** Windows' contrast themes replace every colour with a few of the system's and drop box-shadow, so a choice told by a fill, a tint or a ring was told by nothing: the rail's current page, the period, a Segmented's segment, a chosen radio, the page a pager is on and the current tab read like the rest, the accent swatches were blank and an off switch had no thumb. `base.css` tells each selection state (`aria-current=page`, `aria-pressed`, `aria-selected`, `aria-checked`, `data-state` `on`, `active` and `checked`) in the system's Highlight, outside every layer, keeps a swatch's own colour (`data-swatch`) and draws a switch's thumb. Where the reader is, likewise: a field that removed its outline told focus by its border and a ring, and a menu or a select its highlighted item by a fill, so a keyboard reader lost their place; focus is outlined in Highlight and a highlighted item filled with it. `tests/forced-colors-states.test.ts` holds every component that styles a choice by one of these states to the block.
- **Every page of a long read is asked at once.** `readAll` reads a page of 500 rows and asked each page after the one before it arrived, so a collection of N pages waited N round trips: Home, Business and Engineering read usage and compute (1,444 rows each) three in a row, and a product with twenty models over a year would wait fifteen. The first page says how many there are, and the rest are asked together; with each read taking 1.5 s, Home's largest paint came at 3.3 s where it came at 4.8 s. The member-name join and the request tool's route latency are asked the same way. `tests/cli-read-all-pages.test.ts` holds it.
- **The filter bar holds Ask at a phone's width and beside the open assistant.** The search's floor, Filters with its count and Ask need 336px on one line; a 320px phone's card gives the bar 246px and a 1024px window with the assistant open 273px, so Ask ran 60px past the card on Customers, Tickets, Releases, Requests and Tests. Under 24rem the search takes a line of its own and Filters and Ask share the line under it. The Atlas's narrow specimen draws the bar with Ask at 360px and 246px, where the weekly Atlas audit measures it; the audits run before this one built the product with no assistant, so Ask was never drawn at 320px.
- **Every chart and figure is drawn with the shapes a product's data takes, and none prints a number that is not one.** `tests/chart-semantics.test.tsx` draws each chart and figure (Sparkline, the Trend chart's area, whole, stacked and running forms, the Column chart's plain, whole, highlighted and stacked forms, BarList, CompositionBar, the Heatmap's three forms, MetricTile, FeaturedMetric, Delta, UptimeBars) with fifteen shapes: empty, one value, all missing, all zero, a gap, missing at either end, all negative, signed, values under a millionth, values over a trillion, counts topping at one, one outlier, a flat run and a year. None may put `NaN`, `Infinity` or `undefined` on the page or size a mark below zero; a point with no data reads as no data in a chart's table, never as zero; a chart of counts names whole levels only. It found two defects:
  - **A count scale over values far under one draws every level at its floor.** `ticksBetween` rounded a top smaller than a millionth of its step onto zero, so the plot's top and floor were the same level and every gridline was drawn at `NaN`; a floor that small was rounded up past the data the same way. Each end now stays a whole step past the data.
  - **A stacked Trend chart drew a day nothing was measured on as a total of zero.** The stack dipped to the axis there and the table read `0`. Such a day now breaks every band and the total, as a missing day breaks a line, and its total reads `—`; a part missing on a day the others were measured stands on the parts below it, as before. The Trend chart's preview draws it under Gaps.
- **A suite no longer measures an error page as the route it asked for.** A route that answered 404 was audited, pressed, walked, measured and shot as whatever its not-found screen drew, which has a heading, a main and controls like any page, so a mistyped id in `detailRoutes` or an address given by hand read `0 issues`. The browser helper now records the status the document answered with (`page.status()`), and the audit, the presses, the keyboard walk, the vitals and `scripts/shot.ts` fail a route that answered an error status (`<route> answered 404, so what was measured is its error page and not the route`) or drew the not-found screen (`<route> draws the not-found screen ([data-missing-page])`): a record page inside a streamed shell finds no record after it has answered 200, which is how the sample's missing records answer, so the screen's own mark counts as much as the status. A route meant to be missing is declared: `missingRoutes` in `scripts/verify.config.ts`, or `--missing` for one run; it must be the not-found screen, and one that renders a page fails, so a record that came to exist is noticed. The root not-found screen carries `data-missing-page` too. The fixtures hold every direction in every suite (`/gone/record`, `/drawn-missing`, `/came-to-exist`).
  - **What a team does.** Move a detail route that names a record that does not exist from `detailRoutes` to `missingRoutes`, and give a not-found screen of your own `data-missing-page` on its root; the run names any route it finds. `update` reports `migration:missing-routes` for a configuration that lists detail routes and no missing ones.
- **A phone is measured at its own width.** The audit judged a page at a phone's width against `innerWidth`, which a phone's visual viewport widens to whatever overflows it: a row 600px wide at 390px measured the window as 616px, so the document's own sideways scroll never failed on a phone, the strip rule (#86), which runs only at 400px or less, was skipped on any page that overflowed, and every clip was taken against the wider box. Every check that asks whether something fits the window now reads the layout viewport (`document.documentElement.clientWidth`): the audit, the keyboard walk's on-top test, `scripts/shot.ts`'s readout check, the live run's sheet and the assistant's panel geometry. `/sideways-document` holds it; the sample's thirty routes pass at the true width. The fixture `/sideways-data-page-fixed` overflowed a phone itself, which the wider window had hidden, and is corrected.
- **A rule that judged nothing says so.** `scripts/check.ts` counts what each rule over a set of the project's files judged, and prints `judged nothing: <rules>` for a set that came out empty: the card contract, the page specifications, what the agent reads, what the agent does here, and a collection's rows read through it. An empty set passed exactly as a set judged right did, which is how view tools kept in modules (#43) and a route group not named `(dashboard)` (#23) passed. The presses print it when no control and no link was found on any route, the keyboard walk when no stop was. The gate adds it to the step's `ok` line and its last line, and `pnpm verify` to the coverage line (`judged nothing: …`). It is information, never a failure: a product without cards has none to judge. The assistant walk-through does the same for the sample steps a product removed: each prints `n/a` as it passes and the run ends with `judged nothing: assistant: <step>, …`, which `pnpm verify --full` names in its coverage line.
- **Every rule a browser suite judges has a page it fails and a page it passes.** `tests/cli-check-rule-pairs.test.ts` lists the 54 rules of the audit, the presses, the keyboard walk and the vitals, each with the fixture page it must fail and the one it must pass, and holds that every place a suite can fail from belongs to a listed rule, so a new rule cannot arrive without its pair. Fifteen had no page that made them fire: the document's own sideways scroll; a link that is not a URL, a control that leaves for good, a control under a layer, a page error and a page that stops answering, in the presses; a control under a fixed bar, a way back that differs, a skip link that is not the first stop, a control that leaves on focus and a page that stops answering, in the keyboard walk; and each of the vitals' four floors. Each now has its pages. The vitals line names the floor a page missed (`over the LCP floor (2.5 s)`, `dropped a frame (over 50 ms)`), where it printed only the figures. A corrected twin of a timed rule is a `clear` case: its own line is absent, whatever a floor it does not plant reads while the cases run side by side.
- **A text a card cuts keeps the whole of itself.** `tests/truncation-keeps-text.test.tsx` draws every card that cuts text with an ellipsis, with text far longer than any box, and holds each cut element to keep its whole text in a `title` on it, on what holds it, or on the one thing inside it: the audit's rule, which only ever met the sample's short names. Five cards cut text and kept it nowhere: Progress's label, a StatusList service's name, Pagination's range line, both forms of Freshness (whose title held the date and not the words it cut), and in the rail a scope's label, a destination's label and the signed-in person's name and role; the command palette's labels too. Each now keeps it. Pagination cuts each form of its line on its own, so the title is the one the pager's width shows.
- **A figure that rounds to zero prints no sign.** `-0` is a value a product's data holds (`Math.round(-0.4)`, a net change that rounded away), and `count`, `compact`, `cost-compact`, `percent` and every axis format printed it as `-0`, `-$0` or `-0.0%`, which reads as a fall. Every format passes its figure through one rule: a figure with no digit but zero carries no sign. `tests/format-semantics.test.ts` draws every formatter with sixteen values a product holds (negative zero, a millionth of a cent, a quadrillion, signed halves) and missing, and holds a split or shortened figure to its sign and symbol.
- **A figure at a rounding edge is written in the unit it rounds to, and a share that is not zero never reads as zero.** `formatDuration` chose its unit from the raw value and its digits from the rounded one, so a p95 of 999.6 ms read `1000ms` and a 59.96 s run `60.0s`; an axis tick of 999,999 read `1000K`. Each now reads `1.0s`, `1m` and `1M`, the step `formatCompact` already took. Past two days a duration reads in days: an incident open for three weeks read `504.0h` and reads `21.0d`. `formatPercent` printed an error rate of 0.003% as `0.0%`, which says there were none: a share too small for its places reads as the bound it is under, `<0.1%` (`<0.01%` at two places, `<1%` at none), with its own sign, the rule `formatCost` keeps for a cost. A title or a line that says a change held level judges it by its size, as Delta does, so a change under 0.05% still reads level. `tests/format-semantics.test.ts` holds every formatter at the edges.

## [0.31.2] · 2026-10-27

### Fixed

- **Home and Revenue no longer drop a frame when the period changes to 7D on a slow phone** (the known issue of 0.31.0). At 7D the year is 52 windows, drawn in two column charts and a trend, and the tap committed about a thousand elements in one frame: on the weekly runner's phone its longest gap was 83 ms against the 50 ms floor. Measured at the emulated phone's rate times 1.6, which reproduces the runner, the gap is now 50 ms in six of six runs (style and layout 31 to 36 ms, from 63 to 72).
  - **A dense column chart draws a finished column as one element.** Past 30 columns, a plain chart's finished column is the `[data-column]` element alone, its bar the element's `::before` with the same share of the scale, rounded top and 2px floor, and the row of columns grows as one instead of a column at a time. A running column, a column with no data, a stacked or a signed chart is drawn as before. A finished plain column of any chart is its own fill, one element fewer.
  - **A chart's data table and axis labels follow its marks a frame later when the period changes.** ColumnChart's and TrendChart's `sr-only` table, and ColumnChart's `aria-hidden` axis labels, render one frame after the set of columns or dates changes; the first render has them at once, and the label row keeps its height for that frame.

## [0.31.1] · 2026-10-27

### Fixed

- **A server that is stopped lets go of its live streams.** `next start` told to stop (SIGTERM or SIGINT, as a deploy or a restart does) closes its port and then waits for its open connections, and a live stream never ended of itself. So the old process stayed up holding every tab's stream while the new one served the port: no tab heard a change hint again, and every change waited for the tab's next safety poll (the weekly live check: `a server restart: B did not show a write made after the restart within 5000 ms`). `liveStream` now ends every open stream when the process is told to stop; each tab reconnects to the new server within about a second and hears hints again (a write after a restart reached the other tab in 540 ms, where it took 2.9 s). Where nothing else listens for the signal, the process still stops as it did.
  - **What a team does.** `src/data/live-stream.ts` is yours, so an update does not replace it: run `update`, which reports `migration:live-stream-shutdown` for a copy that never ends its streams, and bring the block that begins `Every stream still open` over from `references/live.md`.
  - **Doing nothing.** Nothing fails; a deploy or restart keeps the old server up while a tab is open, and changes reach other tabs only at their next poll until they reload.
- **A live tab tries its stream again as soon as the server answers after it did not.** A tab that had given its stream up for polling tried it again only on every fifth poll. A poll that answers after one that failed (the server is back) now opens the stream at once, so hints resume; a stream a proxy blocks, whose polls never fail, is still tried on every fifth poll.

## [0.31.0] · 2026-10-26

### Added

- **`EmptyState` names its kind on its root: `data-empty="first-run"`, `"filtered"`, `"error"` or `"no-access"`.** Navigation readiness reads it (below), and a product's own empty state carries the same attribute to be read the same way.

### Fixed

- **A rail route that redirects to a page under it is followed there** ([#97](https://github.com/zhixuan312/zz-meridian/issues/97)). A rail item at `/things` whose page sends the person to `/things/<slug>` failed its journey with `still on /things/a … after pressing /things`, so the page the person actually opens was never measured. The press has now arrived once the address is the route or a page under it, the entry's `title`, data and control are that page's, and the line says `landed on /things/a`. A press that lands anywhere else says where: `pressing /things led to /elsewhere, which is neither /things nor a page under it`.
  - An entry of `navigationChecks` for a path the rail does not draw now says why it is refused: a journey times a press on the rail's link, so it names the rail route a redirect starts from, and a page reached from a list belongs in `detailRoutes`. Checking such paths against the build's route list instead was declined: they would pass the check and then have no link to press.
- **A list whose data arrived empty is not a page that never got ready** (#97). A list page with a row-link probe and no rows failed `interactive never-ready: the control … was not pressable in 10000 ms`. When the page draws its first-run `EmptyState` where the rows would be and nothing in `main` is still loading, that is its data, ready (the line says `data is the first-run state`), and the control it does not have is reported `interactive not measured: the page shows its first-run state (…)`, a warning and never a pass, as soon as the empty state shows rather than after the wait. The error state stays a failure, and its line now says `the page shows its error state`.
- **A schema change behind a role that may not change the schema has a recipe** ([#98](https://github.com/zhixuan312/zz-meridian/issues/98)). `references/existing-project.md` told an adopter both to migrate on start and to ship the schema as a one-off file, which agrees only for a schema that never changes. It now names the two roads for every later migration: a `MIGRATION_DATABASE_URL` for the owner's role that the start-up migrator prefers, or a release step that migrates with the owner's role before the new version serves. The health route names a refused migration (`SQLSTATE 42501`) and the role that can run it.
- **`brand --hex` keeps the step that fixed the accent.** Since 0.30.0 a brand colour whose white label failed contrast on its fill at first and passed one step darker was refused with the first step's failure, which no longer held: `zz-meridian brand --hex '#0E8A5F'` exited 1 with `the accent still fails contrast after 8 steps`. What `brand` reports now is the last contrast run's, and the eighth step's tokens are measured too.
- **A live page is not read as not live because it was still hydrating.** `scripts/perf.ts` decided which rail routes register live data by sending one `online` event as each page loaded. A page that had not hydrated yet had no listener, the event was lost, and on a loaded runner a different route each week had no live route to start its after-live journey from (`no other rail route registers live data to start from`). The event is now sent again every 250 ms until a resync starts, and a route has 8 s to start one, not 4 s, so the probe costs up to 8 s for each rail route that is not live. The after-live journey uses the same rule.
- **A dropped frame names the control whose gap it explains.** `scripts/vitals.ts` printed the last control that dropped a frame beside the cause of the longest gap, which another control had dropped.
- **HTML that grew with the data has a reading** (#98). `references/validation.md` says how to tell a page's HTML growing with its database (`noLiveApi`) from growing with its code, and when re-recording the baseline is the answer.

### Known issues

- **Home and Revenue can drop a frame when the period changes to 7D on a slow phone.** At 7D the year is 52 windows, and Home draws them in two column charts and a trend: about a thousand new elements committed in one frame. On a quiet laptop at the emulated phone that frame's longest gap is 50 ms, the floor exactly (style and layout 36 ms); on the 4-CPU runner of the weekly run it is 67 to 83 ms (style and layout 62 to 69 ms), so the timed suite's vitals fail there. Making it cheaper is a decision about what a year draws at phone width, or about how a chart commits its marks, and is open for the next release.

## [0.30.0] · 2026-10-25

### Breaking

- **A direct `.query(` call states its own escape, on the line it is on.** `noDirectQuery` allowed five sites of the template's by absolute line number, and each was wrong the moment a comment above it changed length — this release moved `src/lib/assistant/tools.ts`'s call from 132 to 135 with an unrelated fix. The list is gone: the rule reports every `.query(` call in `app/`, `src/logic/`, `src/views/` and `src/lib/`, and keeps the run passing only where the call's own line carries `// allow-no-direct-query: read() cannot serve this — <why>`, the escape the check prints.
  - **What a team does.** Run `update`; it reports `migration:direct-query-escape` for each of your files that queries directly. Where the read must be direct — a server action reading the record it is about to change, a streamed export, the sign-in resolving a person before an `AccessScope` exists — put the escape on that line with the reason. Everywhere else read through `read()`, `readAll()` or `aggregate()` from `@/data/read`, which ask the caller's grant.
  - **Doing nothing.** Your own file that queries directly fails `node scripts/check.ts` on the next `pnpm gate`, in the check's own words, naming the line. Nothing else changes: the rule governs the same four folders it did, and a project with no direct read at all is unaffected.
- **`src/app.config.ts` gains `description`, the product's one sentence.** The release's `app/layout.tsx` shows `app.description` where it wrote a sentence of the template's own, and that layout is the one a project brings over when it takes the release's pages. The configuration is yours, and an update does not touch it.
  - **What a team does.** Run `update`; it reports `migration:app-description` for your configuration. Add `description: '<one sentence about your product>',` to the `app` object beside `name`.
  - **Doing nothing.** A project that keeps its own `app/layout.tsx` sees no failure, and the key costs it nothing. A project that brings the release's layout over fails `pnpm gate` on the type check — `Property 'description' does not exist` — until the key is there.

### Added

- **The accent picker is a radio group.** `AccentSwatches` in `@/components/ui/radio-group` is one row of swatches built on the radio primitive: the row is one Tab stop, the arrow keys move the choice, and the chosen swatch is announced as chosen. Settings and the Atlas's card stage both draw it, where three hand-built rows of `role="radio"` buttons each drew their own — every swatch a stop, and an arrow key that did nothing. The appearance menu keeps pressed buttons (`role="group"` with `aria-pressed`), because inside a menu the arrow keys belong to the menu.
- **`app.description` names the product in a sentence.** It is the line a search engine and a link preview show under the name, and it sits in `src/app.config.ts` beside `name`, `workspace` and `accent` instead of being written into `app/layout.tsx`. Both files are yours, so a project that has already set its own sentence keeps it; `update` reports `migration:app-description` where the configuration has no such key (see **Breaking**).
- **The README carries the prompt that models a product's data first.** One paragraph to hand the agent before the build sentence: the collections with their key, tenant, hidden, page-only and derived fields; the day and the time zone it is counted in; the money and its currency; each figure with its unit, its window and a definition a stranger could apply to a row; the grants in the `resource:operation` form; the three questions a page must be able to answer; and what an agent may propose against what stays the page's own. It asks for one table the build reads, so a wrong rendering can be told from a wrong model.

### Fixed

- **An approval a guard refused is still yours to send.** A tool call's id was marked used before the change ran, so a change that threw — the grant withdrawn between the approval and the run, a record that no longer fits — wrote nothing and still answered "This change was already applied." to the second try. The id is released when the change throws.
- **A screen never says a thing was copied before it was.** Four Copy controls on a request's page raised "copied" without waiting for the clipboard, on the page whose whole purpose is handing somebody an exact command or id. One helper awaits the write and says what to do when the browser refuses it.
- **A page is told the assistant is on only where the route serves it.** `scripts/lib/settle.ts` read every answer but 404 from `/api/assistant` as "on", so a page behind a refused session waited its whole bound for a slot that was never coming.
- **`brand` refuses a contrast run that measured nothing.** A `scripts/contrast.ts` that crashed printed no summary, and its empty output read as "no failures": the accent shipped unchecked. A hue still failing after the eighth step stops the command too.
- **The check states the direct read's escape on the call's own line.** `noDirectQuery` allowed five sites by absolute line number, and each was wrong the moment a comment above it changed length. The five state `// allow-no-direct-query: read() cannot serve this — …` where the call is, the escape the check already prints, so the rule no longer has a list to fall behind.
- **A walk goes on after a route that stops answering.** `scripts/interactions.ts` and `scripts/keyboard.ts` ended the suite at the first page that stopped answering, losing the evidence for every route after it. Each route is walked in a guard of its own, as `scripts/audit.ts` measures each route.
- **The Atlas reads its entries once per request, not twice.** The walk reads 73 specifications and a request-rendered Atlas page asked for them from the sidebar and again from the article. React's `cache` is the request's scope, so one read serves both and an edited README is still read again on the next request.
- **An Atlas page whose view tool threw is drawn without the tool's output.** A `Suspense` covers a read that is pending, not one that rejected, so one failing tool took the whole entry page.
- **`verify` names `--shard` among the options it takes**, and a shard is passed with `--perf` alone: it cannot be combined with `--full` or `--timed`, which `docs/testing.md` now says where it said "beside the other tiers".
- **The request page asks its reads at once.** The record, the grant behind Replay and the endpoints were three waits in a row; only the customer's address depends on the record.
- **The tab icon reads the accent the product picks.** `app/icon.ts` took the resolver's default, which is the shipped preset only until a product changes one of the two by hand.
- **Three routes lose a `Suspense` that wraps nothing**, and the product's one-line description moves into its config (above).
- **Seven components, each corrected where a reader named the defect.** A copy field's label sat on an element that takes no accessible name; a progress bar with a drawn label was unnamed; a toast raised before `Toaster` mounted was never shown; two incident updates stamped in one millisecond collided; the pager drew for a list that fits its page; two chart memos omitted the geometry they draw with; and a checkbox's and a switch's `className` are documented for the element they style.
- **Two timers outlived what set them.** The front door's sweep cleared its start timeout and left the interval running, and a host request held its timer for the whole bound after its answer arrived.
- **The skill's copy of the agent guide is the template's guide again.** It had drifted by four passages — the `data-assistant="omit"` rule, the 409 a thread answers when the session changed hands, the questions a view may offer, and how `pnpm verify --full` walks the assistant — and nothing compared the two. `tests/cli-skill-agents-sync.test.ts` does now, and `update` replaces an unedited copy with this one.
- **The skill and the docs name the paths the code has.** A prepared query beside a view is `src/logic/<view>-explore.ts` and a view's context file `src/logic/*-context.ts`, both moved in 0.28.0 while the skill still said `src/views/`; `assistantTools` takes `(collections, writer, guard, views?, explore?)`; `brand` is run through the package, not as `node scripts/brand.ts`.
- **`.env.example` names `DEMO_PASSWORD` and `DEMO_SECRET`**, and `AGENTS.md`'s generated block starts at the level Next writes it, so `next dev` stops re-creating the file as a change.
- **Three things nothing read are gone**: `scripts/lib/atlas.ts`'s `hasAtlas`, `verify`'s unused `reportSuite` return, and jade's empty `light: {}` token override.

## [0.29.0] · 2026-10-25

### Added

- **A mark says what it encodes** ([#94](https://github.com/zhixuan312/zz-meridian/issues/94)). A colour, a fill or a size a reader is meant to decode now carries its words, built from the data the component already holds, so it is right at the call site rather than added page by page. A Bar list row names its row, its figure and its share (`Checkout · 420 · 42.0% of 1,000`, and without a total too); a Trend chart's marked day names the day and what it is marked for; its dashed stretch into a period still running says "Today so far, dashed"; a Sparkline says the range it draws, which was the one chart carrying no readout; a Delta says whether its colour reads better or worse, which the colour alone could not; a Status dot takes a `label` and becomes an image to assistive technology where it stands with no word beside it, and an activity's tone says what it means ("Went well", "Needs attention", "Failed"). `ColumnChart` and `BarList` take `highlightLabel` — what makes the accented row or column the one the card is about — and say it on that mark and in the hidden table's caption. `docs/data-display.md`'s `## Marks` now states the rule, so a new chart is held to it.

### Fixed

- **A card's head never draws its title over its controls** ([#87](https://github.com/zhixuan312/zz-meridian/issues/87)). `CardHeader` gave the title `min-w-0 flex-1` and the actions `shrink-0`, so in a narrow column the title's box collapsed: at 1024px the second column of `<Row split="2/3">` is 229px, a head with a `Select size="sm"` and two labels took 138 of them, and the title's first word was drawn 32px past its own box, across the controls. The head wraps now, and the title's box has a floor (8rem, the width a word or two needs), so the actions drop to their own line when the two cannot share one. A title that wraps breaks a word too long for the line instead of drawing it over its neighbour.
- **A page headed by a sentence that opens with its own name announces it once** ([#88](https://github.com/zhixuan312/zz-meridian/issues/88)). `PageTitle` drew the name out of sight and then the sentence, so "USDC: no rule met…" was read as "USDC : USDC: no rule met…" in the heading and twice in a screen reader's list of headings. A sentence that is a plain string is compared with the name, and one that reads data takes `speaksName` on `PageTitle` or `PageFrame`; the name stays in the markup either way, so the heading is in the prerendered shell, and a sentence still to come leaves the name read.
- **A Key value list wraps a value on a phone instead of cutting it behind a title no phone shows** ([#89](https://github.com/zhixuan312/zz-meridian/issues/89)). Every value truncated unless its item set `wrap`, with the whole of it in the row's `title` — which a pointer reads and a phone cannot. Below the width where a sentence value cannot fit beside its 8rem label (26rem of row) the value wraps as `wrap` asks for; above it the one line and the title stay.
- **The CLS observer bounds a session window at 5 s** ([#90](https://github.com/zhixuan312/zz-meridian/issues/90)). It summed shifts into a session while each was within 1 s of the last, which is half of web-vitals' definition: a page that filled in over half a minute reported one session the length of the page, so `verify --timed` could fail a page inside its budget and the number could not be compared with another tool's. `scripts/lib/cls.ts` is the rule now, both bounds with it, and `tests/cli-vitals-cls.test.ts` runs the source the page runs.
- **A collection may hide or page-own a field it computes** ([#91](https://github.com/zhixuan312/zz-meridian/issues/91)). `visibleFields` and `writableFields` built their `omit` masks from the names alone, so a `hidden` or `pageOnlyFields` entry for a joined label or a derived total — which both doc comments allow — threw on a key the shape never had, on every render. A name the shape does not hold is skipped; the ones it holds are still masked, and the write schema stays strict, so a hidden or page-owned field sent anyway is refused.
- **An image's address is read the way the URL parser reads it** ([#92](https://github.com/zhixuan312/zz-meridian/issues/92)). `safe-markdown` accepted a `src` with no scheme that was not written `//`, so `\\host/p.png`, `/\host/p.png` and `\/host/p.png` passed while the browser resolved each to `//host/p.png` and fetched a third party — the case the rule exists to stop. The address is now resolved against a fixed origin with the backslashes normalised, and kept only when it lands back on it.
- **A filter bar's search has a floor, so its hint reads the same on a 2x display as on a 1x one** ([#93](https://github.com/zhixuan312/zz-meridian/issues/93)). The field took whatever five facets left: 129px at a 1440px window on a Retina screen, where the placeholder needs 134, so the same page read "Headline, address, ru" there and the whole hint on a laptop. It is 10rem wide at least, and the facets truncate their own labels to make the room.
- **The environment is put back before every test** ([#95](https://github.com/zhixuan312/zz-meridian/issues/95)). Files share a worker (`pool: 'vmThreads'`), so a file that stubbed a store's variables in a `beforeAll` left them set for the file beside it — seen as an intermittent gate where a view test found a store configured and asked a stub for a snapshot. `tests/setup.ts` restores the environment before each test, so a stub belongs in a `beforeEach`, which runs after it.
- **A created project's tests move with the release that changes them.** A test the template ships pins the behaviour of the module it covers, and every shipped test but `tests/setup.ts` was the team's, so an update could change `src/lib/format.ts` and leave `tests/format.test.ts` asserting what it did before: a project created with 0.28.0 and updated to 0.29.0 failed its own gate on `splitFigure`. `create` now records the tests it writes as managed, so an update replaces an unedited one with the release's; a test your team edited is staged for your decision, as any other edited file is. `adopt` still copies none of them, because a project it joins has a suite of its own.

- **A figure keeps its symbol and its sign when it is split or shortened, and an amount too small for 20 places never reads as zero** ([#96](https://github.com/zhixuan312/zz-meridian/issues/96)). `splitFigure` failed on a leading mark-and-sign figure (`-$298.43` came back whole), so a tile set it in its number face, or lost both the `$` and the minus when it shortened; `fitFigure` re-built a shortened figure with the app's own currency, so `HK$12,345,678` read `$12.3M`. The minus belongs to the mark, and a figure shortens with the mark and the sign it was given. `formatCost` below 5e-5 keeps its two leading digits in exponent form (`$1.0e-21`) where `toFixed` printed a row of zeroes.
```


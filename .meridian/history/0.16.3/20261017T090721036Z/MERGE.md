# Update 0.15.0 to 0.16.3

- Source: 0.15.0
- Target: 0.16.3
- Route: adopt
- Session: 20261017T090721036Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.16.3 update --finalize   # when every item below is resolved
npx zz-meridian@0.16.3 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.16.3 update --abort      # restore what the update changed and archive the session
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

### migration:refusal-declared

The product says what an address a person may not open draws: `refusal` in `src/app.config.ts`.

Paths: `src/app.config.ts`

Read "Navigation: `src/app.config.ts`" in references/customize.md. Add `export const refusal: 'explain' | 'absent' = 'explain';` to `src/app.config.ts`, beside `facts`: `explain` keeps the no-access page a refused page draws today, and `absent` answers as an address that names nothing. A project that keeps the sample's access seam brings `src/data/access.ts` and `src/data/refusal.ts` over from the release (`gate` reads `refusal`, with `gatedMetadata` and `withheldEntries` beside it, and `gatedLoading` reads it alone), titles each gated page with `export function generateMetadata() { return gatedMetadata('<feature>', { title: '<its title>' }); }` in place of a static `metadata`, passes its loading state's `name` and `title` through `gatedLoading`, and adds `refusal,` to the config object of `scripts/verify.config.ts`, imported from `../src/app.config.ts`, so `verify --as` expects the page the product chose.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:refusal-declared",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/app.config.ts": "sha256-be1a974e99496b541edb8476d64e03c6409c7db22f8676ec3c79ee75b1d787a7"
  }
}
```

### migration:managed-exports-removed

A file of the team's imports an export the release removed from a managed module: `deviations`, `largest`, `runs` or `weekendRatio` from `src/lib/insight.ts`, or `queryInput` from `src/lib/collection.ts`.

Paths: `src/lib/assistant/tools.ts`, `src/views/teams-context.ts`

The update brought `src/lib/insight.ts` and `src/lib/collection.ts` without them, so each file listed here fails the type check. A file of the sample's comes over from the release: the Overview context is Home's, `src/views/home-context.ts` (see `sample-pages-renamed`); the assistant reads through `view_<name>` and `explore_<view>` and has no `query_<name>` tools, so bring `src/lib/assistant/tools.ts` and `src/lib/assistant/respond.ts` over and pass `readable`, every collection the person may read, from the assistant route to `respond` beside `collections` (read "Prepared queries" in references/agents.md); and a shipped test that imports one, such as `tests/shared-context.test.tsx` or `tests/collection.test.ts`, comes over as the release has it. A file of your own that still needs one of the functions writes it in that file, from its 0.15.0 source.

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:managed-exports-removed",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/lib/assistant/tools.ts": "sha256-ca3abe510a238c75477f6cdbe38eab039768301bc5ad253c745ff100f2142eff",
    "src/views/teams-context.ts": "sha256-bc25c517d8a38fcc9a1e629ec98b3fd41b6a6bf653f2891cf79cd71ee36cd3ff"
  }
}
```

### migration:view-tool-page-explore

Every view tool names the page it renders and its prepared query: `page` and `explore` on `defineViewTool`.

Paths: `src/views/tools.ts`

Read "Prepared queries" in references/agents.md. Add to each `defineViewTool` call in the files listed here `page`, the console route of the page the view renders (a rail destination's `href` in `nav`, or a detail page's route with its segment, such as `/customers/[id]`), and `explore`, its prepared query (`PreparedQuery` in `src/lib/explore.ts`), declared beside the view as the sample's are in `src/views/<view>-explore.ts`. `ViewTool` in `src/lib/shared-context.ts` requires both, so a tool without them fails the type check. A project that kept the sample's view tools brings `src/views/tools.ts` and the `src/views/*-explore.ts` files over from the release. Once a tool names its page, the gate asks that page's specification what the agent does there (`agent-does-here-section`).

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:view-tool-page-explore",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/views/tools.ts": "sha256-7e4163cb93de7f5c6760175c637b79a7bef46042a561d6fcccb0decba400e1f4"
  }
}
```

### migration:agent-does-here-section

The specification of a page a view tool renders says what the agent does there.

Paths: `app/(dash)/(home)/README.md`, `app/(dash)/activity/README.md`, `app/(dash)/initiatives/README.md`, `app/(dash)/initiatives/[team]/[slug]/README.md`, `app/(dash)/initiatives/[team]/[slug]/[...path]/README.md`, `app/(dash)/knowledge/README.md`, `app/(dash)/knowledge/[team]/[...path]/README.md`, `app/(dash)/knowledge/log/README.md`, `app/(dash)/people/README.md`, `app/(dash)/platform/README.md`, `app/(dash)/plugins/README.md`, `app/(dash)/plugins/[plugin]/README.md`, `app/(dash)/plugins/[plugin]/[skill]/README.md`, `app/(dash)/runs/README.md`, `app/(dash)/settings/README.md`, `app/(dash)/teams/README.md`, `app/(dash)/teams/[slug]/README.md`

Read "Prepared queries" in references/agents.md. Under `## Agents` in the README.md of each page a view tool's `page` names, add `### What the agent does here`: a line `Protagonist: <the card's name>.`, then at least three questions a person on the page asks that its context does not answer alone, each `- "<question>" — <what the prepared query is asked>`, and mark that card on the page with `data-protagonist="<name>"`. `scripts/check.ts` fails the gate on such a page without the part. While a view tool in `src/views/tools.ts` names no page yet (`view-tool-page-explore`), every console page specification without the part is listed: one that no tool comes to name needs nothing.

Checks:

- `gate`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:agent-does-here-section",
  "status": "resolved",
  "reason": "",
  "files": {
    "app/(dash)/(home)/README.md": "sha256-38365f7b4a9889d59dcc08c1b483d7fa834c5b7841541eaa674bfd414876c280",
    "app/(dash)/activity/README.md": "sha256-0e04af4f8c5fe9c308c2e269386ef6e7ea93ef176592ed06b2b632a2b6d776da",
    "app/(dash)/initiatives/README.md": "sha256-a8f850fd76c08f75a9e4efb52b6d57f6df6baa151e387850fde89d0342201d84",
    "app/(dash)/initiatives/[team]/[slug]/README.md": "sha256-a475ee64379adedc93b50a5bc16667d9d4c85362549ac63301925b2432462764",
    "app/(dash)/initiatives/[team]/[slug]/[...path]/README.md": "sha256-761ddc3c7787b0d2ac9d63f8720501d10d560dfd427db45698a64a17591266ea",
    "app/(dash)/knowledge/README.md": "sha256-e56b06a7e9718594e22790385dfda91e5c433fee81e18cf7e4d7f2b0259a1d19",
    "app/(dash)/knowledge/[team]/[...path]/README.md": "sha256-627648f8ae12d99818b0927e930d77c4481eb26be8e0421bfec126913383cb6d",
    "app/(dash)/knowledge/log/README.md": "sha256-e082d92ebdf1257bcf456db3b4bb70d0ac5dad1012c32ca78711d654e29f1e12",
    "app/(dash)/people/README.md": "sha256-4e3bd17e8dbfe5671b29364dc833310739dd9b58a571ab9f372c50feb63f38c2",
    "app/(dash)/platform/README.md": "sha256-bdfee9205ba62a250de734cd3afb927315a1e8d8ab4c2d69891b84197bff1370",
    "app/(dash)/plugins/README.md": "sha256-9ddee6b607206258ecd0a6e428f5855eef9d9e202a6c8fd55d3bdda710ececdf",
    "app/(dash)/plugins/[plugin]/README.md": "sha256-e44739aa36dab39ea4b943c83e7938a5b5340ac84cc7bf11ed704355bdb86f4b",
    "app/(dash)/plugins/[plugin]/[skill]/README.md": "sha256-e8bfedd71af09f92cc9a928857b515b2cc30e2cbf3f51bd169c5d909b9a78ba4",
    "app/(dash)/runs/README.md": "sha256-5b1ccc7ad244a9cd854685bd6f056ad306ab20fc08043b61307bed9c01d45fdd",
    "app/(dash)/settings/README.md": "sha256-c903b520bbabc9c93c2a601e685b150cee3cad1f13739e60de50d83fdaf06022",
    "app/(dash)/teams/README.md": "sha256-a039c00fb7e698570fd54452a32036e615177ea8ae3c39f01ef95a0f0654d550",
    "app/(dash)/teams/[slug]/README.md": "sha256-e9bf03f3b507cdd3309fbca63383dff6f1157b688d390b77909d26bba7eac86c"
  }
}
```

### migration:sample-pages-renamed

The project holds the sample's pages and views under their 0.15.0 names: Overview is Home, Analytics is Usage at `/usage` and Operations is Services at `/services`.

Paths: `src/views/overview-context.ts`, `src/views/pages/overview.tsx`, `src/views/tools.ts`, `tests/view-contexts.test.ts`, `scripts/verify.config.ts`

The release renamed them with no redirect, and an update writes none of the team's pages, views or tests. Each file listed is one of them or names one: a page or a view, the view tools, `src/app.config.ts`'s nav and the feature ids it names, the routes of `scripts/verify.config.ts`, or a shipped test that expects them. A project that kept the sample's pages as they were brings the release's over: `app/(dashboard)/` and `app/embed/`, `src/views/`, `src/data/`, `src/lib/assistant/` beside `prompt.ts`, `src/app.config.ts` with its own `app` kept, and each shipped test as the release has it; a file listed here that the release no longer has is deleted. A project that made the pages its own keeps its own names, makes the changes this release's other migrations list in them, and reads "not applicable" for the assistant walk-through's steps on Home and Now (`scripts/lib/sample.ts`).

Checks:

- `gate`
- `build`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:sample-pages-renamed",
  "status": "resolved",
  "reason": "",
  "files": {
    "src/views/overview-context.ts": "sha256-80cf76a6b3ff23e9481674710c240551466a294af8785e79cc495e487a82c888",
    "src/views/pages/overview.tsx": "sha256-3df7ecdb8ed10c6348d0019705517db5278ab3f4cc1cb26b1a2167293a6e6cb2",
    "src/views/tools.ts": "sha256-7e4163cb93de7f5c6760175c637b79a7bef46042a561d6fcccb0decba400e1f4",
    "tests/view-contexts.test.ts": "sha256-db8cf73bee4916ca35bd3e13a734422a22500c780ebde0a03d1974e5d3c67fb8",
    "scripts/verify.config.ts": "sha256-7efe7d3ba3763f7e339b24aa180731ec4b7a623e2b2afead7e181d63fb8e58ba"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `app/(dash)/(home)/README.md`
- `app/(dash)/activity/README.md`
- `app/(dash)/initiatives/README.md`
- `app/(dash)/initiatives/[team]/[slug]/README.md`
- `app/(dash)/initiatives/[team]/[slug]/[...path]/README.md`
- `app/(dash)/knowledge/README.md`
- `app/(dash)/knowledge/[team]/[...path]/README.md`
- `app/(dash)/knowledge/log/README.md`
- `app/(dash)/people/README.md`
- `app/(dash)/platform/README.md`
- `app/(dash)/plugins/README.md`
- `app/(dash)/plugins/[plugin]/README.md`
- `app/(dash)/plugins/[plugin]/[skill]/README.md`
- `app/(dash)/runs/README.md`
- `app/(dash)/settings/README.md`
- `app/(dash)/teams/README.md`
- `app/(dash)/teams/[slug]/README.md`
- `package.json`
- `scripts/verify.config.ts`
- `src/app.config.ts`
- `src/lib/assistant/tools.ts`
- `src/views/overview-context.ts`
- `src/views/pages/overview.tsx`
- `src/views/teams-context.ts`
- `src/views/tools.ts`
- `tests/view-contexts.test.ts`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 9
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 89
- untouched/write: 83

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        write   .agents/skills/zz-meridian/references/agents.md
untouched        write   .agents/skills/zz-meridian/references/cache.md
untouched        write   .agents/skills/zz-meridian/references/customize.md
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
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        write   .claude/skills/zz-meridian/references/live.md
untouched        write   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        write   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        write   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
added            write   scripts/ask.ts
untouched        write   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        write   scripts/check.ts
untouched        write   scripts/contrast.ts
untouched        write   scripts/fake-llm.ts
untouched        write   scripts/gate.ts
untouched        leave   scripts/interactions.ts
untouched        write   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/context-check.ts
untouched        write   scripts/lib/contrast-pairs.ts
untouched        leave   scripts/lib/coverage.ts
added            write   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
added            write   scripts/lib/journey.ts
untouched        leave   scripts/lib/next-config.ts
untouched        write   scripts/lib/routes.ts
untouched        write   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        write   scripts/navigate.ts
untouched        write   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        write   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        leave   scripts/tokens.ts
untouched        write   scripts/verify.ts
untouched        write   scripts/vitals.ts
untouched        write   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        write   src/components/base/text-roles/index.tsx
added            write   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        write   src/components/charts/bar-list/index.tsx
untouched        write   src/components/charts/column-chart/index.tsx
untouched        write   src/components/charts/composition-bar/index.tsx
untouched        write   src/components/charts/heatmap/index.tsx
untouched        write   src/components/charts/meridian/index.tsx
added            write   src/components/charts/readout.tsx
untouched        write   src/components/charts/scale.ts
untouched        write   src/components/charts/sparkline/index.tsx
untouched        write   src/components/charts/trend-chart/index.tsx
untouched        write   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        write   src/components/patterns/ask-about/index.tsx
untouched        write   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
added            write   src/components/patterns/assistant/page-text.ts
added            write   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        write   src/components/patterns/assistant/thread.ts
untouched        write   src/components/patterns/command-palette/index.tsx
untouched        write   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        write   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        write   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        write   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        write   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
untouched        write   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        write   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/index.tsx
untouched        write   src/components/patterns/rail/index.tsx
untouched        write   src/components/patterns/shell-tools/index.tsx
untouched        write   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/patterns/status-list/summarise.ts
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        write   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        write   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        write   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        leave   src/components/ui/search-input/index.tsx
untouched        write   src/components/ui/segmented/index.tsx
untouched        write   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        write   src/components/ui/table/index.tsx
untouched        write   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        write   src/lib/agent-guidance.ts
untouched        write   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/csv.ts
added            write   src/lib/explore.ts
added            write   src/lib/facts.ts
untouched        write   src/lib/format-date.ts
untouched        write   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        write   src/lib/insight.ts
untouched        leave   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        write   src/lib/shared-context.ts
untouched        write   src/styles/base.css
untouched        write   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        write   src/styles/tokens.css
untouched        leave   src/views/console-chrome.tsx
untouched        leave   tests/setup.ts
untouched        leave   tokens/accent.brand.tokens.json
untouched        leave   tokens/accent.cobalt.tokens.json
untouched        leave   tokens/accent.graphite.tokens.json
untouched        leave   tokens/accent.indigo.tokens.json
untouched        leave   tokens/accent.jade.tokens.json
untouched        leave   tokens/core.tokens.json
untouched        leave   tokens/density.compact.tokens.json
untouched        leave   tokens/palette.tokens.json
untouched        leave   tokens/theme.dark.tokens.json
untouched        write   tokens/theme.light.tokens.json
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

The target release's changelog sections above 0.15.0:

```markdown
## [0.16.3] · 2026-10-17

### Breaking

- **The navigation journey moved to `scripts/lib/journey.ts`.** A created project's `tests/navigate-start.test.ts` and `tests/navigate-menu-start.test.ts` import `startFor` and `journeyStart` from `scripts/navigate.ts`, which no longer has them, so they fail the type check until they are brought over. The files are the project's own, so the update does not write them: it reports them as the migration `journey-moved` — bring the release's copies over, and import the journey (`journey`, `journeyStart`, `startFor`, `drawerRoutes`, `prepare`, `liveRefresh`, `Fail` and its types) from `scripts/lib/journey.ts` in a file of your own. `scripts/navigate.ts` keeps the command and `workspaceHomes`.

### Changed

- **The default verify does less twice, and the gate runs its three long checks side by side.** `scripts/gate.ts` runs the type check, the lint and the tests together once the quick checks before them pass, and prints their lines in the same order as before. All three run to the end, so one failure never hides another. The build inside `pnpm verify` no longer type-checks the tree a second time, because the gate has just checked it with the same tsconfig: verify sets `MERIDIAN_TYPES_CHECKED` for that build, and the template's `next.config.ts` reads it as `typescript.ignoreBuildErrors`. Every other `next build` still checks types. An adopted project keeps its own `next.config`, so its verify checks types twice as before, unless it adds that line. Measured from a clean tree on one machine: the gate 22.9 → 15.4 s, the build 14.5 → 9.5 s, the default verify 62.2 → 49.8 s. The release's verify had reached 193 s against its 180 s limit on the slowest runner CPU.
- **Every source file Meridian ships is under 700 lines** ([#41](https://github.com/zhixuan312/zz-meridian/issues/41)). `scripts/navigate.ts` had grown to 775, the only managed file past a ceiling a project may hold its own files to — and a project cannot split a managed file, because the update restores it. The journey and its measurements are `scripts/lib/journey.ts` now (467 lines) and `scripts/navigate.ts` keeps the command and its report (319); nothing either does changed. A test of the package holds every shipped file under `src`, `app`, `scripts` and `tests` to 700 lines, so a release cannot grow one past it again.

### Fixed

- **Today is the product's day wherever a day is cut** ([#42](https://github.com/zhixuan312/zz-meridian/issues/42)). The assistant's prompt told the model today in `app.timezone`, while the prepared query (`today` in `app/api/assistant/route.ts`) and the pages' periods (`readDays` in `src/data/metrics.ts`) cut their days at the UTC date. So east of UTC after local midnight, and west of it in the evening, the model's today and the end of its `7d` window were a day apart, and a day row — kept under its day in `app.timezone` — fell on the wrong side of the cut. **`dayOf(at)`** (`src/lib/format-date.ts`) is the calendar day of an instant in `app.timezone`, and the route, `readDays` and the sample's views (Now's month and its runs by day, Revenue's ladder and trials, a customer's busiest day and trial days left, a new member's joined date) ask it now. A product whose `app.timezone` is UTC sees no change. The route and `src/data/metrics.ts` are the team's own files, so the update reports them as the migration `today-in-timezone` — replace `clock().toISOString().slice(0, 10)` with `dayOf(clock())`.
- **A view whose page is a catch-all route is handed its prepared query at every depth** ([#40](https://github.com/zhixuan312/zz-meridian/issues/40)). The assistant route matched a view's `page` against the address segment by segment and required the two to have as many segments, reading `[...name]` as any one segment and `[[...name]]` as one too: a view on `/docs/[...path]` was the page at `/docs/a` and not at `/docs/a/b`, which the same Next.js route renders, and one on `/docs/[[...path]]` was never the page at `/docs`. The match is `viewAt` in `src/lib/shared-context.ts` now, and it matches as Next.js does — `[...name]` one or more segments, `[[...name]]` zero or more — and where two views match one address it takes the one Next.js renders: a static segment over `[name]`, that over a catch-all. The route asks whether the person may use that view after choosing it, so a less specific view never stands in for the page. `app/api/assistant/route.ts` is the team's own file, so the update does not write it: it reports it as the migration `view-page-matched-as-next` — delete the route's `onPage` and find the view with `viewAt`. `node scripts/ask.ts` asks a catch-all page's questions on a link of any depth, and an optional catch-all's on the page with none.

## [0.16.2] · 2026-10-16

### Breaking

- **A created project's shipped test of the rail fails until it is brought over.** `tests/rail-marker.test.tsx` — the template's test of the rail's marker — stands over a `ResizeObserver` whose `observe` answers with nothing, which only worked because the rail read its own offsets as well. That read is what 0.16.2 removed (see **Changed**), so the file now asserts a marker position that nothing has measured yet. The file is the project's own from the moment it is created, so the update does not write it: it reports it as the migration `marker-measured-on-observe`, with the fix — bring the release's `tests/rail-marker.test.tsx` over as the release has it. Its fake answers `observe` with the callback and reads the marker after that delivery; a test of your own that mounts the rail answers `observe` the same way.
- **The Web Vitals check fails on a dropped frame.** `scripts/vitals.ts` counted frames over 50 ms while its taps played out and printed the number on every line without ever failing on it, so a `verify --full` that passed was not being held to the floor its own header states. It fails now: `frames over 50 ms` must read `0 of N`. Two things about how it counts changed with it. Frames are read **in the tap's own window and no other** — the recording used to run from the moment the page opened, straight through the Escape that closes what a tap opened and the settle after it, which the INP measurement in the same loop already excludes because it is the check's own work and not the person's. And a page that drops one frame is **measured a second time in full** before it is failed, because a single frame in two hundred is inside the noise of the host a four-times throttle is measuring: a page that drops one twice is a page that stutters. A run that was passing still passes; a run that was failing now says so, and names the control the frame was dropped on.

### New

- **`useNavDrawer(asked)`** (`src/components/base/use-nav-drawer.ts`) — whether a navigation drawer is open, for the frame that owns one. It carries the bookkeeping both shells had written for themselves: the drawer opens for every press of the top bar's button that it has not answered yet, remembers the page it opened on so a navigation closes it, and forgets that page when the address moves. The Atlas's copy was missing the last of those, so opening the contents on a phone, following a link and pressing Back re-opened the drawer with nobody pressing anything. A product that wrote the same bookkeeping for a drawer of its own should read it from here.

### Changed

- **The rail reads its own geometry from the observer's first delivery, not by hand.** The rail measured itself with an `offsetTop` read as well as through its `ResizeObserver`, and a rail mounts inside the tap that opens the phone drawer — so that read made the browser lay the whole page out inside the tap: measured at a 50 ms frame on a throttled phone, against 33 ms for the mount alone. The observer's first delivery reports the same numbers after the browser has laid out for itself. Nothing moves while a measurement is missing: the current item draws the same pill itself.
- **The Atlas's front page names the latest release, not the work toward the next one.** It read the first section of `CHANGELOG.md` — which is `[Unreleased]` while a release is pending, and has no version — so the card showed pending work under the version it was going to be released as. It also read the version, the date and the summary with one pattern that refused the `#` of `### Breaking`, the first line under every heading in that file: the date fell to an empty fallback and the card printed `0.16.2 · ` with nothing after the separator, on every release. The heading and the paragraph are read separately now, and the "Full changelog" link no longer shares the kicker's line.
- **`AppMark` names its own gradient.** The mark is a client component now, because each draws a sheen whose id has to be its own: a page holds more than one mark (the Atlas draws one in the phone's bar and one in the shelf, both mounted at every width), and a fixed `id` was a duplicate on every one of those pages, with a `url(#…)` naming two elements. A product that overrode the mark's markup rather than its `app.logo` is unaffected; the first load of `/embed/now` in this template moved 809 → 811 KiB.

### Fixed

- **A new dashboard's own `pnpm verify` failed on a test that named the template.** `tests/embed-page-failure.test.tsx` asserts the embed's way out, and wrote the copy out as `Open in ZZ Meridian` — the template's name, while the frame draws `Open in ${app.name}`. Every dashboard is created under its own name, so the test passed in this repository and failed in every project made from it, at the first `pnpm verify` a team runs. It reads the name from `src/app.config.ts` now.

## [0.16.1] · 2026-10-16

### Breaking

- **The literal-colour rule reads more forms.** `scripts/check.ts` matched `#rrggbb`, `#rgb`, `rgb(`/`rgba(` and `hsl(`/`hsla(`. It now reads a hex of four or eight digits too — `#0a5F`, `#0a58caFF` — and `oklch()`, `oklab()`, `lab()`, `lch()` and `color()`. A gate that passed can fail on a line that writes one of them: use a role or a token (`text-ink`, `border-line`, `var(--…)`), or mark the line `allow-literal-colour` where the colour is genuinely a literal of its own, as an embed's simulated host and a third party's brand are. A colour composed from tokens is not a literal and is not reported, so `color-mix(in oklch, var(--ink) 40%, transparent)` stays as it is.
- **A flag a command does not read is refused, not ignored.** `zz-meridian adopt --dry-run` — and any other flag named outside the command that reads it — exits 1, naming the command it belongs to. A CI step that passed one did nothing quietly; it fails now, which is what it should have done.
- **A figure nobody measured is `null`, not zero.** `RequestSummary.p95` and `RequestSummary.errorShare` (`src/data/requests.ts`) are `null` when the set is empty, and `MetricTile.points` is `(number | null)[]`; `NowData`'s per-model `p95` and `errorRate` are `null` for a model with no usage row. A page, a fixture or a test of yours that builds one of them adds the `null` case; a tile whose point is `null` draws a gap where it drew a fall to zero, and the request log says "not measured" where it said `0ms` and `0.0%`.
- **The audit's two truncated-value rules mean what the card contract says.** `scripts/audit.ts` accepted any `title` anywhere near a cut value without comparing it with the text, and read `aria-labelledby` as the attribute's own value instead of resolving the ids it names. Both compare now, so a `verify --full` that passed can fail: put the whole of a cut value in a `title` that *holds* it (a title of something else keeps none of it), and name a real element with `aria-labelledby` — an id that is nowhere is a control with no name. `CONTRIBUTING.md` promised both all along.
- **The backend gate refuses a data URL it cannot read the host of.** `unsafeBackend` (`scripts/verify.ts`) skipped a value it could not read the host of, which is how a DSN written without a scheme (`user:pass@db.prod.example.com:5432/app`), a password holding a `/` or a `#`, or a libpq line (`host=… user=…`) reached the presses. The authority is read with its credentials dropped, a value whose host still cannot be read is refused rather than skipped, and a host named in the query string is read the way libpq reads it — `postgres:///app?host=db.prod.example.com` reaches that host, since libpq takes the host from the query and lets it override the authority, dials `hostaddr` when both are named, keeps the last value of a keyword it is given twice, and treats `/…` as a Unix socket, which stays local. A file scheme that names a host is another machine's file (`file://db.prod.example.com/share/app.db`) or a database over the network (`libsql://…`) rather than a file of this machine's. A refusal names the way out: point the value at a local copy for the run, or set `allowRemoteData: true` in `scripts/verify.config.ts`.

### New

- **`readAll(name, q)`** (`src/data/read.ts`) answers with every row a collection holds, asking the same question of every page: a list that counts, totals or claims "every" starts there, and a `limit` passed to it is ignored, because its answer means every row. `readEndpoints`, `readServices` and the incident read that joins each ticket go through it, and so do the Members and the Keys view tools and the three pages that list them: the endpoint list, the incidents the bell and Services count, every member, every key and every service are now all of them, where each was the first hundred. A page of yours that read one page of a collection and called it every row reads through `readAll` too.

### Changed

- **Home says no service is monitored yet.** A services read that succeeded and returned no rows had the page's title and its line say "every service is operational" while the page's own fact said "0 of 0 operational". Both say the empty state now, in the words the Services and Now pages already use.
- **`adopt` keeps a commented tsconfig beside the rewritten one.** `adopt` rewrites `tsconfig.json` to raise the target and add the `@meridian/*` path, and `JSON.stringify` cannot hold a comment or a trailing comma. When the team's file carries either, it is kept as `tsconfig.before.json` and the notes say so; a plain tsconfig gets no backup.
- **`brand` reports a flag it cannot use.** `brand --theme purple` printed an uncaught `Error` where `adopt` and `create` answer the same value with a sentence. All three report it the same way now, before anything is copied.
- **The standard names three motion loops.** The token layer defines three (`--dur-loop-spin`, `--dur-loop-shimmer`, `--dur-loop-pulse`) and the Motion floor and the Skeleton card named two. All three are named everywhere now, and `tests/motion-loops.test.ts` holds the count to the tokens.

### Fixed

- **A held-back answer agrees with itself.** The line an answer ends with when the 3,000-character cap holds part of it back read "1 more line are not shown."; it reads "1 more line is not shown.", and the row messages follow.
- **A resumed update keeps the lockfile preimage a killed install left behind.** `--resume` probed the project for the team's lockfile, so a lockfile a killed install had rewritten stood in as "ours" and an abort would have put a half-written file back in place of the team's. It comes from the session's backup now.
- **The prepared query's 3,000-character cap bounds the whole answer.** It bounded the drilled rows, the one part it could shorten, so a summary over budget by itself came back over.
- **`nav-needs` reads a nav item by its braces.** An item a team had spread over its keys was reported as missing a `needs` that was two lines below its `href`.
- **Copy says "Copied" only when the copy happened.** A refused clipboard write left the button saying it had copied.
- **The short date is one function.** `formatShortDate` (`01 Oct`) and `formatDay` (`3 Oct`) in `src/lib/format-date.ts`; six copies of the same expression in five views and a chart preview are gone, and four sentences that wrote the day in two different ways agree.
- **A project created in another timezone passes its own gate.** A shipped test pinned the template's timezone; it states the project's own now, so `create --timezone Europe/London` no longer fails the gate it ships with.
- **A credit reads as a credit.** `formatCost` wrote `$-0.0050` for an amount under a cent; the sign goes before the currency, as `-$0.0050`.
- **Home's focus line states no ratio against a median of zero**, where it printed `NaN×`.
- **A required control inside a `Field` is announced as required.** A `Select` given `required`, or inside `<Field required>`, carries `aria-required` on its trigger, where nothing announced it.
- **Three checks in `scripts/` say what they measured.** A failed performance run shows in the coverage line rather than only in the phase; the keyboard walk prints "and the same in reverse" only when it compared the reverse walk; and `audit --atlas` reads its key list from this repository rather than from the folder it was run in. The pagination card's README no longer claims a page size in the address that the table does not keep.
- **The 0.16.0 section below was corrected in place.** Revenue's own needs were stated twice and one of them wrongly; nothing a product renders changed.

## [0.16.0] · 2026-10-15

### Breaking

- **The sample's pages are renamed.** Overview is Home, Analytics is Usage at `/usage` and Operations is Services at `/services`, with new homes at `/business` (Revenue) and `/engineering` (Now) and no redirect from an old address. The feature ids and the view tools follow: `view_overview`, `view_analytics` and `view_health` are `view_home`, `view_usage` and `view_services`. The embed views are `/embed/home` and `/embed/now` (they were `/embed/overview` and `/embed/health`), and the Services tool names no embed view. The rail labels Operations tickets and Tests and verification are Tickets and Tests; their addresses stay. An update writes none of a project's pages, configuration or views, and reports the migration `sample-pages-renamed` with every file that is one of the old pages or views or still names one. A project that kept the sample's pages as they were brings the release's over: the pages and embed views, `src/views/`, `src/data/`, `src/lib/assistant/` beside `prompt.ts`, `src/app.config.ts` with its own `app` kept, `scripts/verify.config.ts` and the shipped tests, and deletes a listed file the release no longer has. A project that made them its own keeps its own names, which nothing needs to record, makes this release's other changes in them, and gets "not applicable" for the assistant walk-through's steps on Home and Now.
- **The assistant walk-through looks for Home.** `scripts/lib/sample.ts` decides whether the walk-through applies by the folder `(home)` and the file `src/views/home-context.ts`, and `scripts/assistant.ts` and `scripts/fake-llm.ts` name `view_home`. A project that kept the sample's Overview under its old folder gets "not applicable" for that suite until it renames the folder and the file.
- **The sample surfaces include Now.** `SampleSurfaces` in `scripts/lib/sample.ts` gains `now`, true where the console has an `engineering` route and `src/views/now.tsx`. The assistant walk-through watches an approved change's Activity line on Now's "Changes" there, and says not applicable for that step without it. A script or a test of yours that builds a `SampleSurfaces` adds `now`.
- **`daily` is `points`** on the Featured metric and the Metric tile: a point of the page's Meridian need not be a day. Rename the prop where a page passes it.
- **A Metric tile's `finding` names its `tone`.** `finding` is `{ text, day?, tone }` and `tone` has no default: add `tone: 'warning'` to keep a finding as it was drawn, or `tone: 'neutral'` for a fact, which stands beside a neutral dot.
- **A tile, the Featured metric and a Sparkline read the page's cursor only when their points are the page's.** Each reads the pointed point, and a Sparkline draws its hairline and dot, only when it has one value for each of the Meridian's dates, the rule a chart joins by. Before, each read whenever the cursor fell inside its list, so a tile of fourteen days on a page of thirty read the wrong day. One that should follow the page needs a series of the page's length.
- **The Featured metric is a container.** Its section carries `@container`, so its layout answers to its own width, and it no longer sizes itself from what it holds. In a `Row` nothing changes. A card placed in a flex row with no width of its own collapses: give it `w-full`.
- **The sample's collections changed shape.** What customers pay is `revenue`: a day (`DailyPoint`), a period's totals (`Totals`) and a customer hold `revenue` where they held `spend`, in the `days` and `customers` collections and in everything that reads them: `customerFigures(rows).revenue`, `HOME_METRICS.revenue`, `CUSTOMER_METRICS.revenue`, `RevenueData` and Main's business summary. The tiles, the Customers column, the contexts and the view tools say Revenue ("Revenue, last 30 days"), defined as what customers were billed for metered usage, before credits. No figure changed. A customer's `since` is `joined`: `CustomerRecord` and the `customers` collection hold `joined`; a person still reads "Customer since". The Customers table's column key follows, so an address that sorts by it says `sort=joined`. And the sample is one company, and its figures are about ten thousand times larger: a day is some twenty to forty-five million requests and the last 30 days are $3,300,438.74 of revenue, where a day was seventy thousand requests and a month under three hundred dollars. The sample now holds 329 customers where it held twelve; the twelve keep their names and ids. A project reads its own data and is not affected unless it read the sample's: rename the field wherever a page, a test or your own data reads it (nothing answers to the old name), and a test, a page or a guide of yours that pins a figure of the sample pins a new one.
- **Customers sorts by `revenue`.** The list's default sort is `revenue` and an address that names it says `sort=revenue` (it was `sort=spend`); the bell's alert for a customer past due, Home's Business region and the customers view tool build that address. An address that still says `sort=spend` or `sort=since` is not kept working: it is handled as any unknown sort is.
- **The sample's generated records moved to `src/system/fixtures/company.ts`.** `demoSeries`, `demoTotals`, `demoHeatmap`, `ENDPOINTS` and `STATUS_MIX` are exported from there and no longer from `fixtures/sample.ts`. `CUSTOMERS` is there too: it replaces `CUSTOMER_ROWS` of `sample.ts` and `CUSTOMERS` of `sample-records.ts`. `REGIONS` there is each region's requests and `p50`, and replaces both `REGIONS` of `sample.ts` and `REGION_TRAFFIC` of `sample-ops.ts`; `WEEKDAY_HOURS` moved there from `sample-ops.ts`. The type `CustomerRecord` is exported from `fixtures/sample.ts`. Change the import path in a preview or a test that draws the sample.
- **`src/data/sample.ts` exports `REGION_NAMES`, and neither `REGIONS` nor `demoSeries`.** The request filter's list is the four region names, `REGION_NAMES`. The sign-in page reads its 30 days from `signInDays()` in `src/data/sign-in.ts`. A client view imports `src/data/sample.ts`, so it takes nothing from the module that generates the records.
- **A customer can have left.** `status` is `active`, `trial`, `past due` or `left`. A customer that has left keeps its record and is counted in nothing: `customerFigures(rows)` leaves it out of `customers`, `revenue` and `pastDue`, and so do Main's business summary, the bell and every context. The Customers list shows such a customer under the status Left only, which the filter offers, with a neutral badge. A status map of yours keyed by a customer's status needs the fourth key.
- **Every date of a customer is a day.** `joined` is `YYYY-MM-DD`, where it was an instant; `planSince`, `left`, `trialEnds` and `pastDueSince` are the same form.
- **The Customers list is handed a row, not a record.** `CustomersView` takes `CustomerRow[]` (id, name, plan, status, requests, trend, error rate, revenue, joined): pass `rows.map(customerRow)`. `customersContext` takes the same rows, and names five customers on a line where it named 25.
- **The bell reads one alert for the customers past due.** Its id is `customers:past-due` and it says "10 customers are past due", or the customer's name when there is one; there is no alert a customer any more.
- **A day holds more than a file's row.** `DailyPoint` and the `days` collection gain `tokens` and `revenueByPlan`, an object, which `ExportButton` does not take: pass `dayRows(series)` from `src/views/home-context.ts`, which writes the three plans as columns.
- **`endpoints`, `regions`, `responses` and `hours` hold the last 30 complete days.** Each adds up to the requests of those days, and an endpoint's error rate is worked out from them, so the figures moved; their fields did not.
- **The Customers view tool counts every customer.** `view_customers` reads them all, where it read the first hundred, and its `status` takes `left`; `all` is every customer that has not left.
- **`readDays(period)` returns a period of complete days, and the day in progress on its own.** `series` is the period's complete days, oldest first and ending yesterday; `previous` is the same number of complete days before them; `totals` is `{ current, previous }`, and `totals.previous` is `null` when no day comes before; `running` is the day in progress, or `null` when the latest row kept is a complete day. `HomeData` and `UsageData` follow: `totals.previous` may be `null`, and `HomeData` holds `running`. Guard `totals.previous` wherever a page, a test or a context of yours reads it.
- **`all` is every complete day kept, with nothing before it.** `ALL_DAYS` is gone and no constant stands for `all`: `readDays('all')` reads every row of `days` through `readAll()`, 360 days in the sample where it read 180 with 180 before. A figure of `all` has no change: a Metric tile says "No earlier period to compare", the Featured metric draws no change pill, and a context says no previous period is kept. `demoSeries('all')` is every complete day with an empty `previous`, `demoTotals('all').previous` is `null`, and `demoSeries` also returns `running`.
- **The day in progress is the last row of `days`, `usage`, `compute` and `costs`.** Each of the four daily collections holds the clock's own day after its complete days, with what has arrived by the clock, and its description says so: `days` has 361 rows in the sample and `usage` and `compute` 1,444. A sum of yours over one of them that should cover complete days leaves out the rows of the clock's date; `readDays` already does. The fixture arrays `DAYS`, `USAGE`, `COMPUTE` and `COSTS` still hold complete days only, and the day in progress is `IN_PROGRESS` in `src/system/fixtures/company.ts`.
- **A request holds the time to its first token.** `RequestRow` and the `requests` collection gain `ttft`, the milliseconds from arrival to the first token: a number no greater than `latency` where a model that writes tokens answered, `null` where the request reached no model, reached the embedding model, or was refused. A fixture, an action or a test of yours that builds a `RequestRow` adds it. The log is handed `LoggedRequest` rows (`src/data/requests.ts`), the record without it, and `RequestsView`, `requestsContext` and `requestColumns` take those; a request's own page reads the record whole.
- **A ticket holds when it was closed and the incident it tracks.** `Ticket` and the `tickets` collection gain `closedAt` and `incidentId`, each `null` when there is none. Rows of your own typed `Ticket` add both.
- **The sample's incidents are records, not the card's `Incident`.** `INCIDENTS` and `PAST_INCIDENTS` are `IncidentRecord[]`: `owner` is a member's name or `null`, and the ticket is `ticketId`, an id. `readIncidents()` hands a page the card's shape, the owner by name and no id. A preview or a test of yours that hands a fixture to the Incident card strips `owner` and `ticketId` first.
- **A service's uptime is worked out from its days.** No uptime is typed: `uptimeOf(days)` in `src/system/fixtures/sample.ts` is 1 less what the marked days cost, half an hour of the day for a degraded day and two hours for a day of outage, so it is 100% exactly when the strip carries no mark. The sample reads Edge gateway 99.954%, Inference API 99.931%, Embeddings 99.954%, Files 99.884%, Webhooks 99.954% and Dashboard 99.977%, where Dashboard read 100% over a strip with a mark. A strip's last day is the day in progress and is the service's state now. A test of yours that pins an uptime pins a new one.
- **A request is priced at its model's price.** `usageOf()` prices a request from the `models` records and from no list of its own: its tokens at its model's prices a million, the price of a call when it reached no model, nothing when it was refused. The list of $3 and $15 a million tokens and $0.10 a thousand calls is gone, so every cost on a request's page moved.
- **The ticket boundary's refusal for a fixed field has new words.** It reads "A ticket's id, its times and its incident are set by the system and cannot be changed." A test of yours that matches the sentence matches the new one.
- **Home, Usage and Revenue hand their pages a `head`.** `HomeData`, `UsageData` and `RevenueData` each hold `head`, what the page states at its head: `{ title, facts, unknown? }` (`PageHead` in `src/views/fact-insight.ts`), worked out on the server by the view tool's read. Home's `head.facts` are the facts of a year, and `HomeData` holds `line`, the line under its title, where it held `unwell`. A fixture or a test of yours that builds one of the three adds them: `head: { title: null, facts: [] }` draws a page headed by its name, and `unwell: null` says nothing of the services.
- **Now and Services hand their pages a `head`.** `NowData` and `ServicesData` each hold `head`, the page's title and the days inside the band (`PageHead` in `src/views/fact-insight.ts`), worked out on the server by the view tool's read. A fixture or a test of yours that builds one of them adds it: `head: { title: null, facts: [] }` draws a page headed by its name.
- **Now and Services ask for more.** `FEATURES.now.needs` is `{ allOf: ['services:read', 'incidents:read', 'releases:read', 'tests:read', 'days:read', 'usage:read', 'models:read', 'compute:read', 'endpoints:read', 'tickets:read', 'activity:read'] }` and `FEATURES.services.needs` is `{ allOf: ['services:read', 'incidents:read', 'days:read'] }`: Now's title counts the releases in testing, which their verification runs decide, and both contexts count the days inside the band. Every role of the sample that reads the services holds them. A role of yours that does not no longer opens `/engineering` or `/services`: grant it what is missing. Now's eleven are what its read states beside the services, the releases and the days: each model, compute in use, the slowest endpoints, the work and the latest changes.
- **Now's data states what engineering's parts draw.** `NowData` keeps `services`, `head`, `updatedAt` and `now`, loses `current` and `alsoOpen` (`incidents.open` holds every open incident, the most severe first), and adds `line`, `incidents`, `band`, `models`, `compute`, `shipping`, `work`, `endpoints`, `month`, `runs`, `activity` and `unread`, a part being `null` when its read failed. Build it with `nowData(reads)` from `src/views/now-parts.ts`, as `nowTool` does: a fixture or a test of yours that builds a `NowData` by hand builds it there instead. Now's body and its embed take it packed: `PackedNowBody` in `src/views/now.tsx` and `EmbedNow` in `app/embed/now/view.tsx` take `packNow(data)` from `src/views/now-context.ts`, which sends each strip to the browser one character a day; a page or a test of yours that renders either passes its `NowData` through `packNow` first. Now's context no longer lists every service with its latency: it states the services as their summary and each part's figures.
- **An incident a page is handed names its ticket.** `readIncidents()` reads the tickets the incidents name, by their ids, and hands each incident `ticket: { title, href }`, the address being the Tickets page's own search, `ticketAddress(title)` in `src/data/metrics.ts` (`/operations-tickets?q=<its title>`). An incident whose ticket the person may not read, or whose ticket is not found, has none. A test of yours that compares what the read hands with a record stripped of `owner` and `ticketId` adds the ticket.
- **Services' data is its two parts.** `ServicesData` loses `current`, `alsoOpen` and `past` and gains `incidents: { open, resolved } | null`, null when the incidents could not be read; `ServicesBody` and `PackedServicesBody` take it. A page, an embed or a test of yours that builds Services' data passes the new shape.
- **Services no longer draws its grid of services, "Also open" or "Past incidents".** It leads with a Featured metric of uptime over 90 days, then draws "Each service, 90 days", the Status list in the team's order with each service's run, and "Incidents", one list: the open ones first in the Incident card's card form, each with how long it has lasted so far, then the resolved ones in its row form with how long each lasted. A product that copied the old page keeps its copy, or copies the new one.
- **`readIncidents()` no longer returns `current`.** It returns `open`, `past` and `all`; the newest open incident is `open[0]`.
- **`AskAbout` loses `iconBelowSm`.** Services' uptime card was its one user; an Ask always shows its word. Remove the prop where you pass it.
- **The contexts of Now and Services lead with the page's title, then the days inside the band.** A test of yours that reads `insights[0]` of either reads the title now, and `insights[1]` reads "Steady: …".
- **The contexts of Home, Usage, Revenue and One customer lead with the page's title.** The first insight of each is the sentence its page is headed by; Home's second is the title of its year card and Usage's the first day requests passed a threshold, with how many of the period's days passed it. A test of yours that reads `insights[0]` of one of them reads the title now. Some of their sentences are shorter to make the room: Usage says "The hours, the regions, the endpoints and the responses cover the last 30 complete days: they do not follow the period, and none shows a single day."; and three hints of `HOME_METRICS`, which the tiles' info buttons show, lost a few words. One customer's line about its week reads "This week is its requests over the last 7 days, and last week the 7 before." where its title states how the week moved.
- **One customer's head is a trail and a line of figures.** Its kicker is "Business / Customers", two links, where it was "← Customers". Its heading is a sentence ("Northwind Labs paid $409,206.80 in 30 days and sent 9.8% more this week than last") whose text still begins with the customer's name. The line under it is the plan, what the customer paid in 30 days, its share of revenue and its requests. The status Badge and the "See its requests" button left the masthead: the status heads the card of where the customer stands, and "All of them" in Its latest requests opens the log. The label-and-value card ("Requests, 30 days", "Revenue, 30 days") and the Last 14 days card are gone. A test of yours that reads those labels reads the tiles Requests, Paid and Error rate.
- **Home's data states the company.** `HomeData` holds what Home's parts draw: `line`, `revenue`, `customers`, `tokens`, `requests`, `band`, `compute`, `year`, `sold`, `services`, `business`, `engineering`, `worth` and `unread`, a part being `null` when its read failed. `incidents` and `unwell` are gone. Build it with `homeData(reads)` from `src/views/home-parts.ts`; `homeHead` moved there, and `servicesLine` is gone (`homeLine` writes the line under the title). A fixture or a test of yours that builds `HomeData` by hand builds it through `homeData`.
- **Compute cost and gross margin reach only who may read what compute cost.** Home's read asks `can(scope, 'costs', 'read')` once and reads `costs` only on a yes. Only then does `HomeData` hold `computeCost` and `grossMargin`; for anyone else neither key exists and the context names neither.
- **Home asks for more.** `FEATURES.home.needs` adds `usage:read`, `models:read` and `compute:read`. A role of yours that lacks one of them no longer opens `/`: grant it.
- **Home's context is the company's.** It states the customers by status, requests, gross margin (for an Owner and an Admin), the services, revenue and a day's average and best, tokens, the days inside the band, compute in use, compute cost, what we sell, the releases in testing and the open tickets, then the facts of a year and four lines worth knowing. It no longer states Main's summary, the error rate, latency, the error spikes, the endpoints, the responses or the weekly shape. A test of yours that reads `context.facts` under `By status`, `Open tickets` or `Error rate` on Home reads `Customers`, `Engineering` and the rest now. Home's changes no longer name the figure they are against.
- **`HOME_METRICS` is the four traffic figures.** Home's other definitions are `COMPANY_METRICS`. The hints of `requests` and `revenue` are shorter ("Every call answered, at any status.", "Billed for metered usage, before credits."), and Usage's context states the first three.
- **Home needs `facts.concentrationAt`.** `src/app.config.ts` declares it (0.1 in the sample). A project that rewrote `facts` without it fails to type-check.
- **`weekendRatio` and `largest` are gone from `src/lib/insight.ts`.** Nothing of Meridian's reads them. A project created at 0.15.0 imports them in its own `src/views/overview-context.ts` and its copy of `tests/shared-context.test.tsx`, which an update leaves as they are, so it fails its type check: `update` reports the migration `managed-exports-removed` naming each file. Bring Home's context (`src/views/home-context.ts`, with `sample-pages-renamed`) and the test over from the release; a file of your own that still needs one writes the function itself.
- **The payload leaves out every CLI and deep test.** `cli/scripts/build-payload.ts` leaves out every top-level `tests/cli-*` and `tests/deep-*` file, `.ts` and `.tsx` alike, where it left out only `.test.ts`. `tests/cli-customer-page.test.tsx` and the three `cli-*-preview.test.tsx` no longer ship. A project created before this keeps its copies: delete them, since they test the sample's own pages.
- **Home draws the company's nine parts.** `HomeBody` draws the revenue card, the page's one Featured metric, with Customers, Tokens served and Requests beside it. Then come the days inside the band and compute in use (with compute cost and gross margin for an Owner and an Admin), the year's card, "A year, counted", revenue a period beside "What we sell", the Business and Engineering cards and "Worth knowing across the company". The busiest endpoints, the responses by status class, the Error rate and Latency p95 tiles and the activity feed are no longer on Home. `MainRegions` and `homeFindings` are gone. A project that kept the sample's Home and drew one of them draws it from Usage's view or its own.
- **`HomeData` no longer holds `endpoints`, `mix`, `activity` or `summary`.** Home's read no longer reads the endpoints, the responses, the activity or Main's summaries, and `HomeData.year` holds `median`, the windows' median p95. A fixture or a test of yours that calls `homeData` drops those four fields.
- **Main's summaries are gone.** `readMainSummary` (`src/data/main.ts`), `businessOf`, `deliveryOf` and `MainSummary` (`src/views/main-summary.ts`) are deleted. `operationOf` stays, for the bell. Read Home's team cards (`business` and `engineering` on `HomeData`) or the detail pages' own functions instead.
- **Home asks for less.** `FEATURES.home.needs` no longer names `endpoints:read`, `responses:read` or `activity:read`.
- **The embedded Home leads with revenue.** Inline, `/embed/home` draws the revenue card and its three tiles where it drew Requests, Error rate and Latency p95 tiles and the requests trend. Fullscreen draws the nine parts, compute cost and gross margin under the page's rule. Ask on it asks about revenue: "What stands out in revenue over the last 30 days, and why?".
- **Revenue asks for what its parts read.** `FEATURES.revenue.needs` is `{ allOf: ['customers:read', 'days:read', 'usage:read', 'models:read', 'regions:read'] }`. Every role of the sample that reads customers holds all five. A role of yours that lacks one no longer opens `/business`: grant it.
- **Revenue's data is its eight parts.** `RevenueData` holds `period`, `head`, `line`, `days`, `customers`, `sold`, `regions` and `unread`, each part `null` when its read failed. `customers`, `revenue` and `pastDue` at the top level are gone. Build it with `revenueData(reads)` from `src/views/revenue-parts.ts`. A fixture or a test of yours that builds `RevenueData` by hand builds it through `revenueData`.
- **`revenueTool.read` takes a `period`** (7d, 30d, 90d or all; 30d when not given), and Revenue's context names it in its address: `/business?period=30d`. `revenueContext(data, order?)` takes the wall's order, `largest` by default.
- **`revenueHead` takes the `period`** and returns `record` beside the title: `revenueHead({ period, rows, history })`.
- **Revenue needs `facts.nextPlanAt`.** `src/app.config.ts` declares it (0.75 in the sample). A project that rewrote `facts` without it fails to type-check.
- **`windowsOf` is shared.** It is exported from `src/views/home-parts.ts` as `windowsOf(history, length, of)`, where `of` works out what a window holds from its days. Home's year windows are unchanged.
- **A part that could not be read has its own module.** `Unread` and `unreadTile` moved from `src/views/home.tsx` to `src/views/unread.tsx`; the rooms of a period control, `PeriodRoom` and `PeriodActionsRoom`, are in `src/views/period-actions.tsx`. Home and Revenue import them from there.
- **Revenue has no Open customers button.** The wall's footer link, Every customer, is the way to `/customers`.
- **One customer's data holds the product's figures and its latest requests.** `CustomerData` gains `product`, the product's revenue and error rate over the last 30 complete days, and `latest`, the customer's newest requests in the sampled log (`LoggedRequest[]`). Each is `null` when its read failed, and absent for a person who may not read `days` or `requests`. `readCustomer` reads both. A fixture or a test of yours that builds `CustomerData` adds them, or leaves them out to draw the page without those parts.
- **A request's customer opens the customer's page.** On a request's page the Customer value and the head's fact link to `/customers/<id>`, where the value linked to `/requests?q=`. "More from" in the card's footer still opens the log filtered to the customer. `RequestView` takes `customerHref`; without it the name is text.
- **The bell's alert for one customer past due opens its page.** With one customer past due the alert's `href` is `/customers/<id>`. With more it opens Customers filtered to them, as before.
- **Usage's data is its seven parts.** `UsageData` holds `period`, `head`, `line`, `days`, `calendar`, `figures`, `endpoints`, `responses` and `unread`, each part `null` when its read failed. `series`, `totals`, `heat`, `hours`, `regions`, `activity` and `incidents` at the top level are gone: `days` holds `series`, `totals` and `running`, and `figures` holds what `usageFigures()` returns (its type is `UsageFigures` in `src/data/usage.ts`). Build it with `usageData(reads)` from `src/views/usage-parts.ts`. `usageHead` moved there, and its `facts` are the period's, at most three. `usageContext(data, index?)` takes the day the Meridian points at, where it took `{ sort, index }`.
- **Usage asks for what its parts read.** `FEATURES.usage.needs` is `{ allOf: ['days:read', 'hours:read', 'regions:read', 'endpoints:read', 'responses:read'] }`: it no longer names `activity:read` or `incidents:read`, and it names `responses:read`. Every role of the sample holds all five. A role of yours that lacks `responses:read` no longer opens `/usage`: grant it.
- **Usage has no tiles, no Errors per day and no endpoints table.** Requests, Error rate and Latency p95 are stated in the line under the title and in the context. Revenue is Revenue's, at `/business`. Errors per day leaves with its Ask. The endpoints table by p95 leaves, and no page draws it until Now's "Slowest endpoints". Usage's context no longer states each endpoint's p95 and error rate, the slowest and the most failing endpoint, the slowest region or the weekend's share of a weekday.
- **`errorSpikes` is gone, and with it `deviations` and `runs` from `src/lib/insight.ts`.** No page states an error spike. At 0.15.0 their reader was the Overview context, `src/views/overview-context.ts`, which a project created then still holds, with its copy of `tests/shared-context.test.tsx`: `update` reports the migration `managed-exports-removed` naming each file. Bring Home's context and the test over from the release; a file of your own that still needs one writes the function itself.
- **Usage's first says how many of the period's days passed it.** Its line reads "Requests first passed 25.0M in a day on 02 Jan 2026; 192 days have passed it since, and 26 of the last 30 days passed it". With All it is as before. A test of yours that matched the line ending at "since" matches the new one. Usage's context leads with the title, then the first, then the period's other facts.
- **`ACTIONS` entries have no `line`, and `actionLine` is gone.** `ACTIONS[id]` in `src/data/features.ts` is `{ feature, label, needs }`; `line` is gone from the entries and from the type, and `src/views/no-access.tsx` no longer exports `actionLine`. A page that withholds a control draws nothing in its place: delete any `line` you added to your own actions, and any call to `actionLine(id)` beside a withheld control together with what it rendered.
- **`ActionId` is no longer exported.** `src/data/features.ts` keeps the type to itself; write `keyof typeof ACTIONS` where you imported it.
- **The keys, tickets and request views take no line.** `KeysView` and `TicketsView` lose `line`, and `RequestView` loses `replayLine`. A withheld Create key, Revoke, New ticket, state change or Replay is absent, and nothing says who could use it. Remove the props where a page passes them.
- **`FormSection`'s `readOnly` is a boolean.** Pass `readOnly` (or `readOnly={!mayChange}`) where you passed a sentence. A read-only section disables its fields and reads "Read-only" beside its lock, and it says nothing about who can change it.
- **An Owner's row gives an Admin no reason.** `memberAccess(id).reason` is `undefined` when a row is withheld because its member is an Owner. Only the caller's own row carries a reason ("You cannot change your own role.", "You cannot suspend or remove yourself."). A change forced past the page is still refused with `REFUSALS.changeOwner`. A test of yours that expected the reason on that row expects none.
- **A gated page titles itself through `gatedMetadata`.** Every page under `app/(dashboard)/` that opens with `gate` now exports `generateMetadata`, which returns `gatedMetadata(feature, { title })` from `src/data/access.ts`, where it exported a static `metadata`. With `refusal: 'absent'`, a person who may not open the page then reads "Not found" in the tab. A page of yours that keeps `export const metadata = { title: 'X' }` names itself to the people it refuses: write `export function generateMetadata() { return gatedMetadata('<its feature>', { title: 'X' }); }`. `gatedMetadata` reads nobody under `explain`, so the title stays in the prerendered shell.
- **A gated route's loading state passes its name through `gatedLoading`** (`src/data/refusal.ts`, which reads only the configuration, so a loading state pulls in nothing of the gate). A `loading.tsx` of yours that writes `<LoadingPage name="X" title="Y">` on a route that opens with `gate` names the page to the people it refuses under `refusal: 'absent'`: write `<LoadingPage {...gatedLoading({ name: 'X', title: 'Y' })}>`, and pass a kicker or a line of the page's own words through it too.
- **`src/app.config.ts` declares `refusal`.** `src/data/access.ts` and `scripts/verify.config.ts` of the sample import it, and so do its gated loading states and `app/not-found.tsx` through `access.ts`; an update writes none of these files. A project that brings any of them over from this release adds `export const refusal: 'explain' | 'absent' = 'explain';` beside `facts` (`update` lists it as the migration `refusal-declared`). A project that keeps its own files needs nothing: a `scripts/verify.config.ts` without `refusal` makes `verify --as` expect the no-access page, as before.
- **Every list a context states is capped and counted.** A context names the first items its page shows, in the page's order, and then how many more there are in the product's words ("and 15 more resolved"), so it fits 2,600 characters with four to eight times the sample's records. Services states its first six services ("18 more services: 24 in all"), its first two open incidents ("And 4 more incidents open, 6 in all.") and its newest three resolved incidents. Now states its first open incident, its first four models, its first three releases in testing and three ready, and the first four tickets that are high priority or that nobody owns. On both pages "Services now" names the first service that is not operational and counts the rest. API keys names eight keys where it named 25, and five of the unused keys and five of those with every scope where it named all of them. Members names 24 people where it named 25, three of the quiet members and three of the invitations where it named ten, and five of those who can change the workspace where it named ten. The sample's contexts are unchanged, apart from the line below. A test of yours that reads a context's lines past these counts reads the count instead.
- **Services quotes the first sentence of an open incident's latest update.** Its context reads `latest update after 2.6h: "p95 back under 650ms."`, where it quoted the whole update; the page still draws all of it. A test of yours that matches the whole update matches the first sentence.
- **Usage opens at the day its address names.** `UsageData` holds `day`, the day the address names (`?day=`) or null, and `UsageBody` opens its Meridian pointed at it, as Home does; pointed at a day, Usage's context names `/usage?period=30d&day=2026-09-21`. Add `day: null` where you build a `UsageData` yourself, and `day` to the reads you hand `usageData`.
- **A collection has an `aggregate`.** A collection written by hand adds one: `aggregateRows` over its rows for a table it holds in memory, or one grouped query for a database.
- **A view tool has a prepared query.** `defineViewTool` takes `page`, the console route of the page the view renders (a rail page's `href` in `nav`, or `/customers/[id]` for a detail page), and `explore`, its prepared query (`src/lib/explore.ts`, which an update brings), which is now required: what an agent may ask of the page's own collections, answered as text with its window, its units and its rows' addresses. The assistant is handed the `explore_<view>` of the page the person is on, and no other page's. A view tool of yours adds `page` and declares its prepared query beside its page, or it fails the type check and `tests/explore-contract.test.ts`; its page's specification gains, under `## Agents`, a section `### What the agent does here`: `Protagonist: <name>.`, then at least three questions a person on the page asks that its context does not answer alone, each with what the prepared query is asked. `node scripts/check.ts` fails a product's own specification without the section. `update` reports the migration `view-tool-page-explore` for each file with a `defineViewTool` call that lacks `page` or `explore`, and `agent-does-here-section` for each page specification the gate will ask it of.
- **The assistant has no `query_<name>` tools.** It reads through `view_<name>` and `explore_<view>`; a prompt or an MCP server that named `query_*` names `explore_<view>`. On a page, the route hands the `create_`, `update_` and `remove_` tools only for the collections that page's prepared query reads (the members' on Members, the keys' on API keys; none on a page with no view), their ids come from the query's drilled rows, and asked for a change another page makes, the assistant gives that page's address. `queryInput` is gone from `src/lib/collection.ts`, and `scopedQuery` from `src/lib/assistant/scoped.ts`: a project whose own `src/lib/assistant/tools.ts` or test (`tests/collection.test.ts` at 0.15.0) imports `queryInput` fails its type check, and `update` reports `managed-exports-removed` naming each; bring `src/lib/assistant/tools.ts`, `src/lib/assistant/respond.ts` and the test over from the release; `respond` takes `readable`, every collection the person may read, for the limits its prompt states, beside `collections`, the ones it hands writes for.
- **The assistant is told what is true of the person.** Its system prompt lists the console addresses the person may open and tells it to name no other, says a change exists only as the Proposal a write tool returns, and says some records exist that the person may not read, never that something is not in the product. Under `refusal: 'explain'` only, it names each collection the person may not read and the roles that can. On a page that hands its prepared query, it is told to count, group and compare with `explore_<view>`. `systemPrompt` takes this as an optional last argument (`Audience`) and `respond` as `audience`: a route of your own that calls `respond` passes it to get these lines.
- **The days and the services carry what Now's and Services' prepared queries count.** `days` derives `inBand`, true when a day's p95 is under `facts.band.p95Under` and its errors over its requests under `facts.band.errorRateUnder`, the rule the steady fact counts; `services` derives `uptimePercent`, its uptime times 100. Both are `derived`: worked out in the rows and by `derive`, and set by no write. A product that serves `days` or `services` from its own store derives both, or Now's days inside the band read 0 and Services' uptime reads no value.
- **The assistant's thread is one person's, for one tenant.** `loadThread(storage, scope)` and `saveThread(storage, scope, messages)` take the scope the thread is kept for, and the stored thread is `{ v: 2, scope, messages }`: a thread stored before loads empty once. Wrap the shell in `AssistantScope` (`src/components/patterns/assistant/scope.tsx`) in your dashboard layout, handing it the promise of `<tenant>/<subject>`, as `app/(dashboard)/layout.tsx` does; without it the thread is kept under no scope. The panel names the scope with every request: refuse one that is not the caller's with 409, as `app/api/assistant/route.ts` does, and the panel clears the thread and says why. A test of yours that calls either function passes the scope.
- **`Audience.withheld` names pages, not a page.** Each entry holds `pages` (`{ label, address, open }`: every page that shows it to the roles that can, and whether this person may open it) and `derived` (what a prepared query works out from it) where it held `page`. A route of yours that builds the audience builds the new shape, as `app/api/assistant/route.ts` does from each view's prepared query.
- **`tests/assistant-withheld-route.test.ts` no longer ships.** It read the sample's own pages; its cases are in `tests/cli-assistant-withheld-pages.test.ts`. A project created before this keeps its copy: delete it. Its copies of `tests/assistant-thread.test.tsx`, `tests/assistant-safety.test.ts` and `tests/assistant-settings.test.tsx` call the thread without a scope or store `v: 1`: bring them over as the release has them.
- **An aggregate's group of rows with no value is keyed `null`.** `AggregateResult`'s `groups[].key` is `string | null`. Grouped by a field, the rows where it is null or missing are one group keyed `null`, where `aggregateRows` keyed them `"null"`, a string a field may really hold. A condition names them: `eq null` and an `in` list holding null keep those rows, `ne null` keeps the rest, and `ne` of any other value still keeps them. A collection of yours that answers `aggregate` from a database keys that group `null` and matches those conditions the same way. Code of yours that reads a group's `key` handles null.
- **Home's `sold` stops at four models and "Other".** `HomeData.sold` holds the four largest models, then one part, `{ key: 'other', label: 'Other' }`, summing the rest, each with its share of all revenue (`SOLD_SLOTS` in `src/views/home-context.ts`); the page and the context state the same parts. A page, a context or a test of yours that read every model from `sold` reads the `usage` rows for the rest.
- **Now names the usage and the models apart.** `NowData.unread` says `the usage` when the usage could not be read and `the models` when the models could not, where it said `the models` for either. `NowData.compute` is `null` without being unread when the compute was read and holds no complete day yet, and the part says none is recorded. A test of yours keyed on the old name matches the new one.
- **A Column chart's value may be `null`.** `Column.value` is `number | null`, and so is each of `StackedColumn.values`: a period with no data keeps its slot, draws an empty track and reads "No data" (or the word passed as `noData`), never 0. Code of yours that types its own figures as `Column[]` and reads `value` as a number types them `(Column & { value: number })[]`, or handles `null`.
- **`yearLine` takes the history, not the windows.** `yearLine(windows, length)` in `src/views/home-parts.ts` is `yearLine(history, length)`: pass the complete days kept, oldest first, and it cuts the windows itself.

### Added

- **Now draws its twelve parts.** `/engineering` keeps its title and gains a line under it: the open incident's updates timed from its start, the services and the days inside the band, then who Engineering is for. Then "Services, now", the Status list with each service's run and a link that counts every service ("All 6 services"); past eight services it lists the ones not operational, then the three with the longest current runs (`servicesShown`). "Open incident" is the Incident card with its owner and its ticket; several are "Open incidents", the most severe first; with none, the part says when the last was resolved and how long it lasted. "357 of 360 days inside the band" is the Uptime bars over the last 360 complete days with four facts. "Models, now" and "Slowest endpoints" are Data tables, "Compute in use" a Bar list by region, "Shipping" the releases in testing with what holds each, the ready ones and the live versions, and "Work" the open tickets, high priority first and then those nobody owns, the reader's own marked "Yours". Four tiles count the last 30 complete days (Releases out, Tickets closed, Runs passed, Incidents resolved) beside "Verification runs a day, by how they ended", a stacked Column chart with tones. "Changes" is the Activity feed, kept live with `useLive(['activity'])`. A part whose read failed says so in its place; with nothing arrived the page is one card, "No services yet". The loading state keeps the masthead's room, and at 390px the tiles are one column and each table a list.
- **Uptime bars take `endLabel`.** The caption's right end reads "Today" by default; a strip of complete days takes the latest of them as `end` and names it in `endLabel` ("02 Oct 2026"), as Now's band does, so the caption never calls yesterday "Today".
- **The Incident card's `afterStart(started, at)` is exported.** It writes when an update came, counted from the incident's start ("after 42m", "at the start"); Now's line under its title times the open incident's updates with it, so the line and the card never differ.
- **Business opens on Revenue and Engineering on Now.** Each workspace has a home of its own: `/business` shows the customers, what they paid in 30 days and who is past due, and `/engineering` shows every service as it is now and the incident nobody has resolved. Both are a first, thin form that reads what the product already records. Each has its feature, its view tool (`view_revenue`, `view_now`), its context and its specification.
- **A customer has a page.** A row of Customers opens `/customers/<id>`, and an id that names no customer draws the missing-record page. Its feature asks what the list asks, so a person refused the page is led back into Business.
- **The journeys walk every destination.** `journeys/workspaces.ts` opens each of the fifteen rail destinations as an Owner, under the title its navigation check names and in its workspace; opens thirteen as a Viewer and is refused Members and API keys by name; and opens a customer from the list and a customer that does not exist.
- **The Trend chart draws a last point that is still running.** `TrendChart` takes `running`: the last point is a period not over yet, such as today. Every area and line is drawn solid as far as the last complete point, and the stretch into the running one is a stroke of its own, 1.5px and dashed in the line's colour, with no area and no glow under it. Stacked, the bands end at the last complete point and the total's line alone carries the dashed stretch. That point's readout says "so far" beside its date, and so does its row of the screen-reader table. A `dashed` reference is drawn as before, and a chart without `running` renders exactly as it did.
- **The Heatmap draws a year of days.** `Heatmap` takes `days` (`{ date, value }` for each calendar date, oldest first) in place of `values` and draws a calendar: a cell a date, a column a week of Monday to Sunday, a row a weekday, each month named above the column that holds its first day. It shows as many of the latest weeks as fit at 12px a cell and says how many of how many ("The latest 19 of 52 weeks"), and its table lists every day whatever is drawn. The grid is one Tab stop: the first key places the cursor on the latest day, Up and Down move a day, Left and Right a week, Home and End go to the first and the last week shown. `running` marks the last day as still in progress, with a dashed outline and "so far"; `meridian` points the page's Meridian at the day read when the Meridian holds it. A date is read as the day it names, whatever `app.timezone` is.
- **The Heatmap ranks its cells by quantile when asked.** `scale="quantile"`, on either form, ranks the cells above zero into five steps of equal count, so one outlier no longer leaves every other cell at the lowest step, and the legend's upper end reads the value the top step starts at ("900 or more"). `max` stays the default.
- **The Column chart draws parts of a whole.** `ColumnChart` takes `parts` (`ColumnPart[]`) with `columns` whose `values` hold one value a part, the first at the bottom (`StackedColumn`), and draws each column as its parts. Parts with no `tone` share the accent, deepest at the bottom and paler upward, by `stackPart`, the mix the stacked Trend chart takes; when the parts are outcomes each carries a `tone` (`neutral`, `warning` or `critical`), a part with none is neutral, and the accent never stands beside a tone. Only the topmost part is rounded, a 1px hairline of the card parts neighbours, a part that is not zero is at least 3px tall and a part at zero is absent. At most four parts are drawn: given more, the fourth is "Other", the sum of the fourth and every later one. The axis is the total's. Two or more parts bring a legend above the plot, in stack order, with square swatches. The pointed column takes a 2px ring in `ink` and a readout names the period, every part from the top down and the total; the hidden table lists every period with each part and its total. The readout shows only on the chart being pointed at; a chart that follows another chart's cursor rings the day and keeps its panel hidden. `Column`, `StackedColumn`, `ColumnPart` and `ColumnChartProps` are exported.
- **The Column chart draws a period still running.** `running`, in either form, says the last column is not over yet: its fill is drawn at half strength inside a dashed outline, open at the baseline, and its readout, its announcement and its row of the table say "so far".
- **The Column chart takes its card's height.** `height="fill"` takes the height the card gives it, never under 220px, as the Trend chart does: the plot takes what the legend and the labels leave. The chart's parent must be a flex column.
- **The Column chart is one Tab stop.** The plot is a `role="group"` named "{label}. Use the arrow keys to read one column.": Left and Right move a cursor a column, Home and End go to the ends, Escape and blur let go, and a first key starts from the last column. It is the cursor the pointer moves, and with `dates` it is the page's Meridian. The column pointed at is read in an `aria-live` line.
- **The contrast gate measures the deepest part of a stack.** `node scripts/contrast.ts` also mixes the accent into the surface at the theme's `chart-stack-hi`, in OKLab as the browser mixes it, and holds the result to 3:1 against the surface in every theme and accent: 352 measures where there were 344, printed by `--all` as "the deepest part of a stack". The marks it mixes are `MIXES` in `scripts/lib/contrast-pairs.ts`, beside `PAIRS`. Every accent `scripts/brand.ts` yields passes on the shipped themes; a project that has changed `chart-stack-hi` or a theme's surface may now fail the gate, and raising `chart-stack-hi` in that theme is the answer.
- **One function for the colour of a part of a stack.** `stackPart(place, parts)` in `@/components/charts/scale` is the mix a part of a one-hue stack takes, by its place from the bottom; the Trend chart calls it in place of its own. `monotonePath` takes an optional `from` and `to`, which draw one stretch of the same curve.
- **The Meridian can be let go from outside a chart.** `useClearMeridian()` joins `usePointMeridian()` in `@/components/charts/meridian`: it returns a function that clears the page's cursor, and does nothing without a Meridian.
- **Two formatters for a calendar date.** `formatCalendarDate('2026-10-01')` reads "Thu 1 Oct 2026" and `formatCalendarMonth` reads "Oct", from the date's own year, month and day. `formatDate` reads a date-only string as midnight UTC and prints it in the product's timezone, which is the day before west of UTC; use the new pair where the string names a day and not an instant.
- **The Featured metric draws a finding and a foot.** `finding={{ text }}` is one fact the figure does not say, on one line under the change and the caption, beside a neutral dot. `foot` is a band inside the lit surface, under the chart and divided from it by a hairline: a `dl` in it is drawn as supporting figures, each `dt` a label over its `dd`, and the one link after the list goes to the far end.
- **The Featured metric reads points that are not days.** `compare` is what the change is against, in the caller's words ("vs the week before"; "vs previous period" by default), and `pointLabel` names the pointed point from its date ("Week of 14 Sept"; the date by default). With the Column chart at `height="fill"`, a week or a month can be the featured chart's point.
- **Two figures of equal standing share the one featured card.** `peer` takes a second figure (`FeaturedFigure`: its kicker, value, points, change, caption, finding and chart) and draws the two as halves of one lit surface with a hairline between: side by side on shared rows from 42rem of the card's own width (588px), one above the other below that. The actions and the foot stay the card's. A page still has one `FeaturedMetric`, and `node scripts/check.ts` still fails a second. `FeaturedFigure` and `FeaturedMetricProps` are exported.
- **The Incident card names who has an incident and where it is tracked.** `Incident` takes `owner` (a name) and `ticket` (`{ title, href }`). The card draws a second caption line under the service and start time, "Owner Jonas Weber · Ticket Inference API p95 above target in eu-west-1": the owner as text, the ticket as a link to `href` named by the ticket's title. Either stands alone, with neither nothing is drawn, and the `row` form names neither. Both are the team's: do not pass them to a card customers read.
- **The Status list says how long each service has run.** `StatusList` takes `run`: under each row's bars it reads "Operational for 69 days · its longest in 90" when no run among the days kept is longer, "Operational for at least 90 days" when no day kept has a mark, and "Degraded today" or "Down today" when today has one. The days are counted from `days`, whose last day is today whatever `status` says. Without `run` a row is as it was.
- **`src/lib/facts.ts`, the rules behind a page's facts.** Its first rule is `runOf(days, good)`: the length of the run that ends today, whether it reaches the earliest day given, and whether it is the longest among them. It is pure and managed, so an update brings it.
- **The Metric tile has a compact size for a wall of many.** `size="compact"` draws the name, the change's figure, one line that is the figure and then the `note` ("$41.2K · Scale"), and a 28px Sparkline. It does not draw the words of `compare`: the card that holds the wall says what the change is against, once, and a screen reader hears the words after the change. It draws no figure at the figure size, no hint, no icon and no finding, whatever it is passed, and its line keeps the period's figure whatever the page points at. The tile reads its own width: from 14rem (196px) the change stands at the right of the name's row and the line has the whole width under them; narrower, the name, the change and the line are three rows. A compact tile is a container, so in a flex row with no width of its own it collapses: give it a grid cell or `w-full`.
- **What the company sells, and at what price.** The `models` collection holds four rows, `meridian-large`, `meridian-swift`, `meridian-embed` and `none` for the calls that reach no model: the route each serves, `inputPrice` and `outputPrice` in US dollars a million tokens, and `callPrice` in US dollars a call. It is the one place money comes from, and every role reads it.
- **What each model answered each day.** The `usage` collection holds a row a day a model, keyed `<date>:<model>`: `requests`, `inputTokens`, `outputTokens`, `revenue`, `errors`, `p95`, and `ttft` and `tps` for the models that write tokens. A model's day is its tokens at its price, to the cent, and a day of `days` is the sum of its four rows. Every role reads it.
- **Compute, and what it cost.** `compute` holds a row a day a region: `gpus` provisioned and `used`, the GPU-hours used. `costs` holds what a day's compute cost in US dollars. Every role reads `compute`; `costs` is read under the new grant `costs:read`, which only an Owner and an Admin carry, so a Member, a Viewer and an add-on alone are refused it by a page, a tool and the assistant.
- **A customer's record holds its life with us.** `tokens` and `byEndpoint` (requests by route) over the last 30 complete days, `planSince` and `previousPlan`, `left`, `trialEnds`, `pastDueSince` and `owner`, a member's name. Over those 30 days the customers' revenue is the days' to the cent and their requests are the days', the endpoints' and the regions'.
- **Helpers beside the customers' figures.** `kept(rows)` is the customers a figure counts, `under(rows, status)` what the list shows under a status, `customerRow(record)` the fields a row draws, and `pastDueFact` and `pastDueNote` say who is past due once, for a context and for a tile.
- **A test that no page's client runs the generator.** `tests/client-imports.test.ts` walks the imports of every client module under `src/views/` and the pages and fails when one reaches `src/system/fixtures/company.ts`. It skips itself in a project that has replaced the sample.
- **An incident names its owner and its ticket, and the ticket names it back.** The `incidents` collection holds `owner`, a member's name, and `ticketId`; the `tickets` collection holds `incidentId`. The sample's open incident is owned by Jonas Weber and tracked in the ticket "Inference API p95 above target in eu-west-1"; of the three resolved, two name an owner and one names nobody. The Incident card on Now and Services names the owner of the incident it leads with. Reading either needs no new grant.
- **A ticket says when it was closed.** The ticket boundary sets `closedAt` to the clock when a change moves a ticket into closed and clears it when one is opened again, ticket by ticket: in a change to several, a ticket already closed keeps its own time. Nobody sets it or `incidentId`: a change that names either is refused, and both are `pageOnlyFields`, so an agent reads them and no agent tool asks for one.
- **The request log says it is a sample.** The `requests` collection's description tells an agent it is a sample of the requests received and sends a count to `days` and `usage`. A request's context states its tokens and what it cost, as its page does.
- **`uptimeOf(days)`** is exported from `src/system/fixtures/sample.ts`, for a preview or a test that changes a strip and wants the figure to follow.
- **A page can be headed by a sentence.** `PageFrame` takes `name` beside `title`: a page that leads with figures passes its name and a title that is a sentence about them. The heading is still one `h1`: the name first, read out and not drawn, then the sentence in the section role, balanced. The top bar shows the name, and the document's title is unchanged. `title` may be a part that reads data: the heading is in the first HTML with the name and two bars in the sentence's block, the sentence takes their place, and the block keeps room for the lines a sentence may wrap to (four, three, two or one, by the heading's own width), so nothing under it moves. For the same reason the kicker and the heading have a row of the masthead's whole width to themselves: the description stands under them with the meta and the actions beside it, at the row's end, or at its start when the page has no description. A title that renders nothing leaves the name to head the page, and a page that passes no `name` is drawn exactly as before, its title, description, meta and actions on one row. `PageTitle` is the heading alone. The Shell's README specifies it under "The title".
- **A loading state holds the block of a sentence.** `LoadingPage` takes `sentence` for a page headed by one: `title` is then the page's name, kept in the heading for assistive technology and shown in the top bar, and the frame draws the sentence's placeholder in the block the sentence will take, so the heading is as tall while the page loads as when it has arrived and the body does not jump. Pass it from the `loading.tsx` of any page that passes `PageFrame` a `name`. A loading state without it is unchanged.
- **Home, Usage, Revenue and One customer are headed by what their figures say.** Home: "The highest 30 days yet: $3,300,438.74, the 3rd record in a row", or the revenue's change on the period before and whether every service is operational. Usage: "1.1B requests in 30 days, the busiest 30 days yet", or the requests against the period before. Revenue: "All 24 Enterprise customers sent more this week than last, in the highest 30 days yet", or how many customers paid how much. One customer: what it paid and how its week is moving, or that it is past due, on a trial or has left. Each is a function with a test for every branch (`homeTitle`, `usageTitle`, `revenueTitle`, `customerTitle`, in `tests/titles.test.ts`). These four are the sample's own words: a product replaces them, and `skills/zz-meridian/references/customize.md` says which of this is the standard to keep and which is the sample's to replace.
- **Now and Services are headed by what is wrong and how long things have held.** Now: what is wrong first, then what is waiting to ship: "Inference API is degraded, and 3 releases are in testing", or "Files is down", "2 services are degraded", "All 6 services are operational", then ", and no release is in testing" or how many are. A release is in testing as the Releases page counts it. Services: "99.94% uptime in 90 days, and Dashboard has run 69 days without a mark". The uptime is the one the page states for its 90 days. The run belongs to the service whose current run is the longest, the team's order deciding a tie, and is named only when it is that service's longest and does not reach back to the first day of its strip. A page that cannot read its releases or its days states what it can and its context says what it could not read. Each title is a function with a test for every branch (`nowTitle`, `servicesTitle`, in `tests/titles-engineering.test.ts`). They are the sample's own words: a product replaces them (`skills/zz-meridian/references/customize.md`).
- **Two more rules that find a fact.** `run(days, good, { name })` in `src/lib/facts.ts` says how long a state has held up to today: "Dashboard has run 69 days without a mark, its longest in 90", "at least 90 days" when the run goes back to the earliest day given, and nothing when today is not the good state. It is worked out by `runOf`, which the Status list still draws. `steady(days, band)` counts the complete days inside the band and names the days outside it by date, the first three and then "and N more": "357 of 360 days inside the band of p95 under 350 ms and errors under 1%; outside it on 17 Aug 2026, 21 Sept 2026 and 22 Sept 2026". A day at an edge of the band is outside, and so is a day with no requests. The contexts of Now and Services state it over every complete day kept, with `facts.band`. `tests/facts-engineering.test.ts` holds the two rules.
- **Now and Services wait for their title under their name.** Their `loading.tsx` passes `sentence`, so the heading keeps the room of the sentence that replaces it.
- **Four rules that find a fact.** `src/lib/facts.ts` gains `record` (the latest period is higher than every one before it, with how many in a row), `first` (the first day a threshold was passed, and how many days have passed it since), `all` (every member of a set did the same thing, written N of N) and `total` (the sum of everything recorded, with its first day and its latest). Each returns its fact with the one line it wrote, or `null` when its rule does not hold, and each has a guard: a record needs a set number of periods of history, a first needs the records to begin below the threshold, an "all" fails one member short. `periods(values, length)` sums a history into whole periods for `record`. No line holds a word of praise. The file is managed, so an update brings it, and `tests/facts.test.ts` holds it.
- **`facts` in `src/app.config.ts`.** What the rules are handed: `recordNeedsPeriods` (6), `firsts.requestsADay` (10, 25 and 50 million) and `band` (a p95 under 350 ms and an error rate under 1%, which Now and Services hold every complete day to). A rule holds no figure of its own: change a value and what the pages state changes. The values are the sample company's.
- **`ordinal(n)`** in `src/lib/format.ts`: "1st", "2nd", "3rd", "11th", "21st".
- **A fact reaches a context through one function.** `factInsight` in `src/views/fact-insight.ts` writes the kind's name before the rule's own line ("Total: 9,600,136,928 requests answered in 360 days, from 08 Oct 2025 to 02 Oct 2026.") and carries its evidence; `headInsights` puts the title before the facts. A view's read works both out on the server and hands the page sentences, never the history.
- **`formatCompact` reads trillions.** 2,234,100,000,000 is "2.2T", and a count that rounds up to a thousand of one step is written in the next: 999,960,000,000 is "1.0T" and 999,960,000 is "1.0B".
- **Two rules say more of their own fact.** `record` takes the `day` its latest value is about, and `week`, and names the day in its line ("The highest day of requests yet: 44,940,181, on 01 Oct 2026"). `total` takes `share`, a part of each day's figure, and adds the part's share of the sum ("…, 99.62% of them without an error"). Its fact now carries `day`, its latest date. Both arguments are optional.
- **Home's lines worth knowing.** The open incident; a customer paying `facts.concentrationAt` or more of the revenue of the last 30 days, with how many others do; a release ready to go out; the customers past due with what they were billed. Each carries the address where it is handled.
- **Helpers.** `allSentMore(rows)` in `src/views/customers-context.ts` (Revenue's title and Home's Customers tile share it). `totalsOf(days)` is exported from `src/data/metrics.ts`. `change()` in home-context, called without `format`, leaves out the figure. `src/data/sample.ts` re-exports the types `ComputeRow`, `CostRow`, `Model` and `UsageRow`.
- **A loading page holds the masthead its page will have.** `LoadingPage` takes `kicker` and `meta` (the page's own, when they read no data), `lead` (the room of a long sentence under the title) and `actions` (what stands where the page's controls will, as wide as they are). `LeadRoom` keeps the room of a long sentence under a title: three lines of the lead at its widest, up to six on a phone. A page draws its sentence inside it, and its fallback is the empty one, so the masthead keeps one height from the loading state to the page. Home uses all four. A page whose sentence is a line of figures and who it is for passes `lead`.
- **A Bar list opens the row it names.** A row with an `href` draws its label as the one link to that address, named by the label: the bar, the meta line and the figure are not a second link, and the folded "N others" row opens nothing. At rest the row looks as any row does; its label takes the accent on hover and the focus ring on the keyboard, and answers a 44px target on a phone. `BarItem.href` was declared before and never drawn, so a list that already passes it gains its links with no change. Give rows an address when each names a record that has a page (`docs/data-display.md`, "Interaction").
- **Revenue draws its eight parts.** `/business` has the period control and Export of the period's days. Then come four tiles: Revenue, its record as the finding; Against a year ago, naming the window it is against; Best day yet; and Past due as a count and a share. Then revenue a day by plan, beside who pays; revenue a period by plan; "Every customer, the last 14 days", eight compact tiles in three orders, each tile one link to its customer; "From a trial to Enterprise", a Bar list a stage, two customers each and "N others" summed, a customer close to the next plan saying so; "Worth a look"; and what they buy beside where they are. Each part about customers names its window, and every customer the page names opens its page. It has its loading state, which keeps the masthead's room, and its empty and partial states. Its context fits 2,600 characters at every period.
- **`src/data/sample.ts` exports `PLANS` and `Plan`,** for a client view that draws the plans.
- **One customer draws its parts.** `/customers/<id>` draws the head; a card of where the customer stands and since when ("Past due since 01 Sept 2026", "On a trial that ends on 23 Oct 2026", "Active since 06 Apr 2024", "Left on 24 Nov 2025"), with its owner on our side; three tiles, Requests (this week against last, the busiest of its 14 days as the finding), Paid (its share of revenue) and Error rate (the product's own in its line); "What it asks for", a Bar list by endpoint; and "Its latest requests", the sampled log's newest five from it, each opening its request, with a link to all of them, or one line saying no sampled request is from it. The page has no period control, and every part names its window. Its loading state keeps the masthead's room. A part whose read failed says so in its place, and one the reader may not read is absent. Its context leads with the title and fits 2,600 characters for every customer.
- **Every customer the product names opens its page.** This covers the request log's Customer cell, a request's head and its Customer value, Revenue's wall, ladder and lines worth a look, Home's line worth knowing and the bell. `readRequests(params, { customers: true })` works out each page row's `customerId` on the server from the customers, by name. `LoggedRequest.customerId` is optional, so a row without one draws the name as text, and `requestColumns` draws it as a link only when it is there. A link in a cell is followed as itself and does not also open the row. The Requests embed asks without it, so its customers stay text. `readLatestFrom(name, limit)` in `src/data/requests.ts` reads a customer's newest requests. `skills/zz-meridian/references/customize.md` names the rule as the standard.
- **`LoadingPage` takes a `description`.** It stands where the page's line under the title will be, for a line that keeps a room of its own. One customer passes its `FactsRoom` with a bar in it.
- **Usage draws its seven parts.** `/usage` keeps the period control and Export, and under its title a line of requests a day, the share of errors and the median day's p95. Then come requests a day, with the day in progress running; a year of requests, a day a cell, the Heatmap's calendar on `max`, joined to the page's Meridian, the busiest day as its badge; "The period, counted", at most three facts, each from a rule with its date; "When they come", By hour, a Column chart with the busiest hour highlighted, or By weekday and hour, the Heatmap's hours on `quantile`; "Where from" beside "What is asked for", five endpoints and "N others", summed; and "How it was answered", a Composition bar by status class in status colours. The 30-day parts name their window. It has its loading state, which keeps the masthead's room, and its empty and partial states. Its context fits 2,600 characters at every period.
- **`first` takes a `period`.** `first(days, { thresholds, what, format, period })` is still given every day kept; `period` is how many of the latest days a page's period covers. It returns `inPeriod`, how many of them passed the threshold, and its line says so. It is optional, so a call without it says what it said before.
- **Helpers for Usage.** `readResponses()` in `src/data/metrics.ts` reads the responses by status class through `read()`, 2xx first. `weekdayAverages(history)` is exported from `src/views/home-parts.ts`.
- **A Composition bar can be drawn `stacked`.** With `stacked`, a part with no colour takes `stackPart(place, parts)`, as a stacked Trend or Column chart draws the same part, and its swatch stands on a hairline; Revenue's Who pays uses it, so each plan is one colour on the page.
- **What an address a person may not open draws is the product's choice.** `refusal` in `src/app.config.ts` is declared once and read by `gate` on every call; the call sites do not change. `'explain'`, the sample's choice, draws the no-access page as before: the page's name, who can open it, who to ask and one way out. `'absent'` answers exactly as an address that names nothing: the console's missing page in the shell, at 200, with "Not found" in the tab and the address walked back past every page the person may not open, so a Viewer's `/keys` reads "No page in ZZ Meridian lives at this address." and nothing names the page, a role or who to ask. Under `absent` every gated route's loading state names no page for anyone (`gatedLoading` in `src/data/refusal.ts`, a static choice, so the shell stays prerendered), and the standalone missing page walks an address below a refused page back past it (`withheldEntries`). Neither choice throws `notFound()`; a person with no session is sent to sign-in under both, and a view tool answers "You do not have access to that." under both.
- **`pnpm verify --as` expects the product's refusal.** On every route a persona may not open, it expects the no-access page under `explain`, and the missing page with no no-access page under `absent`. The `deniedProbe` strings must be absent under both. `scripts/verify.config.ts` reads `refusal` from `src/app.config.ts`, and `adopt` writes it into the config it sets up.
- **The missing page can step past what a person may not open.** `nearestOf(path, withheld?)` in `src/views/not-found.tsx`, `MissingPage`'s `withheld` and the `withheld` of `MissingAddress` and `WayBack` leave those entries out of the walk-back. The missing page's card carries `data-missing-page`, and `NOT_FOUND.title` is the tab's "Not found".
- **`view_usage` takes `day`**, as `view_home` does: the context it returns is pointed at that day of the period.
- **`settingsContext` is exported** from `src/views/settings.tsx`, so a test can measure Settings' context without rendering the page.
- **The assistant walk-through asks Usage and Tests through their prepared queries.** On `/usage` it asks "How many requests came at 22:00 UTC on each weekday?" and on `/tests` "How many runs passed in the last seven days?". It holds that the page handed its own `explore_<view>` and no other page's, and that the reply carries the figure of the first group line the tool returned. `scripts/lib/sample.ts` gains `exploreSurfaces(root, appDir)`, which says whether the sample's Usage and Tests are there: each page together with its prepared query's file. A product that replaced either reads its step as not applicable.
- **`node scripts/ask.ts` asks a page's questions of the assistant.** `node scripts/ask.ts --base <url> [--view <name>] [--as <persona>]` asks a served product's assistant every question a page specification lists under `### What the agent does here` (every view's, or the one `--view` names). Each question goes in a thread of its own, on the page's address, a detail page's on the first record its listing links. It signs in as a persona of `scripts/verify.config.ts`: the one `--as` names, else `owner`, else the first declared. For each view it writes `out/asks/<view>.md`: each question, every tool the assistant called with its input and what the tool returned, and the answer. It reads no environment. When `POST /api/assistant` answers 404 (the assistant is off), or no persona is declared, it prints one line saying it did not run and exits 0. Neither `pnpm verify` nor `pnpm verify --full` runs it: a real model's answers are for a person or a reviewing agent to read. `skills/zz-meridian/references/validation.md` says how to run it.
- **`update` names the files this release's breaking changes reach.** Moving a project to this release can report, beside `refusal-declared`, `managed-exports-removed`, `view-tool-page-explore`, `agent-does-here-section` and `sample-pages-renamed`, each with the project's own files that still hold the old shape and one instruction (`references/update.md`). Nothing keeps an old shape working: the update reports it, and the team changes its files.
- **A page can keep a node from the assistant.** A node marked `data-assistant="omit"` is left out of the page text the panel sends (`pageText` in `src/components/patterns/assistant/page-text.ts`). Draw a value shown once, such as a new key's secret or a one-time link, so marked, or outside the scroll region.
- **A Sparkline breaks at a day with no value.** `values` is `(number | null)[]`: a `null` keeps its place and breaks the line and its area there, as the Trend chart's does. The range is the numbers', fewer than two numbers draw nothing, and the page's cursor on such a day draws the hairline alone.
- **A Heatmap of hours names its timezone.** `timezone`, a label such as `Asia/Singapore` or `UTC+08:00`, is printed in the readout, the announcement and the table in place of UTC, which stays the default. The table's corner cell reads "Day (UTC)" where it read "Day".
- **A Form section takes `actions`.** They stand beside its title, on its row on a phone too, as a Card header's do: on a settings page, Ask about goes in the first section's.
- **A rail item can name its feature.** `NavItem` takes `feature`, a feature id, for an item whose need other features share, as every `public` one does; the sample's Settings, Design system and Docs name theirs. The assistant reads from it which records the page shows, so a product that labels Settings in its own words is still told the workspace is shown there.
- **A prepared query's source can name the records a field refers to.** `refers` in `src/lib/explore.ts` takes a field that holds another collection's key, that collection's key field and how its record reads; its groups and drilled rows name the record beside the key, read once per call under the person's rights (one who may not read it sees the key alone). Releases', Tests' and Now's runs name each release: `releases_1 (v4.18.2, Edge gateway, production)`.

### Changed

- **Revenue, Usage, Now and Services lead with a Featured metric.** It comes first after the head on each page. Revenue: the period's revenue with its record and revenue a day, beside the three tiles that remain. The Revenue tile is gone, and the caption states in full the figure the hero rounds ("$3,300,438.74"). Usage: the period's requests with their record and requests a day, in place of "Requests a day". Now: the days inside the band over every complete day kept, with the steady fact and each day's p95; when the days cannot be read, it says so once, in the Featured metric's place. Services: uptime over 90 days with the longest run and the share of services operational a day. Each is marked `data-protagonist` with its page's protagonist (Revenue, Requests, Days inside the band, Uptime) on a wrapper whose display is contents (Revenue's, the wide card of its row, on a wrapper that is that grid item), and carries the page's Ask: Usage's moves from "Requests a day" and Services' from "Each service, 90 days". Each loading state holds its room first. `NowData`'s `band` gains `p95` and `UsageData` gains `record`: a fixture or a test of yours that builds either adds them.
- **Services writes an uptime of exactly one as "100%" and one under one never as a whole one ("99.99%")**, in its title, on the page and in its context; it never writes "100.000%".
- **Services reads its incidents apart from its services.** A read that fails leaves "Incidents" saying it could not be read, and every service stands. Its loading state holds the masthead the page will have, so the body does not move when the page arrives, and the navigation check of `/services` in `scripts/verify.config.ts` waits on "Each service, 90 days" and presses a service's strip.
- **The Now embed's inline banner leads with the most severe open incident**, where it led with the newest. Its fullscreen view draws the whole Now page.
- **The sample's open incident's ticket opens after the incident began.** `tickets_1` is opened three hours before the clock and updated two hours before it, where it was opened six days before an incident that is three hours old. Nothing else in the sample moves. A test of yours that ordered or counted tickets by when `tickets_1` was opened reads the new times.
- **The light theme's stack stands on a deeper part.** `chart-stack-hi` is 0.78 in the light theme (it was 0.72), so the bottom part of a stacked Trend chart is a little deeper there and the parts step from 78% to 36%. At 0.72 the jade accent's bottom part read 2.95:1 against the card; at 0.78 the lowest of the four accents reads 3.28:1. Dark is unchanged.
- **The Heatmap's legend names its empty step.** The legend reads "No requests" (from `unit`) beside the empty step, then "Less", the five steps of the accent and "More"; it used to draw six swatches between the two words. Every cell carries `data-step`, 0 to 5. Nothing else about a week of hours on `max` changes, so the one visible change on Usage is the legend's words.
- **A column's value stands above it at rest.** While a column is at least 36px wide (`(plot width - 2 × (n - 1)) / n`, the plot width being the chart's width less the axis gutter) every column of a Column chart carries its value above it in `ink-3`, or its total when stacked, in the 28px the plot keeps over its top tick; narrower, the value shows for the column pointed at, as before. Usage's two Column charts change with no change to the page: each is a Tab stop with a focus ring, and on a short period, where a column is wide enough, the values stand at rest. Pass a compact `format`: a figure wider than its column is cut with an ellipsis at rest.
- **The charts share one readout panel.** The panel that reads a point beside it, measuring itself so it never leaves its chart, is `Readout` in `@/components/charts/readout`; the Trend chart and the stacked Column chart both draw it.
- **An incident's updates are timed from its start.** Each update of an Incident card reads how long after the incident's start it came, as `formatDuration` spells it ("after 42m", "after 1.1h"), and "at the start" inside the first minute; it used to read time ago ("36 min ago"). The `<time>` keeps its `dateTime` and the exact time in its title, and the head's "started 3 h ago" is unchanged. Now, Services and the Now embed change with no change to the page. A hyphenated name such as eu-west-1 stays on one line in an update and in the ticket's title, as it does in the card's title. A test or a journey of your own that read the old words reads the new ones.
- **A Metric tile given fewer than two points is laid out as a tile given none.** The Sparkline drew nothing from one value already; the tile now takes the no-sparkline layout as well, so on a phone it is the single row and no empty column is kept beside the figure.
- **Usage's axes read the tick they stand at.** Its two Column charts pass `AXIS_FORMATTERS.count` as `axisFormat`; they passed `formatCompact`, which rounds to whole thousands, so on a week the errors axis read "2K" at 1,500. It reads "1.5K". A Column chart's `axisFormat` takes an axis formatter (`AXIS_FORMATTERS` in `@/lib/format`), and with none the axis reads as `format` does, which is right only while `format` is exact.
- **The Heatmap's readout stays inside its grid.** On a week of hours the readout was centred on its cell, so at the first and the last column it ran past the figure. On both forms it now takes its place from the columns before its own and the columns after: centred at the middle of the grid, flush with the grid's edge at either end, and breaking between its value and its date when the grid is narrower than the text.
- **A service that is not up reads "Down" in its row of the Status list.** The row's state word was "Outage" while the summary said "1 service is down" and the run "Down today"; the three now use one word. "Outage" stays the Uptime bars' word for a day's mark.
- **A Column chart's plot holds everything it draws.** The scale stands inside the plot's box, 28px under its top and 8px over its bottom, at any width: room over the top tick for a column's value, at rest or pointed at, and under the zero tick for the half line its label hangs. So at a given `height` the columns grow in 36px less than before (Usage's two charts, at 220px, draw their columns in 184px), the x labels stand 16px under the baseline, and the focus ring, 4px outside the box, crosses nothing the plot draws. A chart that needs its columns as tall as they were takes a `height` 36px larger.
- **The Heatmap's focus ring encloses its cells.** On a week of hours the ring went round the weekday names too; on both forms it now goes round the cells and nothing else, 4px off, because the Tab stop is what the arrow keys move through. The rows of hours are 2px apart with no padding of their own, so the grid is 2px shorter than it was.

- **A Composition bar's legend counts its columns from its own width.** It stood four across from a 640px window, so in a narrow card beside a chart a label such as "Enterprise · 24 customers" broke over three lines. It is two across until the bar itself is 36rem wide.
- **Revenue's tiles say their line in one line.** Against a year ago reads "08 Oct–06 Nov 2025, first kept", Best day yet "1 Oct · 7 of the 10 best days" and Past due "1.3% of 30 days' revenue"; the longer forms were cut by the tile at 1440px and stay whole in the context. Who pays names a plan "Scale · 82" and says its counts include the trials, which the ladder counts apart.
- **No page says who can use a control it withholds.** API keys, Tickets, a failed request, Members and Settings drop their sentences ("Owners, Admins and Key managers create and revoke keys.", "Owners, Admins and Members can replay requests.", "Owners, Admins and Members create and change tickets.", "Owners and Admins manage members.", "Only an Owner can change the workspace."). Settings shows an Admin the Workspace section read-only, marked "Read-only". The Records template's and the Form section's Read-only specimens draw no line. The roles table on Members, and what a forced mutation is answered, stay.
- **Members' context counts who can change the workspace from `workspace:update`.** That grant decides it, so the insight now counts Owners only, where it counted Owners and Admins from `members:update`.
- **The assistant walk-through runs on Home as it is now.** With the assistant off, and again once it is switched off, it waits on Home's "A year, counted". With it on, it matches three lines of Home's view context by their shape (revenue with its definition, the gross margin an Owner reads, the day in progress counted in no total), checks that the context leads with the page's title, and posts the Ask on Home's revenue card. It recognises `view_home`'s answer for the last 90 days by its address and by its being a line of the context that tool returned, not by a sentence in the script. It watches the Activity line of an approved change on Now's "Changes" in a second tab. `scripts/fake-llm.ts` answers a view tool's result with that view's first insight.
- **`node scripts/ask.ts` sends the page and records every Proposal.** Each question now carries the page as the console's panel sends it, as near as a script can: its title and its visible text, as the persona is served the page, with the streamed parts in place (the view's shared context is published in the browser and is not sent). The report records every Proposal a write raised, with its approval request or denial, and a question answered by a Proposal alone counts as answered. `--out <folder>` writes the reports somewhere other than `out/asks/`; Meridian's own test now writes to a folder of its own, so `pnpm gate` no longer deletes a real run's Usage report.

### Fixed

- **`node scripts/shot.ts` with two themes in one run draws both as they are.** The second theme's full-page capture could be a frame painted before the page had settled: charts not yet measured, a chart missing, text at another breakpoint's size. Each capture now starts from a blank page. A render taken with `--theme dark,light` before this change is worth taking again.
- **A cost too small for four decimals no longer reads as zero.** `formatCost` in `src/lib/format.ts` keeps the first two digits of an amount under $0.00005 ("$0.0000018") where it wrote "$0.0000". An embedding request at the model's price is such an amount. Every other amount is formatted as before.
- **A Column chart with more columns than room keeps its box.** The columns, and the labels under them, stood a fixed 2px apart, so 360 columns needed 718px for their gaps alone and "Errors per day" on `/usage?period=all` pushed its page sideways: a scroll region of 1,382px in a main of 1,180 at 1440px, and 791px on a phone. The gap is now an expression of the row's own width, right in the server's HTML: 2px while every column has a pixel of its own (for n columns, a plot wider than 3n − 2 pixels), then 1px, then none. A chart with room is drawn as it was. A running column narrower than the 4px its outline needs keeps the outline inside the plot. The card's page draws ninety days and a year of days in a narrow card, and says that a Trend chart is the form for so many periods.
- **A Trend chart's line is never drawn through the label of its baseline.** The label stood at the right end, 6px over the dashed line, on a halo of the card, whatever was drawn there: the sample's p95 runs along its median, so on a phone the line went through "Median 296ms". The label keeps that place while nothing is drawn in it. Otherwise it takes the nearest clear place beside the dashed line at either end, over the line or under it, and it stands over an area or a stack, never in one. When no place is clear the label is not drawn, and the table's caption still names the baseline. A label whose baseline is the top of the scale now stands under the line, where it stood over the chart's top edge.
- **An axis of counts past a billion reads in billions.** A chart's count axis stopped at millions and wrote a tick of 1.5 billion "1500M" beside a column whose value read "1.1B". It takes the steps the figure at rest takes: "1.5B", "2T".
- **A customer's trail answers a finger.** "Business" and "Customers" over a customer's title were 13px tall on a phone; they carry `hit`, as Breadcrumb's links do, so each answers 44px.
- **Usage's calendar card keeps its title whole on a phone.** "A year of requests, a day a cell" was cut at 390px beside its badge; it wraps.
- **`pnpm verify --full` times a workspace's only destination.** A workspace of one destination is linked from no other workspace's rail, so `scripts/navigate.ts` had no route to start its journey from and failed it on both devices with `never-ready: the rail has no other route to start from` (issue #31). A workspace's home that no rail links to is now reached as a person reaches it: from the nearest rail route before it, by the workspace menu's item for its workspace (on a phone, inside the drawer), timed from that item's press. Its line says `through the workspace menu (<workspace>)` and whether anything had prefetched the destination first, and each line of the JSON summary gives its `via`. `scripts/perf.ts` starts its journeys the same way. Every destination a rail links to starts where it did, so a product without such a workspace is measured exactly as before.
- **A press on Open navigation before the drawer has arrived opens it.** The drawer waits behind a boundary of its own, so on a phone the page's trigger could be pressed before the drawer was there, and the press was dropped. This happened most often with the assistant off (issue #32). The shell now counts the presses in its own state, and the drawer answers each one: a press that came early opens the drawer once, when it arrives, and a press after it closed opens it again. Navigating still closes it. The Atlas's Open the contents is answered the same way.
- **A card heading that is cut carries its whole text.** `CardHeader` cuts its title to one line with an ellipsis unless it has `wrap`. A title that is plain text is now also the heading's `title`, so a pointer reads it, and the audit no longer reports "truncated: h2.t-card.truncate … no title holds the whole of it" (issue #33). If you passed `wrap` only to quiet the audit, you can remove it. Keep `wrap` on a heading that must be read whole.
- **A workspace chosen from the menu opens as fast as a rail link.** A menu row is a press, so nothing prefetched where it goes, and on a phone a workspace of one destination took 400 to 530ms to draw its shell where a prefetched page takes under 250. A `Scope` takes an `href`, where choosing it goes, and the rail prefetches each other scope's `href` as the menu opens. Pass it from your own scopes to get the same. `scripts/navigate.ts` waits for those prefetches before a warm press through the menu, as it waits for a link's, and its line says how many there were.
- **A project made in another currency passes its own gate.** `create --currency GBP` made a project whose `tests/format.test.ts` and `tests/trend-chart.test.tsx` expected `$`, so its first `pnpm gate` failed. They read the symbol from `app.currency`, and the consumer smoke now creates in GBP. Update brings both tests over.
- **`pnpm verify --full` walks the sample Home's steps only on the sample's Home.** It told the sample's Home by its file names, which the guide's summary preset tells you to keep, so a product's own Home was walked as the sample's and its assistant steps failed. It is told by the year's card the walk reads; a Home of your own has its Home steps not applicable.
- **A Segmented control is as wide as its options, and never fades an option it has room for.** In a card's column it was stretched across the card; on a phone each option's 44px hit square reached past a 36px option and the track's padding, so the period control scrolled by 2px and its edge fade hid "All" with room beside it. The track keeps to its options, and on touch each option is at least 44px wide. A control that relied on being stretched gets `className="w-full"`.
- **A ticket can be moved on a phone.** The Tickets table gave two columns the card's one status place, the state and the row menu, and a card keeps the first, so the menu was gone under 640px. The menu is the card's status and the state is told with the priority.
- **Revenue's ladder says a customer already pays more than the next plan's smallest.** It wrote "pays 2737% of what the smallest Starter customer pays", a share that reads as an error; past 100% the line says the customer already pays more, and the context says "more than the smallest Starter".
- **Every page's protagonist has its Ask again.** Usage's errors chart and Services' featured card lost theirs when the pages were rebuilt, and Revenue, Now and a customer's page never had one. Revenue's revenue by plan, Usage's requests a day, Now's "Services, now", Services' "Each service, 90 days" and a customer's standing each carry an Ask naming what they show for the period and the day in view; `AskPeriod` in `src/views/ask-period.tsx` is the one form of it over time, Home's revenue card's included.
- **Home's Customers tile says its three counts whole in a 720px reply.** "296 active · 14 on a trial · 10 past …" was cut in the embed's inline view; it reads "296 active · 14 trials · 10 past due".
- **The Requests tiles are worked out from the newest requests, whatever the table is sorted by.** The summary behind them read its 500 requests in the table's order, so a log sorted by latency summarized the 500 fastest where the hint says "the newest 500". It reads the newest first. A log of 500 requests or fewer reads as before.
- **A prepared query states a margin as the pages do.** A margin measure honoured no `scale`, so Home's `explore_home` answered its gross margin as a fraction ("0.62 of revenue") and its change on the window before as a percent of a percent, where Home says "62.5%" and "up 2.5 points". A margin is now `(1 - b / a) / scale`, as a ratio is `a / (b * scale)`, and its change is stated in percentage points to one decimal, or "unchanged" under 0.05. Home's gross margin declares `scale: 0.01`. Every other measure, a ratio in % included, keeps its change as a percent of the window before. A margin of yours without a `scale` still reads as a fraction; its change now reads in points.
- **A compared call states each group's change.** `explore_<view>` grouped by a facet with `compare` stated the window before for the total alone, so "which model brought the most revenue, and how did that move?" was half answered. Each group now carries its own figure in the window before and its change, or "none in the window before". A bucket still states only the total's change.
- **A Metric tile's note takes a second line before it is cut.** In a third of the page with the assistant's panel open, Home's Customers tile read "296 active · 14 trials · 10 past …" and Revenue's first-customer tile lost its end. A default tile's `note` now wraps to two lines, and keeps its whole text in its title past them. A change and its comparison keep their one line; a compact tile's line is unchanged.
- **Services' Featured metric says what its line is.** It states the mean uptime over a line that is the share of the services operational each day, which fell to about 83% on a day one service was degraded and read as uptime falling. Its caption names the line.
- **The assistant no longer tells a person a page has no place for what they may not read.** Under `explain`, a Viewer asking about cost on Home was told the page "doesn't surface it" for anyone, and one asking where to create a key was sent to Settings. The prompt now says the pages that hold a withheld record show it to the roles that can read it, and never to send the person to a page that does not hold it; a record with a page of its own is named with its address ("Its page is API keys (/keys)"), whose refusal says who can open it. `Audience.withheld` in `src/lib/assistant/prompt.ts` takes an optional `page`.
- **Now says when the services could not be read.** "Services, now" drew "No service is monitored yet" when the services' read failed; it says the services could not be read, as every other part of the page does.
- **A Heatmap's weekday column is the 40px its cells are fitted to.** It was drawn at 2.5rem, 35px at Meridian's rem, so the cells had 5px more room than they were measured with.
- **An Uptime bars day with no data shows no healthy fill.** Its mark is translucent, so the baseline under it showed through and the day read partly up. The baseline now leaves those days out.
- **A customer's requests by route count every route the request log shows it calling.** Some named customers had sampled requests on a route their 30-day mix counted at nothing. Each such route now holds requests moved from the customer's own largest route, and a customer the sample does not name gives the same number back on that route, so no customer's requests and no endpoint's moved; only those customers' mixes changed. A test of yours that pins a sample customer's `byEndpoint` pins a new one.
- **The consumer check resolves this release's migrations.** `cli/scripts/smoke.ts` lists `refusal-declared` and the four new migrations in `RELEASE_IDS`. For a created origin it brings each file over as a project created with the release holds it: its configuration (with its own `app` kept), its verify config and its tests, deleting a test the release no longer has.
- **The assistant names no withheld source or measure in a refusal, and tells the truth about where a record is shown.** A prepared-query call that does not fit is told why using the person's own names, and on a detail page the tool says every call is held to the page's record. Under `explain` the prompt names every page that shows a withheld record and what is worked out from it, so a Viewer is no longer told Home has no gross margin. A page the person may not open is never offered as where they make a change. `src/lib/assistant/tools.ts` and the route are your project's: bring `tools.ts` over and build the audience in your route as the sample's does.
- **Sign out removes the assistant's conversation.** The rail's Sign out clears the stored thread before it goes to its route or runs the product's sign-out, so the next person to sign in on that browser neither sees nor sends it.
- **A compact count reads the step it was rounded to.** `formatCompact` chose its step by rounding to one decimal, then wrote the digits with `toFixed`, which prints 0.95 as 0.9. So 950,000,000 read "0.9B" while 949,999,999 read "950.0M". A count now moves up a step only where its one decimal would read a thousand of the step below. 950,000,000 is "950.0M", as the axis's 950M tick reads, and 999,950,000 is "1.0B". A negative rounds as its positive does: -1,500 is "-2K", where it was "-1K".
- **A money axis reads the tick it stands at.** `AXIS_FORMATTERS['cost-compact']` was `formatCostCompact`, which rounds anything from 1,000 to 999,999 to whole thousands. On Home's "Revenue a period" and Revenue's "Revenue a window, by plan", a product with smaller revenue would see a tick at 2,500 read "$3K". Both money entries, `cost` and `cost-compact`, now read a tick as the count axis does, with the currency's symbol: "$2.5K", "$1.25M", "$5B". `AXIS_FORMATTERS.cost` reads ticks from 1,000 to 9,999 the same way ("$5K", where it read "$5,000"). The count axis keeps two decimals where a tick needs them ("1.25M", where it read "1.3M").
- **A prepared query writes money as the pages do.** A measure declared with `unit: 'money'` is an amount in `app.currency`. The answer writes it through `formatCost` ("Revenue, in GBP: £409,206.80."), and the input's schema names the currency's code. The sample's eight money measures declared `unit: 'USD'`, so a project made with `--currency GBP` read "£409,206.80" in Home's context but "409,206.8 USD" from `explore_home`. A money measure of yours declared with a currency code still prints that code after a plain number: declare it `money`.
- **A group with no value reads as the page says it.** `explore_requests` grouped by model reported the requests that reached no model as "- null: N requests", and nothing could narrow to them. A source's `none` gives a field's missing value its word (`none: { model: 'no model' }`). Its group reads that word, and a condition names it as `null`, which the input admits only for a field that has a word. Requests reads "no model" and Tickets "unassigned".
- **A narrowed figure says it is narrowed.** A measure's line now ends with the conditions that narrowed it ("This figure is only of those where state eq failed."), so "Runs: 1 runs" under a filter is not read as every run of the window. Tests' Runs is now defined as the runs that started in the window, where it said every run.
- **Tickets' prepared query sends nobody to Members.** Its `cannot` line said Members (/members) names an assignee's id, and a Viewer may not open that page. It now says the page names the member each ticket is assigned to.
- **A request's context gives its route's p95 a window.** "Its latency is 0.5× the p95 of GET /v1/documents/:id (96ms)" did not say the p95 covers the last 30 complete days. It now does.
- **Home reads its data once a request.** Every part of the page asks for the read with the same arguments, where the actions asked with one fewer and read everything a second time.
- **The inline Now view never says every service is operational when it does not know.** With the services unread it says they could not be read; with none monitored, that none is; with nothing arrived yet, it draws the page's empty card.
- **Services lines up its strips on today.** The uptime chart, the "last n days" caption, the title and the context count the longest strip, and a service that keeps fewer days counts neither up nor down on a day it does not keep. Before, a shorter strip filled the oldest days, and the service read as down on the latest ones.
- **The year's sentence starts at the first window that begins after the first request.** A window that holds the first request after days with none is short of requests and its median day may have no p95, so Home's year card and Now's band no longer say "Requests grew 200.0% from the 30 days to …, and p95 stayed between 0 and …" of flat traffic. They grow from the first window that begins on or after the first day with a request and name it; a quiet day after that keeps its window. A change that rounds to 0.0% reads "Requests held level".
- **Now's line under the title keeps to its room.** It counts the updates, then the incidents, then leaves out the days inside the band and then the services, so the masthead holds one height however many updates or incidents there are.
- **The navigation drawer stays closed on Back.** After a link in it was followed, Back to the page it was opened on no longer reopens it.
- **The sample's journeys follow your `refusal`.** `journeys/workspaces.ts` expects the missing page of a refused destination under `refusal: 'absent'`, as `pnpm verify --as` does, and its refresh step is gated on the pages it walks, so dropping Usage no longer skips it. `skills/zz-meridian/references/customize.md` names the shipped tests that hold the sample's clock, collections, people and records, and what to do with each.
- **A running stacked column with no data reads "No data so far" in its readout.** Each part said "No data" there while its row of the table said "No data so far"; both now say "No data so far". A part with no data among parts that were read still reads "No data".
- **Revenue's What they buy names every read that failed.** With the usage by model and the models both unread it said only "The usage by model could not be read"; it now says "The usage by model and the models could not be read", as Home's What we sell does.
- **Usage names your reporting timezone.** Its caption, the year's and When they come's descriptions, the hours Heatmap (`timezone`), its context and its prepared query's hours named UTC whatever `app.timezone` was; they now name `app.timezone`. A product that sets another zone cuts its `hours` collection in it.
- **A new key's secret no longer reaches the assistant.** The API keys page marks the banner's Copy field `data-assistant="omit"`, so a question asked or an Ask pressed while a newly created key is on screen sends the page text without it; the person still sees the whole key and copies it.
- **A tab left open while someone else signs in from another tab asks as them after one refusal.** After the route's 409 the panel refreshes the route, so the layout resolves the current scope and the next question is answered, where every question was refused until a reload. The console records the scope it last loaded for beside the thread (`<slug>.assistant.scope`): `saveThread` writes nothing while that is another scope, even when a stale tab's reply lands after the other tab loaded, and the 409 and Clear conversation remove only that scope's thread (`forgetThread(storage, scope)`), so the conversation the person now signed in stored from the other tab is kept. Sign out removes both.
- **`node scripts/ask.ts` leaves out what the panel leaves out, and records a Proposal in the order the route streams it.** A node marked `data-assistant="omit"` is not in the page text it sends, and a write's Proposal, which the route streams before the call's input, is recorded beside its call, so a question answered by a Proposal alone is answered and the script exits 0.
- **Under `explain` the prompt names Settings as where the workspace is shown.** The pages that show a withheld record include every rail page whose feature's need, or the need of an action the features table puts on that feature, reads it: a Viewer is told the workspace is on Settings, which they can open, where it is not shown to them.
- **The assistant names the release a run belongs to.** Asked which release failed the most runs, it was told "releases_1: 1 runs" and paired the keys with the page's versions by position, sending the reader to v0.8.3 on Embeddings' staging when the failure was on v4.18.2, the Edge gateway release in production. The runs' groups and rows now name each release.
- **A refused change names who can make it, not who can read it.** Under `refusal: 'explain'` the prompt named only the roles that read a withheld collection, so a Viewer asking for a key was told to ask a Member, who reads keys and creates none. Each withheld collection now names the roles that may create, change or remove it ("Owner, Admin or Key manager can create or remove it"), and a refused change is answered with those.
```


# Update 0.17.0 to 0.18.0

- Source: 0.17.0
- Target: 0.18.0
- Route: adopt
- Session: 20261018T224739076Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.18.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.18.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.18.0 update --abort      # restore what the update changed and archive the session
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

- added/write: 5
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 148
- untouched/write: 33

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        write   .agents/skills/zz-meridian/references/cache.md
untouched        leave   .agents/skills/zz-meridian/references/customize.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        write   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        write   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        leave   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        write   .claude/skills/zz-meridian/references/cache.md
untouched        leave   .claude/skills/zz-meridian/references/customize.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        write   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        write   .claude/skills/zz-meridian/references/standard.md
untouched        write   .claude/skills/zz-meridian/references/update.md
untouched        write   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        write   scripts/audit.ts
untouched        leave   scripts/brand.ts
untouched        leave   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        write   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        write   scripts/interactions.ts
untouched        leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        leave   scripts/lib/budgets.ts
untouched        write   scripts/lib/chrome.ts
added            write   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        write   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
added            write   scripts/lib/frame-cause.ts
untouched        write   scripts/lib/journey.ts
added            write   scripts/lib/links.ts
untouched        leave   scripts/lib/next-config.ts
added            write   scripts/lib/phone.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
added            write   scripts/lib/shard.ts
untouched        write   scripts/lib/sizes.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        write   scripts/live.ts
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
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        write   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        write   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        leave   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        write   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/index.tsx
untouched        write   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/patterns/status-list/summarise.ts
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/copy-field/index.tsx
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
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/explore.ts
untouched        leave   src/lib/facts.ts
untouched        leave   src/lib/format-date.ts
untouched        leave   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        leave   src/lib/insight.ts
untouched        write   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        write   src/styles/base.css
untouched        leave   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        leave   src/styles/tokens.css
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

The target release's changelog sections above 0.17.0:

```markdown
## [0.18.0] · 2026-10-19

### Breaking

- **The phone the timed suites emulate is one device on every host: the device of Lighthouse benchmark index 800**, the top of Lighthouse's Mid-Tier Mobile bracket. `scripts/vitals.ts` and the navigation journey (`pnpm verify --timed` and `--perf`) measure the host's own index once per run (Lighthouse's `computeBenchmarkIndex`, the median of three readings) and slow the CPU by that index over 800, to one decimal and never below 1, where they slowed it four times on every host. A host whose index is above 3,200 is now slowed more than before and one below it less, so a laptop and a runner whose CPU varies between runs are held to the same phone. Each timed suite prints `phone: this host slowed <rate>x (benchmark index <index> …)`, and `pnpm verify` keeps that line under its navigation and Web Vitals phases. The floors and the budgets are unchanged. A near miss that used to pass on a fast machine is a page to speed up, not a budget to move.
- **The desktop prefetch cap counts every router prefetch.** It counted only requests carrying `next-router-prefetch: 1`, while Next 16 sends `3` for the runtime shell every link prefetches and `2` for a full prefetch's URL data, so it read a fraction of what the router fetched: Meridian's Home reads 45.3 KiB where it read 8.8 KiB. A project whose landing page now reads over its `budgets.prefetchKb.desktop` either prefetches less from that page or sets the cap from its own measurement.
- **The whole 20-sample protocol runs only in CI, split by route across runners.** `pnpm verify --perf` and `node scripts/perf.ts` without `--routes` now refuse where `CI` is not `true`, before the gate or Chrome starts: the protocol is 1,800 journeys, an hour and a half of a machine, and a person's machine is never quiet for that long. In CI, split it with `--shard <i>/<n>` (`pnpm verify --perf --shard 2/5`, with `--perf` alone; the shards together run every rail route once), one shard a runner. On your own machine, narrow it to the route in question: `node scripts/perf.ts --base <url> --routes <route>`. A script or agent prompt that ran `pnpm verify --perf` locally runs it in CI instead.

### New

- **A project's own check that judges a time has a tier of its own** ([#48](https://github.com/zhixuan312/zz-meridian/issues/48)). `timedChecks` in `scripts/verify.config.ts` lists browser checks that judge a time: `pnpm verify --timed` runs each with `--base`, alone, after the live data and before Web Vitals, and reports them as the `timedChecks` suite. A check that measured a budget inside `browserChecks`, under the other suites' load, moves to `timedChecks`.
- **The fake model can call a project's own tools** ([#49](https://github.com/zhixuan312/zz-meridian/issues/49)). `fakeModel` in `scripts/verify.config.ts` lists `{ when, tool, input }` steps: for a question matching `when` (a case-insensitive pattern) the fake model calls `tool` with `input` when the request hands it, so a journey can check that the assistant cites what the page shows. A pattern that does not compile fails `pnpm verify` before the gate.
- **`scripts/shot.ts --as <persona>`** ([#50](https://github.com/zhixuan312/zz-meridian/issues/50)) signs each page in with that persona's cookie from `scripts/verify.config.ts` and names each file `<route>-<persona>-<width>-<theme>.png`, so a second persona's pages can be shot for a review. An undeclared persona is refused before Chrome starts, and any option of `shot.ts` given no value (`--as` last on the line) is refused rather than shot without it.

### Changed

- **The start guide keeps the shared phone budget.** `/system/start/start-a-dashboard` carried its own phone-shell budget of 300 ms in `scripts/verify.config.ts`, against the shared 250, because its heading measured 243 to 282 ms on the phone. Since the rail's Docs item prefetches the page in full, its warm phone shell reads 28 ms on the machine that set the exception and 59 ms on the scheduled runner, so the exception is gone. A project's own `budget` on a navigation check works as before.
- **The fake model refuses the key only on the word `fail`.** It refused any message containing `fail`, so a question such as "Which runs failed?" could not be a `fakeModel` step; "Please fail now" is still refused.
- **Meridian's weekly CI runs each tier as its own job.** `full`, `timed`, `perf` (five shards of the rail routes) and `consumer` run in parallel, each on its own runner and each within half an hour, where one job ran `pnpm verify --full --timed --perf` for over two hours. A red is rerun by its job alone, and a dispatch can name the jobs it runs (`gh workflow run weekly.yml -f jobs=timed`). `docs/testing.md` says a project's own CI runs the perf protocol the same way.
- **A dropped frame says where its time went.** `scripts/vitals.ts`'s line for a page that drops a frame ends with the longest gap and, from the Long Animation Frames API, how much of it was script (and whose), style and layout, and render, or that no long animation frame covered it, which points at the compositor or the host rather than the page: `longest gap 167 ms: a long animation frame of 185 ms (script 181 ms by BUTTON.onclick, style and layout 0 ms, render 0 ms)`.

### Fixed

- **`tests/explore-runner.test.ts` no longer fails on a busy machine.** Its large-collection case built a million rows to show that a prepared query asks one aggregate and reads no page, which took 2.8 s alone and passed the 30 s test timeout with the other test workers on a loaded host. It builds 120,000 now, and asserts the same calls. A created project keeps its own copy of the test: bring the release's over, or change `1_000_000` to `120_000` and `'750,010'` to `'90,000'`.
- **Opening the phone drawer and changing a period no longer lay the page out inside the tap.** Opening the navigation drawer focused its first link inside the tap and let the modal's changes to `<body>` (`pointer-events: none`, the scroll lock's scrollbar width) restyle the whole page, and a period change made the segmented control read its option's position inside the same task: each forced the browser to lay out the page before the frame, which dropped a frame of 67 to 118 ms on the scheduled runner's phone. The drawer stays a modal dialog: focus moves into it a frame after it opens and returns to the button that opened it, the shell's frame stops the inherited changes, and the segmented control measures its thumb in a `ResizeObserver` callback, after layout. A frame that holds a drawer (`data-drawer-frame`) now owns its `pointer-events` while the drawer is open. On the scheduled runner, whose style and layout run about twice as slow as its benchmark index says, some pages still drop a frame: the drawer's mount script and the period's re-render are the work left.
- **A live page no longer reads its collections again right after it loads** ([#53](https://github.com/zhixuan312/zz-meridian/issues/53)). The stream's first open re-read every collection the server had just served, so a page reading one path from two components and the stream asked for it three times a load, and under a slow API those reads held the browser's connections while the next navigation waited. A collection now has an optional `revision()`; `read`, `readAll` and `aggregate` return the revision they read at, a page hands its views those revisions, and the stream's first open sends them as `since`: the stream greets `synced` when nothing moved, and `resync` naming only what did, so no write between the server's read and the stream's subscription is lost. An adapter without `revision()` is resynced on every open, as before.
- **The standard Metric tile keeps a long label in its title** ([#51](https://github.com/zhixuan312/zz-meridian/issues/51)), as the compact tile does, so the audit no longer reports a cut label through this managed file.
- **A toggle probe reads the whole of what it watches** ([#52](https://github.com/zhixuan312/zz-meridian/issues/52)). The navigation compared the first 80 characters of each element its `resultSelector` matches, so a control that changes the end of a long row (an inline confirm in its last cell) was reported dead. A `resultSelector` that holds a ticking clock now counts as changing, so point it at what the control changes.
- **The console rail's Docs link finds the start guide ready.** The rail's Docs item asks for its page in full (`NavItem.prefetch`, a new optional field), since the start guide's article is its page's URL data, which the default App Shell prefetch leaves for after the press: from `/settings` the start guide's desktop shell fell from 77-146 ms to about 30 ms, and on the phone from 262 to 24 ms, at the cost of one prefetch of about 15 KiB on each main-workspace page on the desktop. The rail keeps Next's default for every other item, and compiles in a project whose `NavItem` has no such field. `scripts/live.ts` tells a prefetch from the router's own read by the same rule as the cap.
- **`node scripts/audit.ts --atlas` no longer reports overlaps on the Atlas pattern pages** (the 0.17.0 known issue). The audit measured `content-visibility: auto` subtrees the browser had not laid out yet; it now renders each such subtree before it measures and waits two frames. A `content-visibility: hidden` subtree is left alone, since it is not drawn.
- **The presses follow a relative link as a browser does.** `scripts/interactions.ts` skipped every `href` that did not start with `/`, so a relative link that answered 404 passed. It now resolves each link against its page (`linkPath` in `scripts/lib/links.ts`), follows every link to the page's own site, and reports `link <href> (<resolved path>) answers <status>`.
- **The Services page's uptime strip ends on today in `app.timezone`.** Its days were cut at the UTC date, so east of UTC after local midnight (west of UTC in the evening) the line's last day was a day off from the periods every other part of the page cuts with `dayOf`. A product whose `app.timezone` is UTC sees no change.
- **The checks no longer fill your Downloads folder.** Every press of an Export button (Home, Revenue and Usage) is a real download, and the browser `scripts/lib/chrome.ts` launches had no download directory of its own, so each `pnpm verify --full` and `--as` saved their CSVs in the person's Downloads folder, outside the temporary profile the run removes. Downloads now go inside that profile and are removed with it. Files an earlier run left there are named `home-<period>.csv`, `revenue-<period>.csv` and `usage-<period>.csv`, with ` (1)`, ` (2)` and so on after them, and can be deleted.
- **The workspace journeys read a page's heading once the page is there.** `journeys/workspaces.ts` read the heading as soon as the address and the rail were right, which on a loaded machine could be while the page's `loading.tsx` still stood in for it, whose masthead holds the page's name where the record's will be: the customer step failed with `found a page headed "Customer:"`. It now waits while a busy `role="status"` is on the page. A project that kept the sample's journeys brings `journeys/workspaces.ts` over from the release.
- **The `agent-does-here-section` update item finds a view tool kept in a module of its own.** It read `src/views/tools.ts` alone, so a project updating across 0.16.0 whose tools sat in modules the registry imports was told of no page while the gate, which reads those modules since 0.17.0, failed them. It now reads every module under `src/`.
- **A page specification's Theme control no longer drops a frame on a phone** (the 0.17.0 known issue). The stage keyed each pane by its theme, so a Dark-to-Light tap unmounted the pane and loaded the whole page again in a new frame inside the tap. Each pane is now keyed by its position: the frame on screen stays mounted and is re-dressed.

### Known issues

- **On Meridian's scheduled runner, `pnpm verify --timed` drops one frame on two pages**: opening `/business`'s phone drawer and changing `/`'s period, in style and layout of 49 and 64 ms that the benchmark index does not calibrate (2 of 30 pages). Both pass on a quiet machine at the standard's phone, and no floor moved for them, so the weekly `timed` job stays red until the pages do less work in the tap. `pnpm verify` and `--full` are not affected.
```


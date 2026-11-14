# Update 0.39.2 to 0.39.3

- Source: 0.39.2
- Target: 0.39.3
- Route: adopt
- Session: 20261114T054725202Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.39.3 update --finalize   # when every item below is resolved
npx zz-meridian@0.39.3 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.39.3 update --abort      # restore what the update changed and archive the session
```

## What needs you

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

### migration:script:test:t2

script "test:t2" differs from Meridian's

Paths: `package.json`

Your "test:t2" script is "ZZ_GATEWAY=http://127.0.0.1:3125 node scripts/test-run.ts t2" and was kept; Meridian's is "node scripts/test-run.ts t2". Merge the two so the project's `test:t1` can call it, or leave yours if it already does the same work.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:script:test:t2",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-0d06e566ff56b48e9edab7f5019acb03ada4e1fe53e34017cee20d79461baa3f"
  }
}
```

### migration:script:test:release

script "test:release" differs from Meridian's

Paths: `package.json`

Your "test:release" script is "ZZ_GATEWAY=http://127.0.0.1:3125 node scripts/test-run.ts release" and was kept; Meridian's is "node scripts/test-run.ts release". Merge the two so the project's `test:t1` can call it, or leave yours if it already does the same work.

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:script:test:release",
  "status": "resolved",
  "reason": "",
  "files": {
    "package.json": "sha256-0d06e566ff56b48e9edab7f5019acb03ada4e1fe53e34017cee20d79461baa3f"
  }
}
```

### migration:verify-modes

`pnpm gate`, `pnpm verify` and the other removed commands are replaced by the three test commands.

Paths: `scripts/verify.config.ts`

Read "Test runs" in AGENTS.md and "The tiers" in `references/validation.md`. `pnpm gate` and `pnpm verify` with its flags — `--full`, `--timed`, `--perf`, `--quick`, `--no-vitals` and `--extra` — are removed, and so are the `test` script and `scripts/gate.ts` and `scripts/verify.ts`. `scripts/audit.ts`, `scripts/interactions.ts`, `scripts/live.ts`, `scripts/keyboard.ts` and `scripts/vitals.ts` still ship, so a script of your own that runs one still works: it is the commands that wrapped them that went. Run `pnpm test:t1` after a change (the affected Tier 1 tests, the static checks and the type check), `pnpm test:t2` when the change can alter what a page draws or a control does (the affected Tier 2 checks and the browser sweeps as well), and `pnpm test:release` before a release (every Tier 1 and Tier 2 test once, the timed browser suites, lint and the type check). None takes an argument: the command selects the tests. Replace every removed call in the files listed — scripts, workflows, shell files, documents and comments — and read the line each run ends with: it says what ran and what did not. `scripts/verify.config.ts` and `scripts/verify.baseline.json` stay.

Checks:

- `test:t1`

Resolve with `resolved` or `not-applicable`:

```json
{
  "id": "migration:verify-modes",
  "status": "resolved",
  "reason": "",
  "files": {
    "scripts/verify.config.ts": "sha256-02f80469c315dfa158f692f6700f43165e18e0607810d875a550e85b8b3b37ba"
  }
}
```

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `package.json`
- `scripts/verify.config.ts`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 83
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 186
- untouched/write: 38

<details><summary>Every path</summary>

```
untouched        write   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
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
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        write   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
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
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        leave   scripts/audit.ts
untouched        write   scripts/brand.ts
untouched        write   scripts/browser.ts
untouched        write   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/interactions.ts
untouched        leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/answered.ts
untouched        leave   scripts/lib/args.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/attribution.ts
untouched        leave   scripts/lib/bin.ts
added            write   scripts/lib/browser-plan.ts
untouched        leave   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/consumer-smoke.ts
untouched        write   scripts/lib/context-check.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
added            write   scripts/lib/deep-inputs.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/effective-manifest.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        write   scripts/lib/journey.ts
untouched        leave   scripts/lib/jsonc.ts
added            write   scripts/lib/last-run.ts
untouched        leave   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/lint.ts
untouched        leave   scripts/lib/live-arrival.ts
untouched        leave   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/ownership-guide.ts
untouched        leave   scripts/lib/phone.ts
untouched        leave   scripts/lib/report-lines.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        write   scripts/lib/summary.ts
untouched        leave   scripts/lib/table-head.ts
untouched        leave   scripts/lib/team-config.ts
untouched        write   scripts/lib/tier2.ts
untouched        leave   scripts/lib/timing.ts
untouched        write   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        leave   scripts/navigate.ts
untouched        leave   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        write   scripts/test-run.ts
untouched        leave   scripts/tokens.ts
untouched        leave   scripts/vitals.ts
added            write   src/components/base/app-mark/README.md
untouched        leave   src/components/base/app-mark/index.tsx
added            write   src/components/base/icons/README.md
added            write   src/components/base/motion/README.md
added            write   src/components/base/planes/README.md
untouched        leave   src/components/base/providers.tsx
added            write   src/components/base/shell/README.md
untouched        leave   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
added            write   src/components/base/surface/README.md
untouched        leave   src/components/base/surface/index.tsx
added            write   src/components/base/text-roles/README.md
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
added            write   src/components/charts/bar-list/README.md
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/bar-list/levels.tsx
added            write   src/components/charts/column-chart/README.md
untouched        leave   src/components/charts/column-chart/grouped.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/column-chart/shared.tsx
added            write   src/components/charts/composition-bar/README.md
untouched        leave   src/components/charts/composition-bar/index.tsx
added            write   src/components/charts/diverging-bars/README.md
untouched        leave   src/components/charts/diverging-bars/index.tsx
added            write   src/components/charts/heatmap/README.md
untouched        leave   src/components/charts/heatmap/index.tsx
added            write   src/components/charts/interval-timeline/README.md
untouched        leave   src/components/charts/interval-timeline/index.tsx
added            write   src/components/charts/meridian/README.md
untouched        leave   src/components/charts/meridian/index.tsx
added            write   src/components/charts/range-strip/README.md
untouched        leave   src/components/charts/range-strip/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
added            write   src/components/charts/sparkline/README.md
untouched        leave   src/components/charts/sparkline/index.tsx
added            write   src/components/charts/trend-chart/README.md
untouched        leave   src/components/charts/trend-chart/index.tsx
added            write   src/components/charts/uptime-bars/README.md
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-settled.ts
untouched        leave   src/components/charts/use-size.ts
added            write   src/components/charts/xy-line-chart/README.md
untouched        leave   src/components/charts/xy-line-chart/index.tsx
added            write   src/components/patterns/activity-feed/README.md
untouched        leave   src/components/patterns/activity-feed/index.tsx
added            write   src/components/patterns/appearance-menu/README.md
untouched        leave   src/components/patterns/appearance-menu/index.tsx
added            write   src/components/patterns/ask-about/README.md
untouched        leave   src/components/patterns/ask-about/index.tsx
added            write   src/components/patterns/assistant/README.md
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
added            write   src/components/patterns/command-palette/README.md
untouched        write   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/command-palette/open.ts
added            write   src/components/patterns/data-table/README.md
untouched        leave   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
added            write   src/components/patterns/detail-head/README.md
untouched        leave   src/components/patterns/detail-head/index.tsx
added            write   src/components/patterns/embed-frame/README.md
untouched        leave   src/components/patterns/embed-frame/index.tsx
added            write   src/components/patterns/export-button/README.md
untouched        leave   src/components/patterns/export-button/index.tsx
added            write   src/components/patterns/featured-metric/README.md
untouched        leave   src/components/patterns/featured-metric/index.tsx
added            write   src/components/patterns/filter-bar/README.md
untouched        leave   src/components/patterns/filter-bar/index.tsx
added            write   src/components/patterns/form-section/README.md
untouched        leave   src/components/patterns/form-section/index.tsx
added            write   src/components/patterns/freshness/README.md
untouched        leave   src/components/patterns/freshness/index.tsx
added            write   src/components/patterns/incident-card/README.md
untouched        leave   src/components/patterns/incident-card/index.tsx
added            write   src/components/patterns/metric-tile/README.md
untouched        leave   src/components/patterns/metric-tile/index.tsx
added            write   src/components/patterns/page-loading/README.md
untouched        leave   src/components/patterns/page-loading/index.tsx
added            write   src/components/patterns/period-select/README.md
untouched        leave   src/components/patterns/period-select/index.tsx
added            write   src/components/patterns/proposal/README.md
untouched        leave   src/components/patterns/proposal/index.tsx
added            write   src/components/patterns/prose/README.md
untouched        leave   src/components/patterns/prose/index.tsx
added            write   src/components/patterns/rail/README.md
untouched        write   src/components/patterns/rail/index.tsx
untouched        write   src/components/patterns/rail/trail.ts
added            write   src/components/patterns/shell-tools/README.md
untouched        leave   src/components/patterns/shell-tools/index.tsx
added            write   src/components/patterns/status-list/README.md
untouched        write   src/components/patterns/status-list/index.tsx
added            write   src/components/templates/records/README.md
untouched        leave   src/components/templates/records/index.tsx
added            write   src/components/ui/agent-mark/README.md
untouched        leave   src/components/ui/agent-mark/index.tsx
added            write   src/components/ui/avatar/README.md
untouched        leave   src/components/ui/avatar/index.tsx
added            write   src/components/ui/badge/README.md
untouched        leave   src/components/ui/badge/index.tsx
added            write   src/components/ui/banner/README.md
untouched        leave   src/components/ui/banner/index.tsx
added            write   src/components/ui/breadcrumb/README.md
untouched        leave   src/components/ui/breadcrumb/index.tsx
added            write   src/components/ui/button/README.md
untouched        leave   src/components/ui/button/index.tsx
added            write   src/components/ui/card/README.md
untouched        leave   src/components/ui/card/index.tsx
added            write   src/components/ui/checkbox/README.md
untouched        leave   src/components/ui/checkbox/index.tsx
added            write   src/components/ui/combobox/README.md
untouched        leave   src/components/ui/combobox/index.tsx
added            write   src/components/ui/copy-field/README.md
untouched        leave   src/components/ui/copy-field/index.tsx
added            write   src/components/ui/delta/README.md
untouched        leave   src/components/ui/delta/index.tsx
added            write   src/components/ui/dialog/README.md
untouched        leave   src/components/ui/dialog/index.tsx
added            write   src/components/ui/disclosure/README.md
untouched        leave   src/components/ui/disclosure/index.tsx
added            write   src/components/ui/empty-state/README.md
untouched        leave   src/components/ui/empty-state/index.tsx
added            write   src/components/ui/field/README.md
untouched        leave   src/components/ui/field/index.tsx
added            write   src/components/ui/icon-button/README.md
untouched        leave   src/components/ui/icon-button/index.tsx
added            write   src/components/ui/input/README.md
untouched        leave   src/components/ui/input/index.tsx
added            write   src/components/ui/kbd/README.md
untouched        leave   src/components/ui/kbd/index.tsx
added            write   src/components/ui/key-value/README.md
untouched        write   src/components/ui/key-value/index.tsx
added            write   src/components/ui/menu/README.md
untouched        leave   src/components/ui/menu/index.tsx
added            write   src/components/ui/pagination/README.md
untouched        leave   src/components/ui/pagination/index.tsx
added            write   src/components/ui/popover/README.md
untouched        leave   src/components/ui/popover/index.tsx
added            write   src/components/ui/progress/README.md
untouched        leave   src/components/ui/progress/index.tsx
added            write   src/components/ui/radio-group/README.md
untouched        leave   src/components/ui/radio-group/index.tsx
added            write   src/components/ui/search-input/README.md
untouched        leave   src/components/ui/search-input/index.tsx
added            write   src/components/ui/segmented/README.md
untouched        leave   src/components/ui/segmented/index.tsx
added            write   src/components/ui/select/README.md
untouched        leave   src/components/ui/select/index.tsx
added            write   src/components/ui/sheet/README.md
untouched        leave   src/components/ui/sheet/index.tsx
added            write   src/components/ui/skeleton/README.md
untouched        leave   src/components/ui/skeleton/index.tsx
added            write   src/components/ui/spinner/README.md
untouched        leave   src/components/ui/spinner/index.tsx
added            write   src/components/ui/status-dot/README.md
untouched        leave   src/components/ui/status-dot/index.tsx
added            write   src/components/ui/switch/README.md
untouched        leave   src/components/ui/switch/index.tsx
added            write   src/components/ui/table/README.md
untouched        leave   src/components/ui/table/index.tsx
added            write   src/components/ui/tabs/README.md
untouched        leave   src/components/ui/tabs/index.tsx
added            write   src/components/ui/textarea/README.md
untouched        leave   src/components/ui/textarea/index.tsx
added            write   src/components/ui/toast/README.md
untouched        leave   src/components/ui/toast/index.tsx
added            write   src/components/ui/tooltip/README.md
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
added            write   src/lib/app-contract.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/calendar-date.ts
untouched        leave   src/lib/cn.ts
untouched        write   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/contrast-pairs.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/explore.ts
untouched        write   src/lib/facts.ts
untouched        leave   src/lib/format-date.ts
untouched        leave   src/lib/format.ts
untouched        leave   src/lib/host.ts
untouched        leave   src/lib/insight.ts
untouched        leave   src/lib/live.ts
untouched        leave   src/lib/logo.ts
kept             leave   src/lib/period.ts
untouched        leave   src/lib/preferences.ts
untouched        leave   src/lib/rank.ts
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        leave   src/lib/sort.ts
untouched        leave   src/logic/after-start.ts
untouched        leave   src/logic/derivations.ts
untouched        write   src/logic/summarise.ts
untouched        leave   src/styles/base.css
untouched        leave   src/styles/fonts/Geist-Variable.woff2
untouched        leave   src/styles/fonts/GeistMono-Variable.woff2
untouched        leave   src/styles/fonts/LICENSE.txt
untouched        leave   src/styles/motion.css
untouched        leave   src/styles/theme.css
untouched        leave   src/styles/tokens.css
untouched        write   src/views/console-chrome.tsx
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

Finalizing runs `test:t1` — the Tier 1 tests affected by the change, the static checks and the type check — then a production build, the route policy and the size checks. The last two judge the project, not the release: the route policy needs `cacheComponents` and `partialPrefetching` in your Next config, and the size growth needs a `scripts/verify.baseline.json` you recorded (`node scripts/sizes.ts --write-baseline`); without them finalize reports that check `not run` with the reason, and never fails on it. `test:release` is the team's own gate before a release. To check by hand first:

```
pnpm run test:t1
node node_modules/next/dist/bin/next build
node scripts/route-policy.ts
node scripts/sizes.ts
```

## Changelog

The target release's changelog sections above 0.39.2:

```markdown
## [0.39.3] · 2026-11-14

### Changed

- **`node cli/scripts/consumer.ts` runs the consumer path from the working tree.** It builds the payload, compiles the CLI, packs it and runs the consumer smoke against that tarball; `scripts/test-run.ts` packs through it, so there is one packing path.
- **An update removes the tests an older release shipped.** On the create route a top-level test a release ships is Meridian's by that release's own rule, so updating from such a release deletes each one the project has not edited and stages each one it has. This release ships only `tests/setup.ts` at that level.
- **The consumer smoke runs from the working tree on a published version.** `consumer.ts` packs the CLI labelled as the next patch, as the weekly job does, and the smoke reads the version from the tarball it is given.
- **A created project's smoke suite is its Tier 1 run and a build.** The release's consumer job runs `test:t1` then `next build` in the new dashboard instead of a second full `test:release`; the weekly job still runs the created project's whole `test:release` (`--created-release`).

- **A release runs each check once, in parallel jobs.** The release workflow runs a static stage, the four browser sweeps, the deep tests a change reaches (two legs), the consumer path (whose created dashboard runs `test:t1`, a build and the `rest` sweep) and a Tier 2 job that never blocks publishing; the Tier 2 record and history are attached to the Release after the tag. The weekly run no longer has a `t2` job.
- **A timed browser suite never fails a run.** Navigation with its budgets judged, live data, Web Vitals and the 20-sample perf protocol are Tier 2: a FAIL from one of them is reported in the run's closing line as over budget, and the run stays green. The function sweeps (audit, every control pressed, keyboard, rail, personas, journeys, assistant) still fail it.
- **`scripts/browser.ts --only <audit|interactions|keyboard|rest>` runs one function sweep,** against the same assistant-on server the whole run uses, and names the others as left to their own jobs.
- **`control-dead` and a shell `never-ready` say what happened at the press** (#147): whether the click reached the page, the `readyState` at the press and the element at the press point. The perf-live deep case judges each combination on a three-run allowance instead of its first slow sample.
- **`node scripts/test-run.ts stage <static|sweep <name>|deep --since <ref> [--part i/n]|tier2>` runs one part of `test:release`,** so CI can run each once in its own job. `stage deep` runs only the deep tests a change reaches: every one when `scripts/`, `journeys/` or a deep test changed, none when nothing reaches them.
- **A run that ends red hands the next one its failures.** `test:t1` and `test:t2` leave `out/last-run.json` — the tree they proved and the test files that failed — and the next run starts from that tree, so a fix runs the failures it answers and the tests its own change reaches instead of everything since the last green run. The same tree may be retried once, and that run says so and never advances the marker; a second run of the same bytes is refused. A browser run no longer ends at its first failed sweep: every sweep it was asked for runs and every failure is reported together.
- **The Tier 2 history can travel with the releases.** `nextHistory` in `scripts/lib/tier2.ts` adds a release's record to the last five.

- **The package no longer carries Meridian's docs, decisions, contributor guide, card previews or Design Atlas;** no route read them. The changelog still ships whole: an update's MERGE.md shows every release since the project's.
- **Every card's README ships next to its component,** managed, in created and adopted projects, so an agent reads the documentation of the version it has. A project's `check.ts` no longer judges the card contract, which is Meridian's own.

- **`src/app.config.ts` is checked against `src/lib/app-contract.ts`,** a managed file holding the shapes Meridian's own code reads (`AppIdentity`, `Workspace`, `NavItem`, `NavGroup`). A configuration missing a field the managed code reads now fails the type check. A project's existing configuration is not rewritten by an update: add `void (app satisfies AppIdentity);` beside your `app` to opt in.

### Breaking

- **`adopt` exits 1 when the type check fails after install.** The files stay adopted; fix the type errors, then run the project's gate (`npx tsc --noEmit` re-checks).
- **A created project carries no Meridian tests.** Only `tests/setup.ts` is Meridian's; `tests/examples/` holds two tests that are the team's to rewrite. The next `update` deletes each Meridian test a project has not edited and stages each one it has.
- **The recurring `sample-with-its-tests` migration is removed.** Nothing pins the sample now, so no update reports sample files that differ from the release.
- **`inBand`, `steady` and `DayService` left `src/lib/facts.ts`.** They state a rule about service days, which is the sample's business, so they now live in the sample's `src/logic/service-facts.ts`; a product that used them takes that file or writes its own. An update reports each file of the team's that still imports them (`managed-exports-removed`), and a created project that kept the sample brings the release's `src/logic/` over as that instruction says.
- **`summarise` and the Status list name their rows `item` by default.** Pass your own noun (`{ one: 'service', other: 'services' }`, sites, branches) for the summary and the count.
```


# Update 0.39.3 to 0.39.4

- Source: 0.39.3
- Target: 0.39.4
- Route: adopt
- Session: 20261114T103816128Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.39.4 update --finalize   # when every item below is resolved
npx zz-meridian@0.39.4 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.39.4 update --abort      # restore what the update changed and archive the session
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

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`
- `package.json`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- added/write: 1
- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 305
- untouched/write: 2

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        leave   .agents/skills/zz-meridian/references/customize.md
untouched        leave   .agents/skills/zz-meridian/references/data-layers.md
untouched        leave   .agents/skills/zz-meridian/references/existing-project.md
untouched        leave   .agents/skills/zz-meridian/references/live.md
untouched        leave   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        leave   .agents/skills/zz-meridian/references/standard.md
untouched        leave   .agents/skills/zz-meridian/references/update.md
untouched        leave   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        leave   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        leave   .claude/skills/zz-meridian/references/cache.md
untouched        leave   .claude/skills/zz-meridian/references/customize.md
untouched        leave   .claude/skills/zz-meridian/references/data-layers.md
untouched        leave   .claude/skills/zz-meridian/references/existing-project.md
untouched        leave   .claude/skills/zz-meridian/references/live.md
untouched        leave   .claude/skills/zz-meridian/references/ownership.md
untouched        leave   .claude/skills/zz-meridian/references/register.md
untouched        leave   .claude/skills/zz-meridian/references/standard.md
untouched        leave   .claude/skills/zz-meridian/references/update.md
untouched        leave   .claude/skills/zz-meridian/references/validation.md
untouched        leave   .claude/skills/zz-meridian/references/voice.md
team-preserved   write   AGENTS.md
untouched        leave   scripts/ask.ts
untouched        leave   scripts/assistant.ts
untouched        leave   scripts/audit.ts
untouched        leave   scripts/brand.ts
untouched        write   scripts/browser.ts
untouched        leave   scripts/check.ts
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
untouched        leave   scripts/lib/browser-plan.ts
untouched        leave   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/cls.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/consumer-smoke.ts
untouched        write   scripts/lib/context-check.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep-inputs.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/effective-manifest.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        leave   scripts/lib/journey.ts
untouched        leave   scripts/lib/jsonc.ts
untouched        leave   scripts/lib/last-run.ts
untouched        leave   scripts/lib/layer-rules.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/lint.ts
untouched        leave   scripts/lib/live-arrival.ts
untouched        leave   scripts/lib/nav-under.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/ownership-guide.ts
untouched        leave   scripts/lib/phone.ts
added            write   scripts/lib/pool.ts
untouched        leave   scripts/lib/report-lines.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/sizes.ts
untouched        leave   scripts/lib/summary.ts
untouched        leave   scripts/lib/table-head.ts
untouched        leave   scripts/lib/team-config.ts
untouched        leave   scripts/lib/tier2.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        leave   scripts/navigate.ts
untouched        leave   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        leave   scripts/sizes.ts
untouched        leave   scripts/test-run.ts
untouched        leave   scripts/tokens.ts
untouched        leave   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/README.md
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/icons/README.md
untouched        leave   src/components/base/motion/README.md
untouched        leave   src/components/base/planes/README.md
untouched        leave   src/components/base/providers.tsx
untouched        leave   src/components/base/shell/README.md
untouched        leave   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/README.md
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/README.md
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/README.md
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        leave   src/components/charts/bar-list/levels.tsx
untouched        leave   src/components/charts/column-chart/README.md
untouched        leave   src/components/charts/column-chart/grouped.tsx
untouched        leave   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/column-chart/shared.tsx
untouched        leave   src/components/charts/composition-bar/README.md
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/diverging-bars/README.md
untouched        leave   src/components/charts/diverging-bars/index.tsx
untouched        leave   src/components/charts/heatmap/README.md
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/interval-timeline/README.md
untouched        leave   src/components/charts/interval-timeline/index.tsx
untouched        leave   src/components/charts/meridian/README.md
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/range-strip/README.md
untouched        leave   src/components/charts/range-strip/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/README.md
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/README.md
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/README.md
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-settled.ts
untouched        leave   src/components/charts/use-size.ts
untouched        leave   src/components/charts/xy-line-chart/README.md
untouched        leave   src/components/charts/xy-line-chart/index.tsx
untouched        leave   src/components/patterns/activity-feed/README.md
untouched        leave   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/README.md
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/README.md
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/README.md
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/README.md
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        leave   src/components/patterns/command-palette/open.ts
untouched        leave   src/components/patterns/data-table/README.md
untouched        leave   src/components/patterns/data-table/index.tsx
kept             leave   src/components/patterns/data-table/use-query-state.ts
untouched        leave   src/components/patterns/data-table/use-search-draft.ts
untouched        leave   src/components/patterns/detail-head/README.md
untouched        leave   src/components/patterns/detail-head/index.tsx
untouched        leave   src/components/patterns/embed-frame/README.md
untouched        leave   src/components/patterns/embed-frame/index.tsx
untouched        leave   src/components/patterns/export-button/README.md
untouched        leave   src/components/patterns/export-button/index.tsx
untouched        leave   src/components/patterns/featured-metric/README.md
untouched        leave   src/components/patterns/featured-metric/index.tsx
untouched        leave   src/components/patterns/filter-bar/README.md
untouched        leave   src/components/patterns/filter-bar/index.tsx
untouched        leave   src/components/patterns/form-section/README.md
untouched        leave   src/components/patterns/form-section/index.tsx
untouched        leave   src/components/patterns/freshness/README.md
untouched        leave   src/components/patterns/freshness/index.tsx
untouched        leave   src/components/patterns/incident-card/README.md
untouched        leave   src/components/patterns/incident-card/index.tsx
untouched        leave   src/components/patterns/metric-tile/README.md
untouched        leave   src/components/patterns/metric-tile/index.tsx
untouched        leave   src/components/patterns/page-loading/README.md
untouched        leave   src/components/patterns/page-loading/index.tsx
untouched        leave   src/components/patterns/period-select/README.md
untouched        leave   src/components/patterns/period-select/index.tsx
untouched        leave   src/components/patterns/proposal/README.md
untouched        leave   src/components/patterns/proposal/index.tsx
untouched        leave   src/components/patterns/prose/README.md
untouched        leave   src/components/patterns/prose/index.tsx
untouched        leave   src/components/patterns/rail/README.md
untouched        leave   src/components/patterns/rail/index.tsx
untouched        leave   src/components/patterns/rail/trail.ts
untouched        leave   src/components/patterns/shell-tools/README.md
untouched        leave   src/components/patterns/shell-tools/index.tsx
untouched        leave   src/components/patterns/status-list/README.md
untouched        leave   src/components/patterns/status-list/index.tsx
untouched        leave   src/components/templates/records/README.md
untouched        leave   src/components/templates/records/index.tsx
untouched        leave   src/components/ui/agent-mark/README.md
untouched        leave   src/components/ui/agent-mark/index.tsx
untouched        leave   src/components/ui/avatar/README.md
untouched        leave   src/components/ui/avatar/index.tsx
untouched        leave   src/components/ui/badge/README.md
untouched        leave   src/components/ui/badge/index.tsx
untouched        leave   src/components/ui/banner/README.md
untouched        leave   src/components/ui/banner/index.tsx
untouched        leave   src/components/ui/breadcrumb/README.md
untouched        leave   src/components/ui/breadcrumb/index.tsx
untouched        leave   src/components/ui/button/README.md
untouched        leave   src/components/ui/button/index.tsx
untouched        leave   src/components/ui/card/README.md
untouched        leave   src/components/ui/card/index.tsx
untouched        leave   src/components/ui/checkbox/README.md
untouched        leave   src/components/ui/checkbox/index.tsx
untouched        leave   src/components/ui/combobox/README.md
untouched        leave   src/components/ui/combobox/index.tsx
untouched        leave   src/components/ui/copy-field/README.md
untouched        leave   src/components/ui/copy-field/index.tsx
untouched        leave   src/components/ui/delta/README.md
untouched        leave   src/components/ui/delta/index.tsx
untouched        leave   src/components/ui/dialog/README.md
untouched        leave   src/components/ui/dialog/index.tsx
untouched        leave   src/components/ui/disclosure/README.md
untouched        leave   src/components/ui/disclosure/index.tsx
untouched        leave   src/components/ui/empty-state/README.md
untouched        leave   src/components/ui/empty-state/index.tsx
untouched        leave   src/components/ui/field/README.md
untouched        leave   src/components/ui/field/index.tsx
untouched        leave   src/components/ui/icon-button/README.md
untouched        leave   src/components/ui/icon-button/index.tsx
untouched        leave   src/components/ui/input/README.md
untouched        leave   src/components/ui/input/index.tsx
untouched        leave   src/components/ui/kbd/README.md
untouched        leave   src/components/ui/kbd/index.tsx
untouched        leave   src/components/ui/key-value/README.md
untouched        leave   src/components/ui/key-value/index.tsx
untouched        leave   src/components/ui/menu/README.md
untouched        leave   src/components/ui/menu/index.tsx
untouched        leave   src/components/ui/pagination/README.md
untouched        leave   src/components/ui/pagination/index.tsx
untouched        leave   src/components/ui/popover/README.md
untouched        leave   src/components/ui/popover/index.tsx
untouched        leave   src/components/ui/progress/README.md
untouched        leave   src/components/ui/progress/index.tsx
untouched        leave   src/components/ui/radio-group/README.md
untouched        leave   src/components/ui/radio-group/index.tsx
untouched        leave   src/components/ui/search-input/README.md
untouched        leave   src/components/ui/search-input/index.tsx
untouched        leave   src/components/ui/segmented/README.md
untouched        leave   src/components/ui/segmented/index.tsx
untouched        leave   src/components/ui/select/README.md
untouched        leave   src/components/ui/select/index.tsx
untouched        leave   src/components/ui/sheet/README.md
untouched        leave   src/components/ui/sheet/index.tsx
untouched        leave   src/components/ui/skeleton/README.md
untouched        leave   src/components/ui/skeleton/index.tsx
untouched        leave   src/components/ui/spinner/README.md
untouched        leave   src/components/ui/spinner/index.tsx
untouched        leave   src/components/ui/status-dot/README.md
untouched        leave   src/components/ui/status-dot/index.tsx
untouched        leave   src/components/ui/switch/README.md
untouched        leave   src/components/ui/switch/index.tsx
untouched        leave   src/components/ui/table/README.md
untouched        leave   src/components/ui/table/index.tsx
untouched        leave   src/components/ui/tabs/README.md
untouched        leave   src/components/ui/tabs/index.tsx
untouched        leave   src/components/ui/textarea/README.md
untouched        leave   src/components/ui/textarea/index.tsx
untouched        leave   src/components/ui/toast/README.md
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/README.md
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/app-contract.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/calendar-date.ts
untouched        leave   src/lib/cn.ts
untouched        leave   src/lib/collection.ts
untouched        leave   src/lib/color.ts
untouched        leave   src/lib/contrast-pairs.ts
untouched        leave   src/lib/csv.ts
untouched        leave   src/lib/explore.ts
untouched        leave   src/lib/facts.ts
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
untouched        leave   src/logic/summarise.ts
untouched        leave   src/styles/base.css
untouched        leave   src/styles/fonts/Geist-Variable.woff2
untouched        leave   src/styles/fonts/GeistMono-Variable.woff2
untouched        leave   src/styles/fonts/LICENSE.txt
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

Finalizing runs `test:t1` — the Tier 1 tests affected by the change, the static checks and the type check — then a production build, the route policy and the size checks. The last two judge the project, not the release: the route policy needs `cacheComponents` and `partialPrefetching` in your Next config, and the size growth needs a `scripts/verify.baseline.json` you recorded (`node scripts/sizes.ts --write-baseline`); without them finalize reports that check `not run` with the reason, and never fails on it. `test:release` is the team's own gate before a release. To check by hand first:

```
pnpm run test:t1
node node_modules/next/dist/bin/next build
node scripts/route-policy.ts
node scripts/sizes.ts
```

## Changelog

The target release's changelog sections above 0.39.3:

```markdown
## [0.39.4] · 2026-11-14

### Fixed

- **The browser suites hold a ceiling of browsers between them, and a check that watches a wall-clock window no longer judges the machine.** The function sweeps all start at once, so a product with several `browserChecks` put a dozen browsers on eight cores, and the checks that wait a fixed time for a panel or a chunk went red on a product that was fine: measured on one product, a page settled in 12.5 s with its check alone and in 25.4 s inside the full run, and the same failure took Meridian's own presses sweep with it. Every job now runs through one pool weighted by the `browsers` it opens, so the run never has more browsers open than its ceiling — `--browsers <n>`, and one per two cores by default. A check that declares more than the whole ceiling runs alone and is told the ceiling in `VERIFY_BROWSERS`, which is what `verify.config.ts` already promised and nothing implemented.
- **A project's own gate no longer refuses a document that names `scripts/perf.ts`.** The retired-entry-point rule reported that file beside `verify.ts` and `gate.ts` as a script a project no longer has, but `perf.ts` still ships: the release's Tier 2 job runs the 20-sample protocol through it. A project that followed the guidance and pointed a document at the file had its own check fail on a path it holds. Only the two scripts that really went are reported now.
```


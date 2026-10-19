# Update 0.18.1 to 0.19.0

- Source: 0.18.1
- Target: 0.19.0
- Route: adopt
- Session: 20261019T122730666Z
- Phase: complete
- Outcome: complete

Commands, pinned to the release that started this session:

```
npx zz-meridian@0.19.0 update --finalize   # when every item below is resolved
npx zz-meridian@0.19.0 update --resume     # after an interruption, or to run a skipped install
npx zz-meridian@0.19.0 update --abort      # restore what the update changed and archive the session
```

## What needs you

Nothing was staged and no migration is required.

Resolve each item, then record it in `resolutions.json` next to this file. A resolution is an object with the item id, `resolved`, a reason in a sentence, and the hash each named file has right now. Compute a hash as `sha256-` plus the file's SHA-256 (`shasum -a 256 <file>`), or `null` for a file that is absent. A file edited after its resolution needs a new one.

## Kept and retired files

None.

## Team files this update touches or asks you to review

- `AGENTS.md`

Meridian changes a team file only where it says so here: `package.json` (dependencies and scripts), `AGENTS.md` (the managed block) and the lockfile after an install. Everything else is advice in the items above.

## Every disposition

- kept/leave: 2
- team-preserved/write: 1
- untouched/leave: 165
- untouched/write: 21

<details><summary>Every path</summary>

```
untouched        leave   .agents/skills/zz-meridian/SKILL.md
untouched        leave   .agents/skills/zz-meridian/references/agents.md
untouched        leave   .agents/skills/zz-meridian/references/cache.md
untouched        leave   .agents/skills/zz-meridian/references/customize.md
untouched        write   .agents/skills/zz-meridian/references/existing-project.md
untouched        leave   .agents/skills/zz-meridian/references/live.md
untouched        write   .agents/skills/zz-meridian/references/ownership.md
untouched        leave   .agents/skills/zz-meridian/references/register.md
untouched        write   .agents/skills/zz-meridian/references/standard.md
untouched        write   .agents/skills/zz-meridian/references/update.md
untouched        write   .agents/skills/zz-meridian/references/validation.md
untouched        leave   .agents/skills/zz-meridian/references/voice.md
untouched        leave   .claude/skills/zz-meridian/SKILL.md
untouched        leave   .claude/skills/zz-meridian/references/agents.md
untouched        leave   .claude/skills/zz-meridian/references/cache.md
untouched        leave   .claude/skills/zz-meridian/references/customize.md
untouched        write   .claude/skills/zz-meridian/references/existing-project.md
untouched        leave   .claude/skills/zz-meridian/references/live.md
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
untouched        leave   scripts/brand.ts
untouched        leave   scripts/check.ts
untouched        leave   scripts/contrast.ts
untouched        leave   scripts/fake-llm.ts
untouched        leave   scripts/gate.ts
untouched        leave   scripts/interactions.ts
untouched        leave   scripts/keyboard.ts
untouched        leave   scripts/lib/aliases.ts
untouched        leave   scripts/lib/atlas.ts
untouched        leave   scripts/lib/bin.ts
untouched        write   scripts/lib/budgets.ts
untouched        leave   scripts/lib/chrome.ts
untouched        leave   scripts/lib/config-hooks.ts
untouched        leave   scripts/lib/context-check.ts
untouched        leave   scripts/lib/contrast-pairs.ts
untouched        leave   scripts/lib/coverage.ts
untouched        leave   scripts/lib/data-url.ts
untouched        leave   scripts/lib/deep.ts
untouched        leave   scripts/lib/frame-cause.ts
untouched        leave   scripts/lib/journey.ts
untouched        leave   scripts/lib/links.ts
untouched        leave   scripts/lib/next-config.ts
untouched        leave   scripts/lib/phone.ts
untouched        leave   scripts/lib/routes.ts
untouched        leave   scripts/lib/sample.ts
untouched        leave   scripts/lib/settle.ts
untouched        leave   scripts/lib/shard.ts
untouched        write   scripts/lib/sizes.ts
untouched        leave   scripts/lib/timing.ts
untouched        leave   scripts/lib/update-session.ts
untouched        leave   scripts/live.ts
untouched        leave   scripts/navigate.ts
untouched        leave   scripts/perf.ts
untouched        leave   scripts/rail.ts
untouched        leave   scripts/registry.ts
untouched        leave   scripts/route-policy.ts
untouched        leave   scripts/shot.ts
untouched        write   scripts/sizes.ts
untouched        leave   scripts/tokens.ts
untouched        write   scripts/verify.ts
untouched        leave   scripts/vitals.ts
untouched        leave   src/components/base/app-mark/index.tsx
untouched        leave   src/components/base/providers.tsx
untouched        leave   src/components/base/shell/index.tsx
untouched        leave   src/components/base/shell/leave-question.tsx
untouched        leave   src/components/base/surface/index.tsx
untouched        leave   src/components/base/text-roles/index.tsx
untouched        leave   src/components/base/use-nav-drawer.ts
untouched        leave   src/components/base/use-share-view.ts
untouched        leave   src/components/charts/bar-list/index.tsx
untouched        write   src/components/charts/column-chart/index.tsx
untouched        leave   src/components/charts/composition-bar/index.tsx
untouched        leave   src/components/charts/heatmap/index.tsx
untouched        leave   src/components/charts/meridian/index.tsx
untouched        leave   src/components/charts/readout.tsx
untouched        leave   src/components/charts/scale.ts
untouched        leave   src/components/charts/sparkline/index.tsx
untouched        leave   src/components/charts/trend-chart/index.tsx
untouched        leave   src/components/charts/uptime-bars/index.tsx
untouched        leave   src/components/charts/use-size.ts
untouched        write   src/components/patterns/activity-feed/index.tsx
untouched        leave   src/components/patterns/appearance-menu/index.tsx
untouched        leave   src/components/patterns/ask-about/index.tsx
untouched        leave   src/components/patterns/assistant/index.tsx
untouched        leave   src/components/patterns/assistant/launcher.tsx
untouched        leave   src/components/patterns/assistant/page-text.ts
untouched        leave   src/components/patterns/assistant/scope.tsx
untouched        leave   src/components/patterns/assistant/text.tsx
untouched        leave   src/components/patterns/assistant/thread.ts
untouched        leave   src/components/patterns/command-palette/index.tsx
untouched        write   src/components/patterns/data-table/index.tsx
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
untouched        leave   src/components/patterns/metric-tile/index.tsx
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
untouched        write   src/components/ui/button/index.tsx
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
untouched        leave   src/components/ui/toast/index.tsx
untouched        leave   src/components/ui/tooltip/index.tsx
untouched        leave   src/lib/agent-guidance.ts
untouched        leave   src/lib/assistant/prompt.ts
untouched        leave   src/lib/cn.ts
untouched        leave   src/lib/collection.ts
untouched        leave   src/lib/color.ts
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
untouched        leave   src/lib/safe-markdown.ts
untouched        leave   src/lib/shared-context.ts
untouched        write   src/styles/base.css
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

Finalizing runs the project gate and one build. To check by hand first:

```
pnpm run gate
node node_modules/next/dist/bin/next build
```

## Changelog

The target release's changelog sections above 0.18.1:

```markdown
## [0.19.0] · 2026-10-19

### Breaking

- **Every page's HTML is held to its own baseline, and measured gzipped** ([#57](https://github.com/zhixuan312/zz-meridian/issues/57), [#56](https://github.com/zhixuan312/zz-meridian/issues/56)). `scripts/sizes.ts` measures a page's HTML as a person downloads it, the complete streamed response gzipped, where it measured the uncompressed bytes of the routes in `budgets.htmlKb` only. `node scripts/sizes.ts --write-baseline --base <url>`, against the running build, records the HTML of every page (no API, no dynamic segment, not the not-found screen) beside the first-load figures in `scripts/verify.baseline.json`, and `pnpm verify` holds each to `budgets.htmlGrowthPct` (5%) over its own figure, as first-load JS is held. A growth you accept is recorded once, with the same command, rather than by editing numbers. `budgets.htmlKb` stays as an optional absolute cap, now in gzipped KiB: a cap set on uncompressed bytes is several times too loose, so lower it to the gzipped figure `pnpm verify` prints, or remove it and rely on the baseline. Until the baseline holds `html`, the HTML line is a warning, and `pnpm verify --full` refuses, naming the command. Under `partialPrefetching` Next.js writes each shell's static trees into a page's HTML twice; gzipped, the second copy costs a few KiB rather than tens, so the figure follows the page.

### New

- **A stacked Column chart's part can take a categorical slot** ([#61](https://github.com/zhixuan312/zz-meridian/issues/61)). `ColumnPart.color` (1 to 6) draws the part in `series-<n>`, as `TrendSeries.color` does, for parts that are identities, such as teams, or for two or more usual outcomes, which one neutral would make one. A part with no slot, Other among them, is neutral, and status colours stay out of such a chart: coral and saffron read as a warning beside a real one. `docs/data-display.md`'s Parts of one whole says when to use it.
- **`DataTable` takes `retrying`** ([#59](https://github.com/zhixuan312/zz-meridian/issues/59)): its error state's Retry is busy while the person's retry is on its way. Pass it for their own press only.
- **`ActivityEvent.href`** ([#63](https://github.com/zhixuan312/zz-meridian/issues/63)) links an event's object to its record, with the arrow that says it stays in the product.
- **`Rail` takes `declared`**, every destination the product declares; `ConsoleRail` passes it from the whole navigation.

### Fixed

- **A busy Button keeps its focus** ([#58](https://github.com/zhixuan312/zz-meridian/issues/58)). It was `disabled`, so a focused button that turned busy from anything but its own press, a Retry whose read a live hint or a poll started, lost focus to the page and the next Tab began again at the top. It is `aria-disabled` now, stays in the tab order, and drops a press while busy, a submit's included; `aria-busy` and the spinner are unchanged. A test of yours that expects a busy button to be `disabled` expects `aria-disabled="true"`.
- **A Column chart's period with no data is no longer its tallest mark** ([#60](https://github.com/zhixuan312/zz-meridian/issues/60)). It drew a `fill-track` track the height of the scale, which in light theme read as the biggest period. It draws no column now, a dashed hairline just above the baseline, and its word ("No data") stands over it where a value would. The hairline carries `data-no-data-mark` where the track carried `data-track`. `npx zz-meridian@latest update` lists `migration:no-data-mark` for a project whose copy of `tests/column-chart-no-data.test.tsx` still expects the track: bring the release's over.
- **The rail lights nothing for an address under a destination the person does not hold** ([#62](https://github.com/zhixuan312/zz-meridian/issues/62)). It lit the longest destination they held, so someone refused `/admin/audit` saw `/admin` lit. The current page is found among every declared destination and lit only when their rail holds it. A product that passed `current=''` to work around it can stop.
- **A Button's class list is 178 bytes, not 394** ([#56](https://github.com/zhixuan312/zz-meridian/issues/56)): the frame every button shares is the `.btn` class in `src/styles/base.css`, so a table of row actions does not repeat it on every instance.
```

